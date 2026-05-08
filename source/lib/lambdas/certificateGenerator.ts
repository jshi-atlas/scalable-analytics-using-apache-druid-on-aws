/* 
 Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 SPDX-License-Identifier: Apache-2.0
*/

import * as forge from "node-forge";
import * as fs from "fs";
import * as sm from "@aws-sdk/client-secrets-manager";

/* eslint-disable @typescript-eslint/naming-convention */
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceFailedResponse,
  CloudFormationCustomResourceSuccessResponse,
} from "aws-lambda";

import { SDK_CLIENT_CONFIG } from "../utils/constants";

/* eslint-disable @typescript-eslint/no-explicit-any */
(forge as any).options.usePureJavaScript = true;

const secrets = new sm.SecretsManagerClient(SDK_CLIENT_CONFIG);

export async function onEventHandler(
  event: CloudFormationCustomResourceEvent,
): Promise<
  | CloudFormationCustomResourceSuccessResponse
  | CloudFormationCustomResourceFailedResponse
> {
  console.info(`Processing event ${JSON.stringify(event)}`);

  if (event.RequestType === "Create") {
    const { pkcs12Der, pemBundle } = generateCA();

    // Existing PKCS#12 secret
    fs.writeFileSync("/tmp/output.p12", pkcs12Der, "binary"); // NOSONAR (typescript:S5443:directories are used safely here)
    await secrets.send(
      new sm.UpdateSecretCommand({
        SecretId: event.ResourceProperties.TLSSecretId,
        SecretBinary: fs.readFileSync("/tmp/output.p12"), // NOSONAR (typescript:S5443:directories are used safely here)
      }),
    );

    // NEW: PEM bundle secret (cert + AES-encrypted private key) for Ubuntu 22.04 FIPS nodes
    await secrets.send(
      new sm.UpdateSecretCommand({
        SecretId: event.ResourceProperties.TLSSecretIdPem,
        SecretBinary: Buffer.from(pemBundle, "utf-8"),
      }),
    );
  }

  return { ...event, Status: "SUCCESS", PhysicalResourceId: "" };
}

function generateCA(): { pkcs12Der: string; pemBundle: string } {
  const keys = forge.pki.rsa.generateKeyPair(2048);

  const certificate = forge.pki.createCertificate();
  certificate.publicKey = keys.publicKey;
  certificate.validity.notBefore = new Date();
  certificate.validity.notAfter = new Date();

  certificate.validity.notAfter.setDate(
    certificate.validity.notBefore.getDate() + 3650,
  );

  const attributes = [{ name: "commonName", value: "Druid Internal CA" }];
  certificate.setSubject(attributes);
  certificate.setIssuer(attributes);
  certificate.setExtensions([
    {
      name: "basicConstraints",
      cA: true, // Set to true to indicate it's a CA certificate
    },
  ]);

  certificate.sign(keys.privateKey, forge.md.sha256.create());

  // Existing PKCS#12 output
  const p12 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey,
    certificate,
    "changeit",
    {
      friendlyName: "druid",
    },
  );
  const pkcs12Der = forge.asn1.toDer(p12).getBytes();

  // NEW: PEM bundle output (cert + AES-encrypted private key)
  const certPem = forge.pki.certificateToPem(certificate);
  const encryptedKeyPem = forge.pki.encryptRsaPrivateKey(
    keys.privateKey,
    "changeit",
    { algorithm: "aes256" },
  );
  const pemBundle = certPem + encryptedKeyPem;

  return { pkcs12Der, pemBundle };
}
