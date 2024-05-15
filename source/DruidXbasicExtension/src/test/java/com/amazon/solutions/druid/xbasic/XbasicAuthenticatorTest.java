package com.amazon.solutions.druid.xbasic;

import static org.junit.Assert.assertNotNull;
import static org.mockito.Mockito.mock;

import javax.servlet.Filter;
import org.junit.Test;

public class XbasicAuthenticatorTest {
    private XbasicAuthenticator authenticator;
    private XbasicConfig xbasicConfig;

    @Test
    public void canInitialiseOidcFilter() {
        xbasicConfig = mock(XbasicConfig.class);
        authenticator = new XbasicAuthenticator("name", "authorizerName", xbasicConfig);
        Filter oidcFilter = authenticator.getFilter();

        assertNotNull(oidcFilter);
    }
}

