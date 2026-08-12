import { readFileSync, existsSync } from 'node:fs';
import { KJV_JSON_PATH } from './config.js';

// Book-name normalization → the canonical form used by swordkey's kjv-bible.json.
const BOOK_ALIASES = {
  'psalm': 'Psalms',
  'psalms': 'Psalms',
  'ps': 'Psalms',
  'song of solomon': 'Song of Solomon',
  'song': 'Song of Solomon',
  'cant': 'Song of Solomon',
  '1 cor': '1 Corinthians',
  '2 cor': '2 Corinthians',
  '1 thess': '1 Thessalonians',
  '2 thess': '2 Thessalonians',
  '1 tim': '1 Timothy',
  '2 tim': '2 Timothy',
  '1 sam': '1 Samuel',
  '2 sam': '2 Samuel',
  '1 chr': '1 Chronicles',
  '2 chr': '2 Chronicles',
  '1 chron': '1 Chronicles',
  '2 chron': '2 Chronicles',
  '1 pet': '1 Peter',
  '2 pet': '2 Peter',
  '1 jn': '1 John',
  '2 jn': '2 John',
  '3 jn': '3 John',
  '1 kgs': '1 Kings',
  '2 kgs': '2 Kings',
  // Standard single-word abbreviations
  'gen': 'Genesis',
  'ex': 'Exodus',
  'exod': 'Exodus',
  'lev': 'Leviticus',
  'num': 'Numbers',
  'deut': 'Deuteronomy',
  'josh': 'Joshua',
  'judg': 'Judges',
  'neh': 'Nehemiah',
  'esth': 'Esther',
  'prov': 'Proverbs',
  'eccl': 'Ecclesiastes',
  'isa': 'Isaiah',
  'jer': 'Jeremiah',
  'lam': 'Lamentations',
  'ezek': 'Ezekiel',
  'dan': 'Daniel',
  'hos': 'Hosea',
  'obad': 'Obadiah',
  'mic': 'Micah',
  'nah': 'Nahum',
  'hab': 'Habakkuk',
  'zeph': 'Zephaniah',
  'hag': 'Haggai',
  'zech': 'Zechariah',
  'mal': 'Malachi',
  'matt': 'Matthew',
  'mk': 'Mark',
  'lk': 'Luke',
  'jn': 'John',
  'rom': 'Romans',
  'gal': 'Galatians',
  'eph': 'Ephesians',
  'phil': 'Philippians',
  'col': 'Colossians',
  'tit': 'Titus',
  'philem': 'Philemon',
  'heb': 'Hebrews',
  'jas': 'James',
  'rev': 'Revelation',
};

let _kjvCache = null;
function loadKjv() {
  if (_kjvCache) return _kjvCache;
  if (!existsSync(KJV_JSON_PATH)) {
    throw new Error(
      `KJV corpus not found at ${KJV_JSON_PATH}. Set LEMMA_KJV_JSON env or install swordkey.`
    );
  }
  const books = JSON.parse(readFileSync(KJV_JSON_PATH, 'utf8'));
  const byName = new Map();
  for (const b of books) byName.set(b.name.toLowerCase(), b);
  _kjvCache = byName;
  return _kjvCache;
}

function canonicalBook(name) {
  const key = name.trim().replace(/\.$/, '').toLowerCase();
  return (BOOK_ALIASES[key] || name).toLowerCase();
}

// Parse a scripture reference like "1 Corinthians 11:23-25" → { book, chapter, verses:[23,24,25] }
// Supports "John 2:9-10", "Matt 11:19", "Matt. 26:29", "Psalm 104:15", "Prov 23:29-35".
export function parseRef(refText) {
  const m = refText.match(
    /\b((?:[1-3]\s+)?[A-Z][a-z]+\.?(?:\s+of\s+[A-Z][a-z]+)?)\s+(\d+)(?::(\d+)(?:(?:-{1,2}|[–—])(\d+))?((?:,\s*\d+(?:(?:-{1,2}|[–—])\d+)?)*))?/
  );
  if (!m) return null;
  const rawBook = m[1];
  const chapter = parseInt(m[2], 10);
  const vStart = m[3] ? parseInt(m[3], 10) : 1;
  const vEnd = m[4] ? parseInt(m[4], 10) : vStart;
  const book = canonicalBook(rawBook);
  const verses = [];
  for (let v = vStart; v <= vEnd; v++) verses.push(v);
  // Comma-list tail: "7:24, 26" or "2:8, 10-11" — additional verses/ranges in the same chapter.
  if (m[5]) {
    for (const seg of m[5].split(',')) {
      const sm = seg.trim().match(/^(\d+)(?:(?:-{1,2}|[–—])(\d+))?$/);
      if (!sm) continue;
      const s = parseInt(sm[1], 10);
      const e = sm[2] ? parseInt(sm[2], 10) : s;
      for (let v = s; v <= e; v++) if (!verses.includes(v)) verses.push(v);
    }
  }
  return { book, chapter, verses, vStart, vEnd: verses[verses.length - 1], raw: m[0] };
}

