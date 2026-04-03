/* 
 Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 SPDX-License-Identifier: Apache-2.0
*/
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */

import * as fs from "fs";

import { CloudFormationCustomResourceEvent } from "aws-lambda";
import { onEventHandler } from "./certificateGenerator";

const mockedSecretsManager = jest.fn();

jest.mock("@aws-sdk/client-secrets-manager", () => ({
  ...(jest.requireActual("@aws-sdk/client-secrets-manager") as any),
  SecretsManagerClient: jest.fn().mockImplementation(() => ({
    send: (...args: any[]): any =>
      Promise.resolve(mockedSecretsManager(...args)),
  })),
}));

const event: CloudFormationCustomResourceEvent = {
  ServiceToken: "1234",
  RequestType: "Create",
  ResponseURL: "",
  StackId: "",
  RequestId: "",
  LogicalResourceId: "",
  ResourceType: "",
  ResourceProperties: {
    ServiceToken: "1234",
    TLSSecretId: "SecretId",
    TLSSecretIdPem: "SecretIdPem",
  },
};

describe("onEventHandler", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest
      .spyOn(fs, "readFileSync")
      .mockImplementation(() => Buffer.from("test"));
    jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
  });

  it("can handle create events", async () => {
    // arrange
    mockedSecretsManager.mockResolvedValue({});

    // act
    const result = await onEventHandler(event);

    // assert
    expect(result.Status).toBe("SUCCESS");
  });

  it("writes PKCS#12 secret and PEM bundle secret on Create", async () => {
    // arrange
    mockedSecretsManager.mockResolvedValue({});

    // act
    await onEventHandler(event);

    // assert — two UpdateSecretCommand calls
    expect(mockedSecretsManager).toHaveBeenCalledTimes(2);

    // First call: PKCS#12 secret
    const firstCall = mockedSecretsManager.mock.calls[0][0];
    expect(firstCall.input.SecretId).toBe("SecretId");
    expect(firstCall.input.SecretBinary).toBeDefined();

    // Second call: PEM bundle secret
    const secondCall = mockedSecretsManager.mock.calls[1][0];
    expect(secondCall.input.SecretId).toBe("SecretIdPem");
    expect(secondCall.input.SecretBinary).toBeInstanceOf(Buffer);

    const pemContent = (secondCall.input.SecretBinary as Buffer).toString(
      "utf-8",
    );
    expect(pemContent).toContain("-----BEGIN CERTIFICATE-----");
    expect(pemContent).toContain("-----BEGIN ENCRYPTED PRIVATE KEY-----");
  });

  it("does not write secrets on non-Create events", async () => {
    // arrange
    const updateEvent: CloudFormationCustomResourceEvent = {
      ...event,
      RequestType: "Update",
      PhysicalResourceId: "some-physical-id",
      OldResourceProperties: {},
    };

    // act
    const result = await onEventHandler(updateEvent);

    // assert
    expect(result.Status).toBe("SUCCESS");
    expect(mockedSecretsManager).not.toHaveBeenCalled();
  });
});
