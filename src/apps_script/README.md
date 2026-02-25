# Twenty for Gmail Add-on Scaffold

This folder contains a Gmail add-on scaffold built with Google Apps Script.

## What is included

1. Gmail add-on manifest with contextual trigger.
2. Token-based auth flow using `UserProperties`.
3. Sidebar card flow with:
   - data refresh action,
   - note creation,
   - activity creation,
   - quick-create target entities.
4. Twenty API client helper and operation wrappers.

## Important note about Twenty endpoints

The file `twenty_client.js` now targets the verified REST objects below:

1. `people`
2. `companies`
3. `opportunities`
4. `notes` + `noteTargets`
5. `tasks` + `taskTargets`

In Twenty, activity-like records map to `tasks`.

Before pilot, validate and adjust:

1. Lookup endpoints for person/company/opportunity.
2. Create endpoints for note/task targets in your workspace model.
3. Required payload fields and naming.

## Local setup with clasp

### Repo-level prerequisites

1. Install dependencies from repository root:
   - `npm install`

### Link this folder to your Apps Script project

1. Move into this folder:
   - `cd src/apps_script`
2. Copy clasp config template:
   - `cp .clasp.json.example .clasp.json`
3. Edit `scriptId` inside `.clasp.json`.
   - Use an existing project ID, or create a new project first with:
   - `npm run gas:create` (from repository root)

### Daily commands (from repository root)

1. Login:
   - `npm run gas:login`
2. Push source:
   - `npm run gas:push`
3. Pull source:
   - `npm run gas:pull`
4. Open Apps Script editor:
   - `npm run gas:open`
5. Create a version for deployment:
   - `npm run gas:version`
6. Deploy:
   - `npm run gas:deploy`

## Suggested next implementation step

Start by replacing placeholder operations in `twenty_client.js`
with verified Twenty endpoints, then test:

1. token validation,
2. person/company lookup,
3. note/activity create flow.
