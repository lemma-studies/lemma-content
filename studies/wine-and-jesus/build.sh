#!/bin/bash
# Build the Wine-and-Jesus SCAR analysis PDF.
# Uses the shared theology PDF pipeline — see:
#   Vault/Resources/Publishing/PDF-Pipeline/Theology-PDF-Recipe.md
set -e

VAULT="/mnt/c/Users/timuy/Dropbox/personal/Vault"
HEADER="$VAULT/Resources/Publishing/PDF-Pipeline/hebrew-greek-header.tex"

# Default to current draft version; override with: ./build.sh Wine-and-Jesus-Draft-v0.9
SRC="${1:-Wine-and-Jesus-Draft-v1}"

pandoc "$SRC.md" -o "$SRC.pdf" \
  --pdf-engine=lualatex \
  -V mainfont="DejaVu Serif" \
  -V sansfont="DejaVu Sans" \
  -V monofont="DejaVu Sans Mono" \
  -H "$HEADER"

echo "Built: $SRC.pdf"
echo "Verify Hebrew: pdffonts $SRC.pdf | grep -i hebrew"
