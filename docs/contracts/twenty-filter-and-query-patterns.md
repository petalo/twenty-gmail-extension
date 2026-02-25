# Twenty filter and query patterns

Last verified: **February 23, 2026**.

## Filter format

The REST filter query used by this integration follows:

```txt
filter=<fieldPath>[<operator>]:<value>
```

Examples:

1. `emails.primaryEmail[eq]:contact@acme.com`
2. `companyId[eq]:<COMPANY_ID>`
3. `domainName.primaryLinkUrl[ilike]:%acme.com%`

Always URL-encode the full filter expression before sending.

## Operators observed as supported

Based on API validation error messages and successful calls:

1. `eq`
2. `neq`
3. `in`
4. `containsAny`
5. `is`
6. `gt`
7. `gte`
8. `lt`
9. `lte`
10. `startsWith`
11. `endsWith`
12. `like`
13. `ilike`

## Integration-specific query patterns

### Person lookup by email

```txt
filter=emails.primaryEmail[eq]:<senderEmail>
filter=email[eq]:<senderEmail>
```

### Company lookup by sender domain

```txt
filter=domainName.primaryLinkUrl[ilike]:%<senderDomain>%
filter=websiteUrl[ilike]:%<senderDomain>%
```

### Opportunities lookup by selected target

```txt
filter=pointOfContactId[eq]:<personId>
filter=personId[eq]:<personId>
filter=companyId[eq]:<companyId>
```

## Pagination pattern

Use `limit` and parse cursor block from response:

1. `pageInfo.startCursor`
2. `pageInfo.endCursor`
3. `pageInfo.hasNextPage`
4. `pageInfo.hasPreviousPage`

## Safe query construction rules

1. Build filter string in code.
2. URL-encode with `encodeURIComponent`.
3. Never concatenate raw user input into URL without encoding.
4. Keep default `limit` conservative (`5` for sender lookups, `20` for related records/search).
