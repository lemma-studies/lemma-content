import { readFileSync } from 'node:fs';
import { MIN_INLINE_QUOTE_WORDS } from './config.js';

// ── Track routing ──────────────────────────────────────────────────────────
//
// Given a quote and its attribution/context line, decide which of the four
// tracks verifies it. First match wins. Rules mirror
// ~/.claude/skills/lemma-verify-quotes/references/tracks.md.

const SCRIPTURE_BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalm','Psalms','Proverbs','Ecclesiastes',
  'Song of Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea',
  'Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai',
  'Zechariah','Malachi','Matthew','Mark','Luke','John','Acts','Romans',
  '1 Corinthians','2 Corinthians','1 Cor','2 Cor','Galatians','Ephesians',
  'Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Thess',
  '2 Thess','1 Timothy','2 Timothy','1 Tim','2 Tim','Titus','Philemon','Hebrews',
  'James','1 Peter','2 Peter','1 Pet','2 Pet','1 John','2 John','3 John','Jude',
  'Revelation',
  // Common single-word abbreviations (with or without trailing period in text)
  'Gen','Ex','Exod','Lev','Num','Deut','Josh','Judg','1 Sam','2 Sam','Neh','Ps',
  'Prov','Eccl','Isa','Jer','Lam','Ezek','Dan','Hos','Mic','Nah','Hab','Zeph',
  'Hag','Zech','Mal','Matt','Mk','Lk','Jn','Rom','Gal','Eph','Phil','Col','Tit',
  'Heb','Jas','Rev',
];

const SCRIPTURE_RE = new RegExp(
  `\\b(?:${SCRIPTURE_BOOKS.map((b) => b.replace(/ /g, '\\s+')).join('|')})\\.?\\s+\\d+(?::\\d+)?`,
  'i'
);

const RABBINIC_MARKERS = [
  /\bMishnah\b/i, /\bTalmud\b/i, /\b[by]\.\s+(Kiddushin|Peah|Sanhedrin|Yevamot|Ketubot|Berakhot|Shabbat|Pesachim|Rosh Hashanah|Bava\b)/i,
  /\bSanhedrin\s+\d/i, /\bYevamot\s+\d/i, /\bKiddushin\s+\d/i, /\bKetubot\s+\d/i,
  /\bRashi\b/i, /\bRambam\b/i, /\bYD\s+240\b/i,
  /\bSirach\b/i, /\bBen Sira\b/i,
  /sefaria\.org/i,
];

const PATRISTIC_NAMES = [
  'Justin Martyr','Justin','Irenaeus','Tertullian','Origen','Cyprian','Chrysostom',
  'Augustine','Athanasius','Basil','Ambrose','Jerome','Hippolytus','Clement of Alexandria',
  'Clement of Rome','Polycarp','Ignatius','Barnabas','Didache','Shepherd of Hermas','Hermas',
  'Athenagoras','Eusebius','Passio Perpetuae','Perpetua','Melito','Novatian','Lactantius',
];
const PATRISTIC_WORKS = [
  /\bANF\b/, /\bNPNF²?\b/, /\b1\s*Apol(?:ogy|\.)?\s*\d/i, /\bDialogue\b/, /\bAdv(?:ersus)?\s+Haer/i,
  /\bContra\s+Celsum/i, /\bStromata\b/i, /\bPaedagogus\b/i, /\bDe\s+Baptismo\b/i,
  /\bAd\s+Uxorem\b/i, /\bApolog(?:eticus|y)\b/i, /\bFirst\s+Apology\b/i,
  /\bEp(?:istle|\.)?\s+\d+/i,
];
const PATRISTIC_RE = new RegExp(
  `\\b(?:${PATRISTIC_NAMES.map((n) => n.replace(/ /g, '\\s+')).join('|')})\\b`,
  'i'
);

const MODERN_IMPRINTS = /\b(Crossway|Eerdmans|Baker|Zondervan|Tyndale|Revell|IVP|Fortress|Yale|Cambridge|Oxford|Chicago|Peabody|Grand Rapids|Loeb|Doubleday|Random House|HarperOne|Harper|Simon & Schuster)\b/;
const MODERN_YEAR = /\((?:19|20)\d\d\)/;

