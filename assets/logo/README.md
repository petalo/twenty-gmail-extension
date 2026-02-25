# Logo assets

Generated logo files:

1. `assets/logo/twenty-extension-addon-logo.svg`
2. `assets/logo/twenty-extension-addon-logo-512.png`
3. `assets/logo/twenty-extension-addon-logo-128.png`
4. `assets/logo/twenty-extension-addon-logo-48.png`

## Manifest usage

`appsscript.json` expects a public HTTPS URL for `logoUrl`.

Current value for this repository:

`https://raw.githubusercontent.com/petalo/twenty-gmail-extension/main/assets/logo/twenty-extension-addon-logo-128.png`

If this project is forked, replace the GitHub owner segment with your repository owner.

## Regenerate PNG from SVG

1. From repository root, serve files locally:
   - `python3 -m http.server 4173 --directory .`
2. Open renderer with Playwright CLI:
   - `playwright-cli open http://127.0.0.1:4173/assets/logo/export/render-logo.html`
3. Capture 512 image:
   - `playwright-cli resize 512 512`
   - `playwright-cli screenshot --filename ./assets/logo/twenty-extension-addon-logo-512.png`
4. Resize outputs:
   - `sips -Z 128 ./assets/logo/twenty-extension-addon-logo-512.png --out ./assets/logo/twenty-extension-addon-logo-128.png`
   - `sips -Z 48 ./assets/logo/twenty-extension-addon-logo-512.png --out ./assets/logo/twenty-extension-addon-logo-48.png`
