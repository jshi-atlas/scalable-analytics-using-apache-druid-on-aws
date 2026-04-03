#!/bin/bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# One-time migration: copy existing Druid CA from PKCS#12 (Secrets Manager) to PEM bundle format for Ubuntu 22.04 FIPS nodes.
# Run from a workstation or CI with AWS CLI and OpenSSL (not on a FIPS-restricted host if pkcs12 fails there).
# usage: migrate_ca_p12_to_ca_crt_enc.sh SOURCE_TLS_SECRET_NAME DEST_TLS_SECRET_NAME_PEM [AWS_REGION] [KMS_KEY_ID]

set -euo pipefail

if [ "$#" -lt 2 ] || [ "$#" -gt 4 ]; then
    echo "Usage: $0 SOURCE_TLS_SECRET_NAME DEST_TLS_SECRET_NAME_PEM [AWS_REGION] [KMS_KEY_ID]"
    exit 1
fi

SOURCE_TLS_SECRET_NAME="$1"
DEST_TLS_SECRET_NAME_PEM="$2"
AWS_REGION="${3:-}"
KMS_KEY_ID="${4:-}"

AWS_ARGS=()
if [ -n "$AWS_REGION" ]; then
    AWS_ARGS+=(--region "$AWS_REGION")
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
cd "$WORKDIR"

aws "${AWS_ARGS[@]}" secretsmanager get-secret-value \
    --secret-id "$SOURCE_TLS_SECRET_NAME" \
    --query SecretBinary \
    --output text | base64 --decode > ca.p12

openssl pkcs12 -in ca.p12 -clcerts -nokeys -out ca.cert.pem -passin pass:changeit
openssl pkcs12 -in ca.p12 -nocerts -nodes -out ca.key.pem -passin pass:changeit
openssl pkey -in ca.key.pem -aes256 -passout pass:changeit -out ca.key.enc.pem
cat ca.cert.pem ca.key.enc.pem > ca.crt.enc

if aws "${AWS_ARGS[@]}" secretsmanager describe-secret --secret-id "$DEST_TLS_SECRET_NAME_PEM" >/dev/null 2>&1; then
    aws "${AWS_ARGS[@]}" secretsmanager update-secret \
        --secret-id "$DEST_TLS_SECRET_NAME_PEM" \
        --secret-binary "fileb://$WORKDIR/ca.crt.enc"
else
    if [ -n "$KMS_KEY_ID" ]; then
        aws "${AWS_ARGS[@]}" secretsmanager create-secret \
            --name "$DEST_TLS_SECRET_NAME_PEM" \
            --kms-key-id "$KMS_KEY_ID" \
            --secret-binary "fileb://$WORKDIR/ca.crt.enc"
    else
        aws "${AWS_ARGS[@]}" secretsmanager create-secret \
            --name "$DEST_TLS_SECRET_NAME_PEM" \
            --secret-binary "fileb://$WORKDIR/ca.crt.enc"
    fi
fi

echo "Migration complete: PEM bundle stored in secret $DEST_TLS_SECRET_NAME_PEM"