const TRACKS = {
  SCRIPTURE: 'scripture',
  PATRISTIC: 'patristic',
  RABBINIC: 'rabbinic',
  MODERN: 'modern',
  AUTHOR_MAXIM: 'author-maxim',
  UNROUTED: 'unrouted',
  INLINE_UNATTRIBUTED: 'inline-unattributed',
};

// A "modern-strong" attribution: page pin, publication year, commentary series,
// or publisher imprint in the ATTRIBUTION LINE. This outranks everything else —
// a modern book quoted with a page pin routes modern even when the quote body
// (or the book's own title, e.g. "Genesis 1-15") contains scripture-shaped refs.
const MODERN_STRONG = /\bpp?\.\s*\d|\((?:19|20)\d\d\)|\b(?:WBC|ICC|NICOT|NICNT|BECNT|NIGTC|AB)\b/;

export function routeQuote({ quote, sourceLine = '', explicitTrack = null }) {
  if (explicitTrack) return explicitTrack;
  const hay = `${quote}\n${sourceLine}`;

  // Ordering matters. Attribution-line signals outrank quote-body signals:
  // a rabbinic or modern source quoting Scripture inside itself must not be
  // routed to the scripture track by its own quoted material.
  // ANF/NPNF/PG/PL series markers outrank the modern-strong page-pin test —
  // patristic quotes pinned with an NPNF page number ("Chambers, NPNF 1.12,
  // p. 200") must verify against the patristic source, not the modern track.
  if (/\b(?:ANF|NPNF|PG\s*\d+|PL\s*\d+)\b/.test(sourceLine)) return TRACKS.PATRISTIC;
  if (MODERN_STRONG.test(sourceLine)) return TRACKS.MODERN;
  // Patristic before rabbinic on the attribution line: a father quoting Sirach
  // ("Clement, Paed. II.2, quoting Sirach 31:27") verifies against the father's
  // text; rabbinic attribution lines never contain father names.
  if (PATRISTIC_RE.test(sourceLine) || PATRISTIC_WORKS.some((re) => re.test(sourceLine))) return TRACKS.PATRISTIC;
  if (RABBINIC_MARKERS.some((re) => re.test(sourceLine))) return TRACKS.RABBINIC;
  if (SCRIPTURE_RE.test(sourceLine)) return TRACKS.SCRIPTURE;
  // No usable attribution line — fall back to quote-body signals.
  if (RABBINIC_MARKERS.some((re) => re.test(hay))) return TRACKS.RABBINIC;
  if (PATRISTIC_RE.test(hay) || PATRISTIC_WORKS.some((re) => re.test(hay))) return TRACKS.PATRISTIC;
  if (SCRIPTURE_RE.test(quote)) return TRACKS.SCRIPTURE;
  if (MODERN_YEAR.test(hay) || MODERN_IMPRINTS.test(hay)) return TRACKS.MODERN;
  return TRACKS.UNROUTED;
}

// ── Quote extraction ───────────────────────────────────────────────────────

// Matches an HTML-comment override like `<!-- verify-track: scripture -->`.
const TRACK_OVERRIDE_RE = /<!--\s*verify-track:\s*([a-z-]+)\s*-->/i;

