#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

#SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#source "$SCRIPT_DIR/tls_san_utils.sh"

# TLS bootstrap for Ubuntu 22.04 with FIPS enabled.
#
# Expects an AWS Secrets Manager SecretBinary containing a tar.gz archive with:
# - ca.cert.pem
# - druid-int22.cert.pem
# - druid-int22.key.pem
#
# Result:
# - keystore.jks:
#     alias druid -> PrivateKeyEntry with leaf + intermediate certificate chain
# - truststore.jks:
#     alias root-ca -> trusted root CA certificate
#
# Usage:
#   setup_tls_certificates2204fips.sh \
#     TLS_CERT_HOME \
#     TLS_INTERMEDIATE_CERTIFICATE_SECRET_NAME \
#     TLS_KEYSTORE_PASSWORD

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 TLS_CERT_HOME TLS_INTERMEDIATE_CERTIFICATE_SECRET_NAME TLS_KEYSTORE_PASSWORD"
    exit 1
fi

TLS_CERT_HOME="$1"
TLS_INTERMEDIATE_CERTIFICATE_SECRET_NAME="$2"
TLS_KEYSTORE_PASSWORD="$3"

OPENSSL_ARGS=(-provider fips -provider base)

BUNDLE_FILE="$TLS_CERT_HOME/druid-int22-ca-bundle.tar.gz"
LEAF_EXT_FILE="$TLS_CERT_HOME/leaf.ext"
CA_CHAIN_FILE="$TLS_CERT_HOME/ca-chain.pem"
DRUID_REPLY_CHAIN_FILE="$TLS_CERT_HOME/druid-reply-chain.pem"

