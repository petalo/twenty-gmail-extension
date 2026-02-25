# Twenty API contracts (Gmail add-on)

This folder documents the request/response contracts used by the Gmail add-on integration.

## Files

1. `docs/contracts/twenty-request-payloads.md`
   - Endpoint and payload formats used by the add-on.
   - Minimal request bodies for quick create, note, and activity (task).
2. `docs/contracts/twenty-response-formats.md`
   - Expected response envelopes and object shapes.
   - Error format and pagination fields.
3. `docs/contracts/twenty-filter-and-query-patterns.md`
   - Supported filter syntax patterns used in this integration.
   - URL encoding rules and examples.

## Verification model

These contracts are based on:

1. Official public docs from Twenty.
2. Live validation against `https://api.twenty.com` using workspace
   API key in API playground-style requests.
3. GraphQL introspection of `CreateInput` types for the same workspace.

Last verified: **February 23, 2026**.

## Sources

Official Twenty docs:

1. <https://docs.twenty.com/developers/extend/capabilities/apis>
2. <https://docs.twenty.com/developers/extend/capabilities/webhooks>
3. <https://docs.twenty.com/developers/extend/capabilities/apps>

Additional verification:

1. Live endpoint checks against `https://api.twenty.com/rest/*`.
2. GraphQL introspection against `https://api.twenty.com/graphql` for `CreateInput` types.
3. Context7 skills search was checked on February 23, 2026,
   but no dedicated Twenty API contract skill was used for
   payload generation.

## Important

Twenty APIs are workspace-model aware. Some fields can differ by workspace customizations.
Treat these contracts as the integration baseline and re-validate when data model changes.
