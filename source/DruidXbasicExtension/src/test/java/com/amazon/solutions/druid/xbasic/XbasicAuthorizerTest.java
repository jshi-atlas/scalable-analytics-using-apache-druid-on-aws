
/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
package com.amazon.solutions.druid.xbasic;

import static org.junit.Assert.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;

import org.apache.druid.server.security.Access;
import org.apache.druid.server.security.Action;
import org.apache.druid.server.security.AuthenticationResult;
import org.apache.druid.server.security.Resource;
import org.junit.Before;
import org.junit.Test;

public class XbasicAuthorizerTest {
    private XbasicAuthorizer authorizer;
    private Resource resource;
    private Map<String, Object> context;
    private AuthenticationResult result;

    @Before
    public void setUp() {
        context = new HashMap<>();
        result = mock(AuthenticationResult.class);
        when(result.getContext()).thenReturn(context);
        resource = new Resource("resourceName", "resourceType");

        authorizer = new XbasicAuthorizer();
    }

    @Test
    public void allow_all_requests() {
        // act
        Access access = authorizer.authorize(result, resource, Action.READ);

        // assert
        assertTrue(access.isAllowed());
    }
}