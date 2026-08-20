# Intermediate CA for Ubuntu 22.04 FIPS

This document describes how to prepare the intermediate CA bundle required by the Ubuntu 22.04 FIPS TLS bootstrap path.

The deployment expects an existing AWS Secrets Manager secret passed through `custom_secret`. On Ubuntu 22.04 with FIPS enabled, user data passes that secret identifier to `setup_tls_certificates2204fips.sh` as `TLS_INTERMEDIATE_CERTIFICATE_SECRET_NAME`.

Use a cluster- and environment-specific secret name:

```text
druid/tls/<cluster-name>/<environment>/intermediate-ca
```

For example:

```text
druid/tls/cluster1/stage/intermediate-ca
druid/tls/cluster1/prod/intermediate-ca
```

## Implementation contract

The secret must be stored as `SecretBinary` and contain a `tar.gz` archive with exactly these files:

```text
ca.cert.pem
druid-int22.cert.pem
druid-int22.key.pem
```

The bootstrap script uses these files to:

- fetch and unpack the bundle from AWS Secrets Manager,
- validate the root certificate, intermediate certificate, and intermediate key,
- generate a node-local leaf certificate,
- create `keystore.jks`,
- create `truststore.jks`,
- avoid using `ca.p12`, `openssl pkcs12`, or the root private key on Ubuntu 22.04.

`custom_secret` can be either the Secrets Manager secret name or the complete secret ARN. It is required for Ubuntu 22.04 FIPS nodes.

## Assumptions

- The existing root CA is available as `ca.p12`.
- Generate a separate intermediate CA bundle for each existing cluster environment. Stage and prod must be prepared separately because each environment has its own root CA.
- The root private key must stay on the signing host, meaning the Ubuntu 20.04 FIPS host used for root CA operations, and must not be copied to Ubuntu 22.04 nodes.
- The intermediate CA key is generated on Ubuntu 22.04 with FIPS enabled.
- The intermediate CA certificate is signed by the existing root CA on the Ubuntu 20.04 FIPS signing host.
- In the current implementation, `druid-int22.key.pem` is an unencrypted PEM file because the bootstrap script does not accept a key password.

## Naming

- root certificate: `ca.cert.pem`
- root private key: `ca.key.pem`
- intermediate private key: `druid-int22.key.pem`
- intermediate CSR: `druid-int22.csr.pem`
- intermediate certificate: `druid-int22.cert.pem`
- intermediate extensions file: `intermediate.ext`
- bundle archive: `druid-int22-ca-bundle.tar.gz`

## Generate the intermediate CA

Run these steps on a machine running Ubuntu 22.04 with FIPS enabled.

```bash
OPENSSL_ARGS=(-provider fips -provider base)
```

Generate the intermediate CA private key:

```bash
openssl genpkey \
  "${OPENSSL_ARGS[@]}" \
  -algorithm RSA \
  -pkeyopt rsa_keygen_bits:2048 \
  -out druid-int22.key.pem
```

Create the intermediate CSR:

```bash
openssl req \
  "${OPENSSL_ARGS[@]}" \
  -new \
  -sha256 \
  -key druid-int22.key.pem \
  -out druid-int22.csr.pem \
  -subj "/CN=Druid Ubuntu 22.04 FIPS Intermediate CA"
```

Create the intermediate CA extensions file:

```bash
cat > intermediate.ext <<'EOF'
basicConstraints=critical,CA:true,pathlen:0
keyUsage=critical,keyCertSign,cRLSign,digitalSignature
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF
```

Transfer these files to the root CA signing host:

```text
druid-int22.csr.pem
intermediate.ext
```

Do not transfer the root private key to the Ubuntu 22.04 host.

## Sign with the root CA

Run these steps on a machine running Ubuntu 20.04 with FIPS enabled, where the existing root CA private key can be used.

Extract the root certificate and private key from `ca.p12`:

```bash
openssl pkcs12 \
  -in ca.p12 \
  -clcerts \
  -nokeys \
  -out ca.cert.pem \
  -passin pass:changeit

openssl pkcs12 \
  -in ca.p12 \
  -nocerts \
  -nodes \
  -out ca.key.pem \
  -passin pass:changeit
```