// Parse a markdown file and return an array of quotes.
//   { kind: 'block'|'inline', quote, sourceLine, line, track }
export function extractQuotes(markdown, { filePath = '' } = {}) {
  const lines = markdown.split(/\r?\n/);
  const quotes = [];

  // ── Block quotes ────────────────────────────────────────────────────────
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].startsWith('>')) { i++; continue; }
    // Look one line back for a track override.
    const overrideMatch = i > 0 ? lines[i - 1].match(TRACK_OVERRIDE_RE) : null;
    const explicitTrack = overrideMatch ? overrideMatch[1].toLowerCase() : null;

    const startLine = i + 1;
    const buf = [];
    while (i < lines.length && lines[i].startsWith('>')) {
      buf.push(lines[i].replace(/^>\s?/, ''));
      i++;
    }
    // Split attribution lines (leading em-dash / en-dash / two-or-more hyphens)
    // out of the quote body. Multiple attribution lines can stack — join them.
    // -{2,} covers both "--" and the "---" house style some studies use.
    const attribRe = /^\s*(?:—|–|-{2,})\s+/;
    const attribLines = [];
    while (buf.length > 0 && attribRe.test(buf[buf.length - 1])) {
      attribLines.unshift(buf.pop().replace(attribRe, '').trim());
    }
    const quoteText = buf.join('\n').trim();
    let sourceLine = attribLines.join(' ');
    // Fallback: look at the next non-blank line after the block quote, but
    // ONLY accept a line that is formatted as an attribution (leading dash).
    // Ordinary prose that happens to contain a chapter:verse ref is NOT an
    // attribution — accepting it caused a false-positive storm in the Wine
    // study (prose refs mis-assigned to unrelated block quotes).
    if (!sourceLine) {
      let j = i;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && !lines[j].startsWith('>') && !lines[j].startsWith('#')) {
        const next = lines[j].trim();
        if (attribRe.test(next)) {
          sourceLine = next.replace(attribRe, '');
        }
      }
    }

    const track = routeQuote({
      quote: quoteText,
      sourceLine,
      explicitTrack,
    });

    quotes.push({
      kind: 'block',
      quote: quoteText,
      sourceLine,
      line: startLine,
      filePath,
      track,
      explicitTrack,
    });
  }

  // ── Inline quotes ≥ MIN_INLINE_QUOTE_WORDS ──────────────────────────────
  // Straight quotes and curly quotes. We deliberately skip content inside
  // block quotes (already captured) by masking those lines.
  //
  // Routing discipline (added after the Wine-study false-positive storm):
  // an inline quote is verifiable ONLY when a citation sits TIGHT-ADJACENT
  // to the closing quote — e.g. `"..." (John 2:10)` or `"..." — Matt 26:29`.
  // Prose that merely mentions a reference somewhere later on the same line
  // is NOT an attribution. Unattributed inline quotes get the informational
  // track 'inline-unattributed': listed in the report, never flagged.
  const masked = lines.map((l) => (l.startsWith('>') ? '' : l)).join('\n');
  const inlineRe = /(["“])((?:[^"”]|(?<=\\)["”]){10,}?)(["”])/g;
  // Adjacency window: optional punctuation/dash/paren, then a scripture ref,
  // all within a few characters of the closing quote.
  const ADJACENT_REF_RE = new RegExp(
    `^[\\s,;.]{0,3}[\\(\\[—–-]?\\s{0,2}((?:${SCRIPTURE_BOOKS.map((b) => b.replace(/ /g, '\\s+')).join('|')})\\.?\\s+\\d+(?::\\d+(?:(?:-{1,2}|[–—])\\d+)?(?:,\\s*\\d+(?:(?:-{1,2}|[–—])\\d+)?)*)?)`,
    'i'
  );
  let m;
  while ((m = inlineRe.exec(masked)) !== null) {
    const quoteText = m[2].trim();
    const wordCount = quoteText.split(/\s+/).length;
    if (wordCount < MIN_INLINE_QUOTE_WORDS) continue;
    const lineNumber = masked.slice(0, m.index).split('\n').length;
    // Line-level override: `<!-- verify-track: skip -->` on the same line
    // exempts its inline quotes (e.g. a father's scripture wording quoted in
    // prose and pinned to a Matthew ref for comparison — deliberately not KJV).
    // Any other track value routes the inline quote to that track.
    const lineOverride = (lines[lineNumber - 1] || '').match(TRACK_OVERRIDE_RE);
    if (lineOverride) {
      const t = lineOverride[1].toLowerCase();
      if (t === 'skip') continue;
      quotes.push({ kind: 'inline', quote: quoteText, sourceLine: '', line: lineNumber, filePath, track: t });
      continue;
    }
    const tail = masked.slice(m.index + m[0].length, m.index + m[0].length + 60);
    const adj = tail.match(ADJACENT_REF_RE);
    if (adj) {
      quotes.push({
        kind: 'inline',
        quote: quoteText,
        sourceLine: adj[1],
        line: lineNumber,
        filePath,
        track: TRACKS.SCRIPTURE,
      });
    } else {
      quotes.push({
        kind: 'inline',
        quote: quoteText,
        sourceLine: '',
        line: lineNumber,
        filePath,
        track: TRACKS.INLINE_UNATTRIBUTED,
      });
    }
  }

  return quotes;
}

export function extractQuotesFromFile(filePath) {
  return extractQuotes(readFileSync(filePath, 'utf8'), { filePath });
}

export { TRACKS };