// Fetch verse text from swordkey KJV.
export function fetchKjv({ book, chapter, verses }) {
  const kjv = loadKjv();
  const b = kjv.get(book) || kjv.get(canonicalBook(book));
  if (!b) return null;
  const ch = b.chapters.find((c) => String(c.chapter) === String(chapter));
  if (!ch) return null;
  const out = {};
  for (const v of verses) {
    const found = ch.verses.find((x) => String(x.verse) === String(v));
    if (found) out[v] = found.text;
  }
  return out;
}

// Normalize text for comparison — strip whitespace/punctuation runs but preserve
// word tokens. Matches the parents-study normalization: keep the sequence of
// words as the fingerprint; ignore punctuation, case, italics, and Greek/Hebrew
// parentheticals like `(θέλει)`.
export function normalize(s) {
  return s
    .replace(/\([^)]*[^\x00-\x7f][^)]*\)/g, '') // parentheticals with non-ASCII (Greek/Hebrew)
    .replace(/\[[^\]]*\]/g, '') // bracketed editorial
    .replace(/[*_`]/g, '') // markdown emphasis
    .replace(/[’‘]/g, "'") // unify curly single quotes → straight
    .replace(/[“”]/g, '"') // unify curly double quotes → straight
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ') // strip punctuation but keep apostrophes
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Verify a Scripture-track quote against KJV.
// Returns { verdict, reference, expected, actual, diff }.
export function verifyScripture(quoteObj) {
  const refText = quoteObj.sourceLine || quoteObj.quote;
  const parsed = parseRef(refText);
  if (!parsed) {
    return {
      verdict: 'unpin_ref',
      reason: 'Could not parse a scripture reference from the source line.',
      quote: quoteObj,
    };
  }
  const kjvVerses = fetchKjv(parsed);
  if (!kjvVerses || Object.keys(kjvVerses).length === 0) {
    return {
      verdict: 'ref_not_found',
      reason: `KJV corpus has no ${parsed.book} ${parsed.chapter}:${parsed.vStart}-${parsed.vEnd}.`,
      parsed,
      quote: quoteObj,
    };
  }
  const expected = Object.values(kjvVerses).join(' ');
  const actual = quoteObj.quote;

  const normExpected = normalize(expected);
  const normActual = normalize(actual);

  if (normExpected === normActual) {
    return {
      verdict: 'verbatim_clean',
      reference: `${parsed.book} ${parsed.chapter}:${parsed.vStart}${parsed.vEnd !== parsed.vStart ? '-' + parsed.vEnd : ''}`,
      quote: quoteObj,
    };
  }

  // Might be a sub-range (manuscript quotes only part of the cited range).
  if (normExpected.includes(normActual) || normActual.includes(normExpected)) {
    return {
      verdict: 'subset_or_superset',
      reference: `${parsed.book} ${parsed.chapter}:${parsed.vStart}-${parsed.vEnd}`,
      expected,
      actual,
      note: 'Quote is a subset or superset of the cited KJV range; consider tightening the reference.',
      quote: quoteObj,
    };
  }

  // Ellipsis-elided quote: every segment between ellipses must appear in the
  // expected text, in order. An honest "..." elision of a correctly-cited
  // range is clean, not a wording variance.
  if (/\.\.\.|…/.test(actual)) {
    const segs = actual
      .split(/\.\.\.|…/)
      .map((s) => normalize(s))
      .filter(Boolean);
    let cursor = 0;
    let allFound = segs.length > 0;
    for (const seg of segs) {
      const at = normExpected.indexOf(seg, cursor);
      if (at === -1) {
        allFound = false;
        break;
      }
      cursor = at + seg.length;
    }
    if (allFound) {
      return {
        verdict: 'verbatim_elided',
        reference: `${parsed.book} ${parsed.chapter}:${parsed.vStart}-${parsed.vEnd}`,
        note: 'All segments between ellipses match the cited KJV range in order.',
        quote: quoteObj,
      };
    }
  }

  // Compute a word-level diff for the report.
  const diff = wordDiff(normExpected, normActual);
  return {
    verdict: 'wording_variance',
    reference: `${parsed.book} ${parsed.chapter}:${parsed.vStart}-${parsed.vEnd}`,
    expected,
    actual,
    diff,
    quote: quoteObj,
  };
}

// Tiny word-level diff — returns { missing, extra } arrays. Good enough for
// the report; not a full LCS.
export function wordDiff(a, b) {
  const wa = a.split(/\s+/);
  const wb = b.split(/\s+/);
  const setA = new Set(wa);
  const setB = new Set(wb);
  return {
    missing: wa.filter((w) => !setB.has(w)).slice(0, 20),
    extra: wb.filter((w) => !setA.has(w)).slice(0, 20),
  };
}
