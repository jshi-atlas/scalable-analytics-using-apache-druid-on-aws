## Welcome!

This package will replace the `Authorization` header with the value from `x-auth` as part of the
filter in the authentication chain.

## How to use
- Build the jar `mvn clean` and `mvn package`
- Create directory inside druid extensions path named `druid-xbasic`
- Copy the jar in 'druid-xbasic' directory
- Add `"druid-xbasic"` in extensions list
- add the following properties to `druidCommonRuntimeConfig`:
`{
    "druid.auth.authenticator.xbasic.type": "xbasic",
    "druid.auth.authenticator.xbasic.authorizerName": "xbasic",
    "druid.auth.authorizer.xbasic.type": "xbasic"
}`