Sign the intermediate CSR:

```bash
SERIAL_HEX=$(openssl rand -hex 16)

openssl x509 -req \
  -in druid-int22.csr.pem \
  -CA ca.cert.pem \
  -CAkey ca.key.pem \
  -set_serial "0x$SERIAL_HEX" \
  -out druid-int22.cert.pem \
  -days 3650 \
  -sha256 \
  -extfile intermediate.ext
```

Transfer these files back to the Ubuntu 22.04 FIPS host:

```text
ca.cert.pem
druid-int22.cert.pem
```

Keep `ca.key.pem` on the signing host only.

## Package the bundle

Run this on the Ubuntu 22.04 FIPS host in the directory containing:

```text
ca.cert.pem
druid-int22.cert.pem
druid-int22.key.pem
```

Create the archive:

```bash
tar -czf druid-int22-ca-bundle.tar.gz \
  ca.cert.pem \
  druid-int22.cert.pem \
  druid-int22.key.pem
```

Verify the archive contents:

```bash
tar -tzf druid-int22-ca-bundle.tar.gz
```

Expected output:

```text
ca.cert.pem
druid-int22.cert.pem
druid-int22.key.pem
```

## Store in Secrets Manager

Create a new secret:

```bash
aws secretsmanager create-secret \
  --name "druid/tls/cluster1/stage/intermediate-ca" \
  --description "Druid Ubuntu 22.04 FIPS intermediate CA bundle" \
  --secret-binary fileb://druid-int22-ca-bundle.tar.gz
```

Or update an existing secret:

```bash
aws secretsmanager put-secret-value \
  --secret-id "druid/tls/cluster1/stage/intermediate-ca" \
  --secret-binary fileb://druid-int22-ca-bundle.tar.gz
```

Retrieve the secret identifier:

```bash
aws secretsmanager describe-secret \
  --secret-id "druid/tls/cluster1/stage/intermediate-ca"
```

Use the returned secret name or ARN as `custom_secret` in the deployment configuration.

## Optional validation

Confirm that FIPS OpenSSL providers are available on the Ubuntu 22.04 host:

```bash
openssl version
openssl list -providers
```

Validate the intermediate key:

```bash
openssl pkey \
  "${OPENSSL_ARGS[@]}" \
  -in druid-int22.key.pem \
  -noout \
  -check
```

Verify the intermediate certificate against the root certificate:

```bash
openssl verify \
  "${OPENSSL_ARGS[@]}" \
  -CAfile ca.cert.pem \
  druid-int22.cert.pem
```

Check that the intermediate certificate and private key match:

```bash
CERT_PUB_SHA=$(
  openssl x509 "${OPENSSL_ARGS[@]}" \
    -in druid-int22.cert.pem \
    -noout \
    -pubkey \
  | openssl pkey "${OPENSSL_ARGS[@]}" \
      -pubin \
      -outform DER \
  | openssl sha256 \
  | awk '{print $2}'
)

KEY_PUB_SHA=$(
  openssl pkey "${OPENSSL_ARGS[@]}" \
    -in druid-int22.key.pem \
    -pubout \
    -outform DER \
  | openssl sha256 \
  | awk '{print $2}'
)

test "$CERT_PUB_SHA" = "$KEY_PUB_SHA"
```

Smoke-test reading the secret:

```bash
aws secretsmanager get-secret-value \
  --secret-id "druid/tls/cluster1/stage/intermediate-ca" \
  --query SecretBinary \
  --output text \
  | base64 --decode > downloaded-druid-int22-ca-bundle.tar.gz

mkdir -p downloaded-bundle
tar -xzf downloaded-druid-int22-ca-bundle.tar.gz -C downloaded-bundle
find downloaded-bundle -maxdepth 1 -type f | sort
```

## Operational notes

- The current phase deliberately distributes the intermediate private key to instances. This is an accepted testing compromise, but not the target security model.
- Ultimately, leaf certificate signing should be centralized so that the intermediate private key is not copied to each node.