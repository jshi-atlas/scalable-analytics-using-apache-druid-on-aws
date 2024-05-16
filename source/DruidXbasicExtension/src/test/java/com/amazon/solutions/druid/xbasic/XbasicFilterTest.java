package com.amazon.solutions.druid.xbasic;

import static org.junit.Assert.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import javax.servlet.FilterChain;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import org.junit.Before;
import org.junit.Test;

public class XbasicFilterTest {
    HttpServletRequest request;
    HttpServletResponse response;
    FilterChain filterChain;

    @Before
    public void setUp() {
        request = mock(HttpServletRequest.class);
        response = mock(HttpServletResponse.class);
        filterChain = mock(FilterChain.class);

    }
    @Test
    public void filterModifiesAuthHeaderIfXAuthIsSet() throws Exception {
        String xAuthHeader = "x-auth header";
        when(request.getHeader("x-auth")).thenReturn(xAuthHeader);

        XbasicFilter filter = new XbasicFilter();
        filter.doFilter(request, response, filterChain);

        assertEquals(filter.getRequestWrapper().getHeader("Authorization"), xAuthHeader);
    }

    @Test
    public void filterDoesNotModifyAuthHeaderIfXAuthNotSet() throws Exception {
        String authHeader = "auth header";
        when(request.getHeader("Authorization")).thenReturn("auth header");
        FilterChain filterChain = mock(FilterChain.class);

        XbasicFilter filter = new XbasicFilter();
        filter.doFilter(request, response, filterChain);

        assertEquals(filter.getRequestWrapper().getHeader("x-auth"), null);
        assertEquals(filter.getRequestWrapper().getHeader("Authorization"), authHeader);
    }
}
