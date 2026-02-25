<p align="center">
  <img src="assets/logo/twenty-extension-addon-logo-128.png" alt="Twenty for Gmail" width="80" />
</p>

<h1 align="center">Twenty for Gmail</h1>

<p align="center">
  A Gmail add-on that brings your <a href="https://twenty.com">Twenty CRM</a> data into your inbox sidebar.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/runtime-Google%20Apps%20Script-4285F4?logo=google"
  alt="Google Apps Script" />
  <!-- Uncomment after Marketplace listing is live:
  <a href="https://workspace.google.com/marketplace/app/twenty_for_gmail/REPLACE_APP_ID">
  <img src="https://img.shields.io/badge/Google%20Workspace-Marketplace-4285F4?logo=google"
  alt="Google Workspace Marketplace" /></a>
  -->
</p>

---

## Features

- **Sender lookup** — automatically finds the person, company, and opportunities linked to the
  email sender.
- **Notes** — create Markdown notes attached to any matched entity.
- **Activities** — create tasks with optional due dates, linked to a person, company, or opportunity.
- **Quick create** — add new people, companies, or opportunities directly from the sidebar when no
  match is found.
- **Company search** — search your Twenty workspace for companies by name or domain.
- **Per-user auth** — each user connects their own Twenty API token, stored securely in Google UserProperties.

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Authenticate with Apps Script**

   ```bash
   npm run gas:login
   ```

3. **Create or bind a script project**

   ```bash
   npm run gas:create
   # or configure src/apps_script/.clasp.json manually
   ```

4. **Push and install**

   ```bash
   npm run gas:push
   npm run gas:open   # opens the Apps Script editor
   ```

   Then in the Apps Script editor: **Deploy → Test deployments → Install**.

5. **Open any email in Gmail** — the Twenty sidebar appears automatically.

For the full setup walkthrough, see [INSTALL.md](INSTALL.md). For update instructions, see [UPDATE.md](UPDATE.md).

## Development

### Source structure

```text
src/apps_script/
├── appsscript.json    # Add-on manifest (scopes, triggers)
├── main.js            # Entry point, sidebar state orchestration
├── actions.js         # User action handlers (save token, create note, etc.)
├── ui.js              # CardService card and widget builders
├── twenty_client.js   # Twenty REST API client
├── auth.js            # Token persistence and validation
├── context.js         # Gmail event parsing and message context
├── validation.js      # Input validators and string helpers
├── utils.js           # Shared company/domain utilities
├── logging.js         # Structured logging helpers
└── constants.js       # Configuration constants and enums
```

### Lint and format

This project uses [Biome](https://biomejs.dev) for linting and formatting.

```bash
npm run lint          # check for lint errors
npm run lint:fix      # auto-fix lint errors
npm run format        # auto-format all source files
npm run format:check  # check formatting without modifying files
npm run test          # lint + unit tests
```

### clasp commands

| Command                                     | Description                                                   |
| ------------------------------------------- | ------------------------------------------------------------- |
| `npm run gas:push`                          | Push local source to Apps Script                              |
| `npm run gas:pull`                          | Pull remote source to local                                   |
| `npm run gas:open`                          | Open the Apps Script editor                                   |
| `npm run gas:logs`                          | Tail Apps Script execution logs                               |
| `npm run gas:version`                       | Create a new version                                          |
| `npm run gas:deploy`                        | Deploy the latest version                                     |
| `npm run build:manual-install -- <version>` | Build `build/` manual package (`Code.gs` + `appsscript.json`) |

## Architecture

The add-on runs entirely on Google Apps Script (server-side V8
JavaScript). There is no bundler or transpiler — source files are
pushed directly via [clasp](https://github.com/google/clasp).

**Data flow:** Gmail contextual trigger → `buildMessageHome` →
sidebar state loading (person → company → opportunities) →
CardService card rendering → user actions → Twenty REST API.

All API calls go through `requestTwenty()` in `twenty_client.js`,
which handles authentication headers, error normalization, and
response parsing. Sidebar state is cached per-message using
`CacheService` to reduce redundant API calls.

## Documentation

| Document                                         | Purpose                                        |
| ------------------------------------------------ | ---------------------------------------------- |
| [INSTALL_FROM_GITHUB.md](INSTALL_FROM_GITHUB.md) | Install from repository clone                  |
| [INSTALL_FROM_ZIP.md](INSTALL_FROM_ZIP.md)       | Browser-only install from generated manual ZIP |
| [UPDATE.md](UPDATE.md)                           | How to update an existing deployment           |
| [PRIVACY.md](PRIVACY.md)                         | Data handling and privacy policy               |
| [SUPPORT.md](SUPPORT.md)                         | Support and issue reporting channels           |
| [docs/contracts/](docs/contracts/)               | Twenty API contract reference                  |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and PR guidelines.
By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

- Never commit `src/apps_script/.clasp.json` (contains script ID). Use `.clasp.json.example` as a template.
- Never commit API tokens or secrets.
- Rotate test tokens after manual integration sessions.
- The add-on requests the `script.external_request` OAuth scope,
  which allows outbound HTTP requests to any host. This broad scope
  is locked down at the manifest level by `urlFetchWhitelist` in
  `appsscript.json`, which restricts actual requests to the Twenty
  API domain only.
- For security reporting, follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

---