cleanup() {
    rm -f \
        "$BUNDLE_FILE" \
        "$LEAF_EXT_FILE" \
        "$CA_CHAIN_FILE" \
        "$DRUID_REPLY_CHAIN_FILE" \
        "$TLS_CERT_HOME/druid.csr" \
        "$TLS_CERT_HOME/druid.pem" \
        "$TLS_CERT_HOME/druid-int22.key.pem" \
        "$TLS_CERT_HOME/druid-int22.cert.pem" \
        "$TLS_CERT_HOME/ca.cert.pem" \
        "$TLS_CERT_HOME"/*.srl
}

# Enable this after confirming that no PEM files are needed after bootstrap.
# trap cleanup EXIT

TOKEN=$(curl -fsS -X PUT \
    "http://169.254.169.254/latest/api/token" \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")

HOSTNAME=$(curl -fsS \
    -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/hostname)

mkdir -p "$TLS_CERT_HOME"
cd "$TLS_CERT_HOME"

rm -f keystore.jks truststore.jks

aws secretsmanager get-secret-value \
    --secret-id "$TLS_INTERMEDIATE_CERTIFICATE_SECRET_NAME" \
    --output text \
    --query SecretBinary |
    base64 --decode > "$BUNDLE_FILE"

tar -xzf "$BUNDLE_FILE" -C "$TLS_CERT_HOME"

for required_file in ca.cert.pem druid-int22.cert.pem druid-int22.key.pem; do
    if [ ! -f "$TLS_CERT_HOME/$required_file" ]; then
        echo "Missing file in CA bundle: $required_file"
        exit 1
    fi
done

openssl x509 "${OPENSSL_ARGS[@]}" \
    -in ca.cert.pem \
    -noout \
    -subject \
    -issuer \
    -dates

openssl x509 "${OPENSSL_ARGS[@]}" \
    -in druid-int22.cert.pem \
    -noout \
    -subject \
    -issuer \
    -dates

openssl pkey "${OPENSSL_ARGS[@]}" \
    -in druid-int22.key.pem \
    -noout \
    -check

openssl verify "${OPENSSL_ARGS[@]}" \
    -CAfile ca.cert.pem \
    druid-int22.cert.pem

CERT_PUB_SHA=$(
    openssl x509 "${OPENSSL_ARGS[@]}" \
        -in druid-int22.cert.pem \
        -noout \
        -pubkey |
        openssl pkey "${OPENSSL_ARGS[@]}" \
            -pubin \
            -outform DER |
        openssl sha256 |
        awk '{print $2}'
)

KEY_PUB_SHA=$(
    openssl pkey "${OPENSSL_ARGS[@]}" \
        -in druid-int22.key.pem \
        -pubout \
        -outform DER |
        openssl sha256 |
        awk '{print $2}'
)

if [ "$CERT_PUB_SHA" != "$KEY_PUB_SHA" ]; then
    echo "Intermediate CA certificate does not match intermediate CA private key"
    exit 1
fi

keytool -genkeypair \
    -alias druid \
    -keyalg RSA \
    -keysize 2048 \
    -sigalg SHA256withRSA \
    -keystore keystore.jks \
    -storetype JKS \
    -storepass "$TLS_KEYSTORE_PASSWORD" \
    -keypass "$TLS_KEYSTORE_PASSWORD" \
    -dname "CN=$HOSTNAME" \
    -validity 365 \
    -ext "KU=digitalSignature,keyEncipherment" \
    -ext "EKU=serverAuth,clientAuth" \
    -noprompt

keytool -certreq \
    -alias druid \
    -keystore keystore.jks \
    -storetype JKS \
    -storepass "$TLS_KEYSTORE_PASSWORD" \
    -file druid.csr \
    -sigalg SHA256withRSA \
    -ext "KU=digitalSignature,keyEncipherment" \
    -ext "EKU=serverAuth,clientAuth"

cat > "$LEAF_EXT_FILE" <<EOF_LEAF
basicConstraints=critical,CA:false
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth,clientAuth
EOF_LEAF

SERIAL_HEX=$(openssl rand "${OPENSSL_ARGS[@]}" -hex 16)

openssl x509 -req \
    "${OPENSSL_ARGS[@]}" \
    -in druid.csr \
    -CA druid-int22.cert.pem \
    -CAkey druid-int22.key.pem \
    -set_serial "0x$SERIAL_HEX" \
    -out druid.pem \
    -days 365 \
    -sha256 \
    -extfile "$LEAF_EXT_FILE"

# OpenSSL verification chain: intermediate + root.
cat druid-int22.cert.pem ca.cert.pem > "$CA_CHAIN_FILE"

# Certificate reply imported under the existing PrivateKeyEntry.
# Do not include the root CA in the server certificate chain.
cat druid.pem druid-int22.cert.pem > "$DRUID_REPLY_CHAIN_FILE"

openssl verify "${OPENSSL_ARGS[@]}" \
    -CAfile "$CA_CHAIN_FILE" \
    druid.pem

# Temporarily add the issuing certificates to the keystore so keytool can
# establish the certificate-reply chain for the existing private key.
keytool -importcert \
    -alias root-ca \
    -file ca.cert.pem \
    -keystore keystore.jks \
    -storetype JKS \
    -storepass "$TLS_KEYSTORE_PASSWORD" \
    -noprompt

keytool -importcert \
    -alias druid-int-ca \
    -file druid-int22.cert.pem \
    -keystore keystore.jks \
    -storetype JKS \
    -storepass "$TLS_KEYSTORE_PASSWORD" \
    -noprompt

# Replace the temporary self-signed certificate on alias "druid" while
# retaining the private key generated by keytool.
keytool -importcert \
    -alias druid \
    -file "$DRUID_REPLY_CHAIN_FILE" \
    -keystore keystore.jks \
    -storetype JKS \
    -storepass "$TLS_KEYSTORE_PASSWORD" \
    -noprompt

# The CA aliases were needed only to establish the certificate reply.
# Keeping them as separate trustedCertEntry records in the server keystore
# changes Jetty's certificate/SNI discovery. The chain remains attached to
# the "druid" PrivateKeyEntry after these aliases are removed.
keytool -delete \
    -alias root-ca \
    -keystore keystore.jks \
    -storetype JKS \
    -storepass "$TLS_KEYSTORE_PASSWORD"

keytool -delete \
    -alias druid-int-ca \
    -keystore keystore.jks \
    -storetype JKS \
    -storepass "$TLS_KEYSTORE_PASSWORD"

# Trust only the root CA. Peers present the intermediate certificate from
# the chain attached to their "druid" PrivateKeyEntry.
keytool -importcert \
    -alias root-ca \
    -file ca.cert.pem \
    -keystore truststore.jks \
    -storetype JKS \
    -storepass "$TLS_KEYSTORE_PASSWORD" \
    -noprompt

keytool -list -v \
    -keystore keystore.jks \
    -storetype JKS \
    -storepass "$TLS_KEYSTORE_PASSWORD" >/dev/null

keytool -list \
    -keystore truststore.jks \
    -storetype JKS \
    -storepass "$TLS_KEYSTORE_PASSWORD" >/dev/null
