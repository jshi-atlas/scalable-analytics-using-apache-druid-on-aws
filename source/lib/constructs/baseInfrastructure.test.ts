/* 
  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
  
  Licensed under the Apache License, Version 2.0 (the "License").
  You may not use this file except in compliance with the License.
  You may obtain a copy of the License at
  
      http://www.apache.org/licenses/LICENSE-2.0
  
  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/

import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";

import { BaseInfrastructure } from "./baseInfrastructure";
import { DruidDeepStorageConfig } from "../utils/types";

function synthesizeBaseInfrastructure(
  autoDeleteObjects?: boolean,
  druidDeepStorageConfig?: DruidDeepStorageConfig,
): Template {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "TestStack");

  new BaseInfrastructure(stack, "BaseInfrastructure", {
    druidClusterName: "test-cluster",
    initInstallationBucket: true,
    selfManageInstallationBucketAssets: true,
    autoDeleteObjects,
    druidDeepStorageConfig,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });

  return Template.fromStack(stack);
}

describe("BaseInfrastructure bucket cleanup", () => {
  it("does not add deletion providers unless explicitly enabled", () => {
    const template = synthesizeBaseInfrastructure();

    template.resourceCountIs("Custom::S3AutoDeleteObjects", 0);
  });

  it("adds deletion providers for every solution-owned bucket when enabled", () => {
    const template = synthesizeBaseInfrastructure(true);

    template.resourceCountIs("Custom::S3AutoDeleteObjects", 3);
  });

  it("does not manage objects in an imported deep-storage bucket", () => {
    const template = synthesizeBaseInfrastructure(true, {
      bucketArn: "arn:aws:s3:::externally-managed-deep-storage",
    });

    template.resourceCountIs("Custom::S3AutoDeleteObjects", 2);
  });
});
