import { normalize, wordDiff } from './verify-scripture.js';

// Canonicalize a rabbinic source line to a Sefaria API ref.
// Examples:
//   "b. Kiddushin 29a"      → "Kiddushin.29a"
//   "b. Kiddushin 31b"      → "Kiddushin.31b"
//   "y. Peah 1:1"           → "Jerusalem_Talmud_Peah.1.1"
//   "Kiddushin 41a"         → "Kiddushin.41a"
//   "Mishnah Pesachim 10:1" → "Mishnah_Pesachim.10.1"
//   "Sanhedrin 71a"         → "Sanhedrin.71a"
export function toSefariaRef(sourceLine) {
  const s = sourceLine.replace(/[*_`]/g, '');
  let m;
  if ((m = s.match(/y\.?\s+([A-Z][a-zA-Z_]+)\s+(\d+):(\d+)/))) {
    return `Jerusalem_Talmud_${m[1]}.${m[2]}.${m[3]}`;
  }
  if ((m = s.match(/mishnah\s+([A-Z][a-zA-Z_]+)\s+(\d+):(\d+)/i))) {
    return `Mishnah_${m[1]}.${m[2]}.${m[3]}`;
  }
  if ((m = s.match(/(?:b\.?\s+)?([A-Z][a-zA-Z_]+)\s+(\d+[ab])/))) {
    return `${m[1]}.${m[2]}`;
  }
  return null;
}

const SEFARIA_BASE = 'https://www.sefaria.org/api/texts/';

async function fetchSefaria(ref) {
  const url = `${SEFARIA_BASE}${encodeURIComponent(ref)}?context=0`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'lemma-verify-quotes/0.1 (research; contact: torque@gmail.com)' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// The Sefaria API returns { he: string[]|string, text: string[]|string, ... }.
// Flatten to a single string per language.
function flattenText(t) {
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) return t.flat(Infinity).filter(Boolean).join(' ');
  return '';
}

// Strip HTML tags Sefaria embeds in English (e.g. <i>).
function stripHtml(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function verifyRabbinic(quoteObj) {
  const ref = toSefariaRef(quoteObj.sourceLine || '');
  if (!ref) {
    return {
      verdict: 'unroutable_rabbinic',
      reason: `Could not parse Sefaria ref from "${quoteObj.sourceLine}"`,
      quote: quoteObj,
    };
  }
  const data = await fetchSefaria(ref);
  if (!data) {
    return {
      verdict: 'fetch_failed',
      reason: `Sefaria API did not return for ref "${ref}"`,
      ref,
      quote: quoteObj,
    };
  }
  const english = stripHtml(flattenText(data.text));
  const hebrew = stripHtml(flattenText(data.he));

  const normQuote = normalize(quoteObj.quote);
  const normEng = normalize(english);
  // Full match
  if (normEng.includes(normQuote)) {
    return {
      verdict: 'verbatim_clean',
      ref,
      sefaria_url: `https://www.sefaria.org/${ref}`,
      english,
      quote: quoteObj,
    };
  }
  // Sliding-window fuzzy match over the CONTIGUOUS word sequence (filtering
  // short words from the needle but not the haystack guarantees a miss).
  const words = normQuote.split(' ').filter(Boolean);
  const win = Math.min(8, words.length);
  let hit = null;
  for (let start = 0; start + win <= words.length; start++) {
    const phrase = words.slice(start, start + win).join(' ');
    if (normEng.includes(phrase)) {
      hit = phrase;
      break;
    }
  }
  if (hit) {
    return {
      verdict: 'wording_variance',
      ref,
      sefaria_url: `https://www.sefaria.org/${ref}`,
      hit_phrase: hit,
      english,
      hebrew,
      diff: wordDiff(normEng, normQuote),
      quote: quoteObj,
    };
  }
  return {
    verdict: 'absent',
    ref,
    sefaria_url: `https://www.sefaria.org/${ref}`,
    reason: 'No distinctive phrase from the quote was found in the Sefaria text. May be a composite of multiple translations or a fabrication.',
    quote: quoteObj,
  };
}
