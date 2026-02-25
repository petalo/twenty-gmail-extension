# INSTALL_FROM_ZIP

## Purpose

Install `Twenty for Gmail` from the manual-install ZIP package
using only the browser (no terminal, no `clasp`).

## Audience

This guide is for non-technical users who want to install from source manually in Google Apps Script.

## Prerequisites

1. A Google account with Gmail access.
2. A Twenty API token.
3. The generated manual-install ZIP artifact (`manual-install-latest` or `manual-install-vX`).

## 1) Download the generated manual-install ZIP

1. Open the repository on GitHub.
2. Open `Releases`.
3. Open the latest release.
4. Download `twenty-for-gmail-manual-install-latest.zip`.
5. Extract the downloaded ZIP.

Stable URL pattern (replace `<owner>/<repo>`):

1. `https://github.com/<owner>/<repo>/releases/latest/download/twenty-for-gmail-manual-install-latest.zip`

After extraction, you should have exactly:

1. `Code.gs`
2. `appsscript.json`

## 2) Create a new Apps Script project in browser

1. Open [script.google.com](https://script.google.com/).
2. Click `New project`.
3. Rename the project to `Twenty for Gmail`.

## 3) Enable manifest file

1. In Apps Script editor, click `Project Settings` (gear icon).
2. Enable `Show "appsscript.json" manifest file in editor`.

## 4) Copy files from ZIP into Apps Script

1. In the Apps Script editor, delete the default `Code.gs` file.
2. Create one new script file named `Code.gs`.
3. Paste into that file the full content of `Code.gs` from the ZIP.
4. Open `appsscript.json` in Apps Script and replace its full content
   with `appsscript.json` from the ZIP.
5. Click `Save project`.

Important:

1. Do not paste any API token into source files.
2. Keep both files exactly as delivered by the artifact.

## 5) Install test deployment

1. In Apps Script, click `Deploy` -> `Test deployments`.
2. Click `Install`.
3. Grant requested Google permissions.

## 6) Validate in Gmail

1. Open Gmail and open any email thread.
2. Open `Twenty for Gmail` in the right sidebar.
3. Paste your Twenty API token when requested.
4. Verify:
   - `Refresh` works.
   - `Create note` works.
   - `Create activity` works.
   - quick-create flows work.

## 7) Update from a newer ZIP

1. Download and extract the newer `twenty-for-gmail-manual-install-latest.zip` from the latest release.
2. Open your existing Apps Script project.
3. Replace `Code.gs` and `appsscript.json` with the new content.
4. Save project.
5. In Apps Script, open `Deploy` -> `Manage deployments`.
6. Edit deployment and select the latest version.
7. Save and test again in Gmail.

## Common issues

1. Add-on does not appear in Gmail: reinstall from `Deploy` -> `Test deployments`.
2. Old behavior still appears: update deployment to newest version in `Manage deployments`.
3. Token errors: reset token in the add-on and paste a valid Twenty API token again.
