package com.amazon.solutions.druid.xbasic;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;
import javax.annotation.Nullable;

public class XbasicConfig {
    @JsonProperty("testProperty")
    @Nullable
    private final String testProperty;

    @JsonCreator
    public XbasicConfig(@JsonProperty("testProperty") String testProperty) {
        this.testProperty = testProperty;
    }
}
