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
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Template } from "aws-cdk-lib/assertions";

import { AuroraMetadataStore } from "../auroraMetadataStore";
import { MetadataStoreType } from "../../utils/types";

test("sets DBInstanceParameterGroupName on cluster when configured", () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "TestStack");
  const vpc = new ec2.Vpc(stack, "Vpc", { natGateways: 0 });
  const securityGroup = new ec2.SecurityGroup(stack, "SecurityGroup", { vpc });

  new AuroraMetadataStore(stack, "MetadataStore", {
    vpc,
    trafficSourceSecGrp: securityGroup,
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    druidClusterName: "test-cluster",
    druidMetadataStoreConfig: {
      metadataStoreType: MetadataStoreType.AURORA,
      metadataStoreConfig: {
        rdsInstanceCount: 2,
        rdsEngineVersion: "16.13",
        rdsParameterGroupName: "metadata-store-psql16-parameters",
      },
    },
  });

  Template.fromStack(stack).hasResourceProperties("AWS::RDS::DBCluster", {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    DBInstanceParameterGroupName: "metadata-store-psql16-parameters",
    // eslint-disable-next-line @typescript-eslint/naming-convention
    EngineVersion: "16.13",
  });
});
