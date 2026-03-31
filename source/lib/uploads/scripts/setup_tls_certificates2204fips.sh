#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# TLS bootstrap for Ubuntu 22.04 with FIPS enabled: avoids runtime openssl pkcs12 on the CA bundle.
# Expects Secrets Manager SecretBinary: PEM CA certificate concatenated with AES-encrypted CA private key (password changeit).
# usage: setup_tls_certificates2204fips.sh TLS_CERT_HOME TLS_CERTIFICATE_SECRET_NAME_PEM TLS_KEYSTORE_PASSWORD

if [ "$#" -ne 3 ]; then
    echo "Usage: $0 TLS_CERT_HOME TLS_CERTIFICATE_SECRET_NAME_PEM TLS_KEYSTORE_PASSWORD"
    exit 1
fi

TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
HOSTNAME=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/hostname)

TLS_CERT_HOME="$1"
TLS_CERTIFICATE_SECRET_NAME_PEM="$2"
TLS_KEYSTORE_PASSWORD="$3"

mkdir -p "$TLS_CERT_HOME"
cd "$TLS_CERT_HOME" || exit 1

aws secretsmanager get-secret-value --secret-id "$TLS_CERTIFICATE_SECRET_NAME_PEM" --output text --query SecretBinary | base64 --decode > ca.crt.enc

openssl pkey -in ca.crt.enc -out ca.key -passin pass:changeit
openssl x509 -in ca.crt.enc -out ca.cert.pem

keytool -genkeypair -alias druid -keyalg RSA -keysize 2048 -keystore keystore.jks -storetype JKS -storepass "$TLS_KEYSTORE_PASSWORD" -keypass "$TLS_KEYSTORE_PASSWORD" -dname "CN=$HOSTNAME" -validity 365 -noprompt
keytool -certreq -alias druid -keystore keystore.jks -storepass "$TLS_KEYSTORE_PASSWORD" -file druid.csr

openssl x509 -req -in druid.csr -CA ca.cert.pem -CAkey ca.key -CAcreateserial -out druid.pem -days 365 -sha256
cat druid.pem ca.cert.pem > druid-chain.pem

keytool -importcert -file ca.cert.pem -alias druid-ca -keystore keystore.jks -storepass "$TLS_KEYSTORE_PASSWORD" -noprompt
keytool -importcert -file druid-chain.pem -alias druid -keystore keystore.jks -storepass "$TLS_KEYSTORE_PASSWORD" -noprompt

keytool -importcert -file ca.cert.pem -alias druid-ca -keystore truststore.jks -deststorepass "$TLS_KEYSTORE_PASSWORD" -noprompt

rm -f druid.csr druid.pem druid-chain.pem ca.crt.enc ca.cert.pem ca.key ./*.srl

cd - >/dev/null || true
