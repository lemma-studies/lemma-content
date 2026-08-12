import { readFileSync, existsSync } from 'node:fs';
import { FABRICATION_FINGERPRINT_PATH } from './config.js';

// Load the fingerprint list from the skill's reference doc.
// The doc format has a markdown table with rows like:
//   | `pattern text` | first-surfaced context | author fabricated against |
// We extract the first backtick-quoted phrase per row.
export function loadFingerprints() {
  if (!existsSync(FABRICATION_FINGERPRINT_PATH)) return [];
  const md = readFileSync(FABRICATION_FINGERPRINT_PATH, 'utf8');
  const patterns = [];
  for (const line of md.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    // Skip header/separator rows
    if (line.match(/^\|\s*(Pattern|-{3,})/i)) continue;
    // First backtick-delimited phrase
    const m = line.match(/`([^`]+)`/);
    if (m) patterns.push(m[1].trim());
  }
  return patterns;
}

// Scan all extracted quotes for fingerprint matches.
export function scanFingerprints(quotes, fingerprints = loadFingerprints()) {
  const hits = [];
  for (const q of quotes) {
    const hay = q.quote.toLowerCase();
    for (const pat of fingerprints) {
      // Split on `…` which appears in some multi-part patterns
      const parts = pat.split(/\s*…\s*/).map((p) => p.toLowerCase().trim()).filter(Boolean);
      if (parts.length === 1) {
        if (hay.includes(parts[0].toLowerCase())) {
          hits.push({ quote: q, pattern: pat });
        }
      } else {
        // All parts must appear in order
        let idx = 0;
        let ok = true;
        for (const part of parts) {
          const nextIdx = hay.indexOf(part, idx);
          if (nextIdx < 0) { ok = false; break; }
          idx = nextIdx + part.length;
        }
        if (ok) hits.push({ quote: q, pattern: pat });
      }
    }
  }
  return hits;
}
