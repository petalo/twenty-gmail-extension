# Privacy Policy

Last updated: February 25, 2026

## Overview

Twenty for Gmail is a Google Workspace Gmail add-on that lets a user connect
their own Twenty CRM account and create CRM records from the Gmail sidebar.

## Data Processed

At runtime, the add-on processes:

1. Current Gmail message metadata required for context (sender, subject, message/thread identifiers).
2. User-provided Twenty API token.
3. CRM entity data returned by Twenty API (people, companies, opportunities, notes, tasks, targets).

## Purpose of Data Processing

1. **Message metadata** — used to identify the email sender and look up matching CRM records.
2. **API token** — used to authenticate requests to the user's Twenty CRM workspace.
3. **CRM data** — used to display matching records in the sidebar
   and create new records as requested by the user.

## Data Storage

1. Twenty API token is stored in Google Apps Script `UserProperties` for the current user.
2. Short-lived cache entries are stored in Apps Script `CacheService` to reduce repeated API calls.
3. Recent company selections are stored in `UserProperties` for UX convenience.

The project does not operate a separate custom backend database.

## Data Sharing

Data is sent only to:

1. Google APIs required to run the add-on.
2. Twenty API (`https://api.twenty.com`) for CRM read/write operations initiated by the user.

## Permissions Requested

The add-on requests the following OAuth scopes:

1. `gmail.addons.execute` — run the add-on in Gmail.
2. `gmail.addons.current.message.metadata` — read sender and subject of the open email.
3. `script.external_request` — make HTTPS requests to Twenty API.
4. `userinfo.email` — identify the current user for per-user token storage.

## Data Retention and Control

1. Users can remove their token from the add-on using `Reset token`.
2. Cached entries expire automatically based on configured TTL values in `src/apps_script/constants.js`.
3. CRM records created through the add-on remain in the user's Twenty workspace until removed there.

## User Rights

1. Users can remove their API token at any time using the "Reset token" button.
2. Users can uninstall the add-on from Gmail settings, which removes all stored data (`UserProperties`).
3. CRM data created through the add-on lives in the user's own Twenty workspace and can be managed there.
4. No data is retained after uninstallation — the add-on does not maintain any external database.

## Security

1. API requests are sent over HTTPS.
2. Request logging excludes sensitive auth values (check `src/apps_script/logging.js`).
3. The manifest uses `urlFetchWhitelist` to limit outbound requests to only the Twenty API host.

## Compliance

1. The add-on processes minimal data and stores nothing beyond the user's own API token and UI preferences.
2. All data processing occurs within Google's infrastructure
   (Apps Script) and the user's own Twenty CRM workspace.
3. The add-on does not collect analytics, does not use tracking,
   and does not share data with any third party besides the user's
   own Twenty CRM instance.

## Contact

For privacy questions, open an issue at:
`https://github.com/petalo/twenty-gmail-extension/issues`
