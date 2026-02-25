# INSTALL_FROM_GITHUB

## Purpose

Install and run `Twenty for Gmail` starting from a GitHub clone.

## Prerequisites

1. Node.js 18+ and npm.
2. A Google account with access to Apps Script and Gmail.
3. A Twenty API token for runtime testing.
4. Git installed locally.

## 1) Clone the repository

```bash
git clone https://github.com/petalo/twenty-gmail-extension.git
cd twenty-gmail-extension
```

## 2) Install dependencies

```bash
npm install
```

## 3) Authenticate `clasp`

```bash
npm run gas:login
```

## 4) Bind local code to an Apps Script project

Choose one option.

### Option A: Create a new Apps Script project

```bash
npm run gas:create
```

### Option B: Bind to an existing Apps Script project

```bash
cp src/apps_script/.clasp.json.example src/apps_script/.clasp.json
```

Then edit `src/apps_script/.clasp.json` and set the target `scriptId`.

## 5) Push source code

```bash
npm run gas:push
```

## 6) Install a test deployment

1. Open Apps Script editor:

   ```bash
   npm run gas:open
   ```

2. In Apps Script UI: `Deploy` -> `Test deployments` -> `Install`.
3. Accept requested Google permissions.

## 7) Validate in Gmail

1. Open any email thread in Gmail.
2. Open `Twenty for Gmail` from the right sidebar.
3. Paste your Twenty API token when prompted.
4. Confirm basic actions:
   - `Refresh`,
   - `Create note`,
   - `Create activity`,
   - quick create entity flow.

## 8) Optional local quality checks

```bash
npm run lint
npm run test
```

## Security notes

1. Do not commit `src/apps_script/.clasp.json`.
2. Do not commit API tokens.
3. Rotate test tokens if they were exposed.
