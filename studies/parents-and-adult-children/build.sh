#!/bin/bash
# Build the Parents-and-Adult-Children SCAR analysis PDF.
# Uses the shared theology PDF pipeline — see:
#   Vault/Resources/Publishing/PDF-Pipeline/Theology-PDF-Recipe.md
set -e

VAULT="/mnt/c/Users/timuy/Dropbox/personal/Vault"
HEADER="$VAULT/Resources/Publishing/PDF-Pipeline/hebrew-greek-header.tex"

# Default to current draft version; override with: ./build.sh Parents-and-Adult-Children-Draft-v1.4
SRC="${1:-Parents-and-Adult-Children-Draft-v1.6}"

pandoc "$SRC.md" -o "$SRC.pdf" \
  --pdf-engine=lualatex \
  -V mainfont="DejaVu Serif" \
  -V sansfont="DejaVu Sans" \
  -V monofont="DejaVu Sans Mono" \
  -H "$HEADER"

echo "Built: $SRC.pdf"
echo "Verify Hebrew: pdffonts $SRC.pdf | grep -i hebrew"
