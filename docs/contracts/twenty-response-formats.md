# Twenty response formats used by the Gmail add-on

Last verified: **February 23, 2026**.

## Common read response envelope

List endpoints return:

```json
{
  "data": {
    "<pluralObjectName>": []
  },
  "totalCount": 0,
  "pageInfo": {
    "startCursor": null,
    "endCursor": null,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

Examples of `<pluralObjectName>` used in this integration:

1. `people`
2. `companies`
3. `opportunities`
4. `notes`
5. `tasks`
6. `noteTargets`
7. `taskTargets`

## Common create response envelope

Create endpoints return:

```json
{
  "data": {
    "<createOperationName>": {
      "id": "uuid"
    }
  }
}
```

Examples of `<createOperationName>`:

1. `createPerson`
2. `createCompany`
3. `createOpportunity`
4. `createNote`
5. `createTask`
6. `createNoteTarget`
7. `createTaskTarget`

## Common delete response envelope

Delete endpoints return:

```json
{
  "data": {
    "<deleteOperationName>": {
      "id": "uuid"
    }
  }
}
```

## Error response format

Typical REST error:

```json
{
  "statusCode": 400,
  "error": "BadRequestException",
  "messages": [
    "human-readable validation message"
  ]
}
```

The add-on maps these responses to user-safe UI states:

1. `auth_required`
2. `api_error`
3. `rate_limited`

## Object shape references used in code

### Person

Key fields consumed:

1. `id`
2. `name.firstName`
3. `name.lastName`
4. `emails.primaryEmail`
5. `companyId`

### Company

Key fields consumed:

1. `id`
2. `name`
3. `domainName.primaryLinkUrl`

### Opportunity

Key fields consumed:

1. `id`
2. `name`
3. `companyId`
4. `pointOfContactId`
5. `stage`

### Note

Key fields consumed:

1. `id`
2. `title`
3. `bodyV2.markdown`

### Task (activity equivalent)

Key fields consumed:

1. `id`
2. `title`
3. `status`
4. `dueAt`
5. `bodyV2.markdown`

## Target link objects

The link objects define entity association:

### Note target

```json
{
  "noteId": "<NOTE_ID>",
  "targetPersonId": "<PERSON_ID>"
}
```

### Task target

```json
{
  "taskId": "<TASK_ID>",
  "targetOpportunityId": "<OPPORTUNITY_ID>"
}
```

## Parsing notes for the integration layer

1. For list responses, always read records from `data.<pluralObjectName>`.
2. For create/delete responses, read IDs from `data.<operationName>.id`.
3. Do not assume stable object field set across custom workspace models.
