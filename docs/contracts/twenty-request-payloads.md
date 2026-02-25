# Twenty request payloads used by the Gmail add-on

Last verified: **February 23, 2026**.

## Authentication

All requests include:

```http
Authorization: Bearer <TWENTY_API_TOKEN>
Content-Type: application/json
```

Base URL:

```txt
https://api.twenty.com
```

## Read requests

### Find person by sender email

```http
GET /rest/people?limit=5&filter=emails.primaryEmail%5Beq%5D%3Acontact%40acme.com
GET /rest/people?limit=5&filter=email%5Beq%5D%3Acontact%40acme.com
```

Decoded filter:

```txt
emails.primaryEmail[eq]:contact@acme.com
email[eq]:contact@acme.com
```

### Find company by sender domain fallback

```http
GET /rest/companies?limit=5&filter=domainName.primaryLinkUrl%5Bilike%5D%3A%25acme.com%25
GET /rest/companies?limit=5&filter=websiteUrl%5Bilike%5D%3A%25acme.com%25
```

Decoded filter:

```txt
domainName.primaryLinkUrl[ilike]:%acme.com%
websiteUrl[ilike]:%acme.com%
```

### Find opportunities by person or company target

```http
GET /rest/opportunities?limit=20&filter=pointOfContactId%5Beq%5D%3A<PERSON_ID>
GET /rest/opportunities?limit=20&filter=personId%5Beq%5D%3A<PERSON_ID>
GET /rest/opportunities?limit=20&filter=companyId%5Beq%5D%3A<COMPANY_ID>
```

## Write requests

### Quick create person

`POST /rest/people`

```json
{
  "name": {
    "firstName": "Jane",
    "lastName": "Doe"
  },
  "emails": {
    "primaryEmail": "jane@acme.com"
  },
  "companyId": "optional-company-id-or-null"
}
```

### Quick create company

`POST /rest/companies`

```json
{
  "name": "Acme Inc",
  "domainName": {
    "primaryLinkUrl": "https://acme.com"
  }
}
```

### Quick create opportunity

`POST /rest/opportunities`

```json
{
  "name": "Acme - New deal",
  "companyId": "optional-company-id",
  "pointOfContactId": "optional-person-id"
}
```

At least one relation (`companyId` or `pointOfContactId`) is recommended for this integration flow.

### Create note and link it to selected target

Step 1: create note

`POST /rest/notes`

```json
{
  "title": "Gmail note",
  "bodyV2": {
    "markdown": "Message summary captured from Gmail."
  }
}
```

Step 2: link note to target

`POST /rest/noteTargets`

```json
{
  "noteId": "<NOTE_ID>",
  "targetPersonId": "<PERSON_ID>"
}
```

Use exactly one target key:

1. `targetPersonId`
2. `targetCompanyId`
3. `targetOpportunityId`

### Create activity (task) and link it to selected target

Step 1: create task

`POST /rest/tasks`

```json
{
  "title": "Follow up with buyer",
  "bodyV2": {
    "markdown": "Created from Gmail add-on."
  },
  "status": "TODO",
  "dueAt": "2026-03-01"
}
```

Step 2: link task to target

`POST /rest/taskTargets`

```json
{
  "taskId": "<TASK_ID>",
  "targetOpportunityId": "<OPPORTUNITY_ID>"
}
```

Use exactly one target key:

1. `targetPersonId`
2. `targetCompanyId`
3. `targetOpportunityId`

## Delete endpoints used in cleanup/testing

```http
DELETE /rest/people/<ID>
DELETE /rest/companies/<ID>
DELETE /rest/opportunities/<ID>
DELETE /rest/notes/<ID>
DELETE /rest/noteTargets/<ID>
DELETE /rest/tasks/<ID>
DELETE /rest/taskTargets/<ID>
```

## Notes for implementers

1. `Activity` in this integration maps to Twenty `Task`.
2. Person name is a structured object (`firstName`, `lastName`), not a flat string.
3. Company domain is represented via link object (`domainName.primaryLinkUrl`).
