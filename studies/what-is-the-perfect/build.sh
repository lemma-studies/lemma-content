#!/bin/bash
# Build the What-Is-the-Perfect SCAR analysis PDF.
# Uses the shared theology PDF pipeline — see:
#   Vault/Resources/Publishing/PDF-Pipeline/Theology-PDF-Recipe.md
set -e

VAULT="/mnt/c/Users/timuy/Dropbox/personal/Vault"
HEADER="$VAULT/Resources/Publishing/PDF-Pipeline/hebrew-greek-header.tex"

# Default to current draft version; override with: ./build.sh What-Is-the-Perfect-v1
SRC="${1:-What-Is-the-Perfect-v2}"

pandoc "$SRC.md" -o "$SRC.pdf" \
  --pdf-engine=lualatex \
  -V mainfont="DejaVu Serif" \
  -V sansfont="DejaVu Sans" \
  -V monofont="DejaVu Sans Mono" \
  -H "$HEADER" \
  -H table-layout.tex

echo "Built: $SRC.pdf"
python3 ~/Projects/gig8/lemma/scripts/pdf-collision-check.py "$SRC.pdf" || echo "WARNING: text collisions detected — inspect before release"
echo "Verify Hebrew: pdffonts $SRC.pdf | grep -i hebrew"
