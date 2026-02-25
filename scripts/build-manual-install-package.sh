#!/usr/bin/env bash
# =============================================================================
# build-manual-install-package.sh
#
# Builds a ZIP package for manual installation of the Twenty for Gmail add-on
# via the Google Apps Script editor (without clasp).
#
# USAGE
#   ./scripts/build-manual-install-package.sh [VERSION]
#   npm run build:manual-install [-- VERSION]
#
# ARGUMENTS
#   VERSION   Optional. Semantic version label embedded in the output filename
#             (e.g. "1.2.0"). Defaults to "dev" when omitted.
#
# OUTPUT
#   build/manual-install/
#     Code.gs            — all source files concatenated in dependency order
#     appsscript.json    — add-on manifest (copied from src/apps_script/)
#
#   build/
#     twenty-for-gmail-manual-install-v<VERSION>.zip   — versioned package
#     twenty-for-gmail-manual-install-latest.zip       — always the latest build
#
# HOW TO INSTALL
#   1. Open script.google.com and create a new project (or open an existing one).
#   2. In the editor menu: Project Settings → "Show appsscript.json manifest".
#   3. Replace the editor contents with Code.gs and appsscript.json from the ZIP,
#      or upload via File → Import.
#
# NOTES
#   - Source files are concatenated in the order declared in SOURCE_FILES.
#     This order matters: dependencies must appear before their consumers
#     (e.g. constants → validation → utils → … → main).
#   - The output Code.gs is auto-generated. Do not edit it directly.
#   - build/ is git-ignored. Run this script to regenerate at any time.
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_DIR="$ROOT_DIR/src/apps_script"
BUILD_DIR="$ROOT_DIR/build/manual-install"
VERSION_LABEL="${1:-dev}"
ZIP_FILE_VERSIONED="$ROOT_DIR/build/twenty-for-gmail-manual-install-v${VERSION_LABEL}.zip"
ZIP_FILE_LATEST="$ROOT_DIR/build/twenty-for-gmail-manual-install-latest.zip"
CODE_FILE="$BUILD_DIR/Code.gs"
MANIFEST_FILE="$BUILD_DIR/appsscript.json"
INSTALL_FILE="$BUILD_DIR/INSTALL_FROM_ZIP.md"

# ---------------------------------------------------------------------------
# Source files — concatenation order reflects dependency graph:
#   constants → validation → utils → logging → twenty_client → auth
#   → context → ui → actions → main
# ---------------------------------------------------------------------------
SOURCE_FILES=(
  "constants.js"
  "validation.js"
  "utils.js"
  "logging.js"
  "twenty_client.js"
  "auth.js"
  "context.js"
  "ui.js"
  "actions.js"
  "main.js"
)

# ---------------------------------------------------------------------------
# 1. Prepare build directory and reset output file
# ---------------------------------------------------------------------------
mkdir -p "$BUILD_DIR"
: > "$CODE_FILE"

{
  echo "/**"
  echo " * Auto-generated file."
  echo " * Source: src/apps_script/*.js"
  echo " * Do not edit directly."
  echo " */"
} >> "$CODE_FILE"

# ---------------------------------------------------------------------------
# 2. Concatenate source files into Code.gs
# ---------------------------------------------------------------------------
for source_file in "${SOURCE_FILES[@]}"; do
  input_file="$SOURCE_DIR/$source_file"
  if [ ! -f "$input_file" ]; then
    echo "Missing source file: $input_file" >&2
    exit 1
  fi

  {
    echo
    echo "// ----- BEGIN $source_file -----"
    echo
  } >> "$CODE_FILE"

  cat "$input_file" >> "$CODE_FILE"

  {
    echo
    echo "// ----- END $source_file -----"
    echo
  } >> "$CODE_FILE"
done

# ---------------------------------------------------------------------------
# 3. Copy manifest and package both files into the ZIP
# ---------------------------------------------------------------------------
cp "$SOURCE_DIR/appsscript.json" "$MANIFEST_FILE"
cp "$ROOT_DIR/INSTALL_FROM_ZIP.md" "$INSTALL_FILE"
rm -f "$ZIP_FILE_VERSIONED" "$ZIP_FILE_LATEST"

(
  cd "$BUILD_DIR"
  zip -q "$ZIP_FILE_VERSIONED" "Code.gs" "appsscript.json" "INSTALL_FROM_ZIP.md"
)

# latest is always a copy of the most recent versioned build
cp "$ZIP_FILE_VERSIONED" "$ZIP_FILE_LATEST"

# ---------------------------------------------------------------------------
# 4. Report
# ---------------------------------------------------------------------------
echo "Generated:"
echo "- $CODE_FILE"
echo "- $MANIFEST_FILE"
echo "- $INSTALL_FILE"
echo "- $ZIP_FILE_VERSIONED"
echo "- $ZIP_FILE_LATEST"
