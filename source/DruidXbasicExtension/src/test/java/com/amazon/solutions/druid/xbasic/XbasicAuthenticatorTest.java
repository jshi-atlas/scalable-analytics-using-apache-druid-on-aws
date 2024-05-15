package com.amazon.solutions.druid.xbasic;

import static org.junit.Assert.assertNotNull;

import javax.servlet.Filter;
import org.junit.Test;

public class XbasicAuthenticatorTest {
    private XbasicAuthenticator authenticator;

    @Test
    public void canInitialiseOidcFilter() {
        authenticator = new XbasicAuthenticator();
        Filter oidcFilter = authenticator.getFilter();

        assertNotNull(oidcFilter);
    }
}

