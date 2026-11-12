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
/* eslint-disable @typescript-eslint/naming-convention */
import Ajv from 'ajv';
import { configScheme } from './configScheme';

const ec2Config = {
    master: { minNodes: 1, maxNodes: 1, instanceType: 'm6g.large' },
    query: { minNodes: 1, maxNodes: 1, instanceType: 'm6g.large' },
    zookeeper: { minNodes: 3, maxNodes: 3, instanceType: 'm6g.large' },
};

function validateEc2Config(druidEc2Config: Record<string, unknown>): boolean {
    const validate = new Ajv({ allowMatchingProperties: true }).compile(configScheme);
    const valid = validate({
        druidVersion: '31.0.2',
        druidOperationPlatform: 'ec2',
        druidClusterName: 'test-cluster',
        druidExtensions: ['druid-kinesis-indexing-service'],
        druidEc2Config,
    });
    return valid;
}

describe('EC2 group configuration', () => {
    it('allows the default data group to be scaled to zero', () => {
        expect(
            validateEc2Config({
                ...ec2Config,
                data: { minNodes: 0, maxNodes: 0, instanceType: 'm6g.large' },
            })
        ).toBe(true);
    });

    it('allows every group to be explicitly scaled to zero', () => {
        expect(
            validateEc2Config({
                ...ec2Config,
                data: { minNodes: 0, maxNodes: 0, instanceType: 'm6g.large' },
                data_tier2: { minNodes: 0, maxNodes: 0, instanceType: 'm6g.large' },
            })
        ).toBe(true);
    });

    it('allows the master group to be explicitly scaled to zero', () => {
        expect(
            validateEc2Config({
                ...ec2Config,
                master: { minNodes: 0, maxNodes: 0, instanceType: 'm6g.large' },
                data: { minNodes: 0, maxNodes: 0, instanceType: 'm6g.large' },
            })
        ).toBe(true);
    });
});
