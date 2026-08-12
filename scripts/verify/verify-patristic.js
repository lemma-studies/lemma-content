import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
import { LEMMA_ROOT } from './config.js';
import { normalize, wordDiff } from './verify-scripture.js';

const SOURCES_YAML = resolve(LEMMA_ROOT, 'data/patristic-sources.yaml');
const CACHE_DIR = resolve(LEMMA_ROOT, 'data/patristic-cache');

let _sources = null;
function loadSources() {
  if (_sources) return _sources;
  if (!existsSync(SOURCES_YAML)) {
    _sources = {};
    return _sources;
  }
  // js-yaml v4+ `.load()` uses DEFAULT_SCHEMA which rejects arbitrary types
  // (unlike Python PyYAML). Safe by construction — no `.unsafeLoad` here.
  _sources = yaml.load(readFileSync(SOURCES_YAML, 'utf8')) || {};
  return _sources;
}

// Attempt to canonicalize a source line to a lookup key.
// "Justin Martyr, *First Apology* 67" → "justin_1apol_67"
// "b. Kiddushin ..." → null (rabbinic, not our track)
// "Didache 4:9" → "didache_4"
export function canonKey(sourceLine) {
  let s = sourceLine.toLowerCase().replace(/[\*_`]/g, '');
  // Normalize Roman numerals in section refs ("V.2.3", "II.2") to digits, and
  // Latin letter-titles to their English canonical forms, before matching.
  s = s
    .replace(/\bad\s+romanos\b/g, 'romans')
    .replace(/\bad\s+philadelphios\b|\bad\s+philadelphians\b/g, 'philadelphians')
    .replace(/\badv\.\s*haer\.\s*/g, 'adv haer ')
    .replace(/\b(x{0,3})(ix|iv|v?i{0,3})\b\.?(?=[\s.,:]|$)/g, (match) => {
      const map = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
      return map[match.replace(/\./g, '')] !== undefined ? String(map[match.replace(/\./g, '')]) : match;
    });
  // Guard: allow anything on the same line but bounded so we don't over-consume.
  const NEAR = '[^\\n]{0,60}?';
  let m;
  // Justin First Apology
  if ((m = s.match(new RegExp(`justin${NEAR}(?:first apology|1\\s*apol(?:ogy|\\.)?)\\s*(\\d+)`)))) return `justin_1apol_${m[1]}`;
  if ((m = s.match(new RegExp(`justin${NEAR}dialogue(?:\\s+with\\s+trypho)?\\s*(\\d+)`)))) return `justin_dial_${m[1]}`;
  // Didache — allow "Didache 16", "Didache, Chapter 16"
  if ((m = s.match(/didache[,\s]+(?:ch(?:apter|\.)?\s*)?(\d+)/))) return `didache_${m[1]}`;
  // Irenaeus AH  — allow "4.17", "4, 17", "4 17"
  if ((m = s.match(new RegExp(`irenaeus${NEAR}(?:adv(?:ersus)?\\s+haer(?:eses)?|ah|against\\s+heresies)\\.?\\s*(\\d+)[\\., ]\\s*(\\d+)`)))) return `irenaeus_ah_${m[1]}_${m[2]}`;
  // Clement of Alexandria Paedagogus
  if ((m = s.match(new RegExp(`clement${NEAR}(?:paedagogus|paed\\.?)\\s*(?:book\\s*)?(\\d+|ii|iii|i)[\\., ]+(?:ch(?:apter|\\.)?\\s*)?(\\d+)`)))) {
    const bookMap = { 'i': 1, 'ii': 2, 'iii': 3 };
    const book = bookMap[m[1]] || parseInt(m[1], 10);
    return `clement_paedagogus_${book}_${m[2]}`;
  }
  // Tertullian Apologeticus / Apologeticum
  if ((m = s.match(new RegExp(`tertullian${NEAR}(?:apologeticus|apologeticum|apolog\\.?|apology)\\s*(\\d+)`)))) return `tertullian_apologeticus_${m[1]}`;
  // Cyprian Ep
  if ((m = s.match(new RegExp(`cyprian${NEAR}(?:ep(?:istle|\\.)?)\\s*(\\d+)`)))) return `cyprian_ep_${m[1]}`;
  // Cyprian De Mortalitate / On the Mortality
  if ((m = s.match(new RegExp(`cyprian${NEAR}(?:on the )?mortality\\s*(\\d+)`)))) return `cyprian_mortality_${m[1]}`;
  // Ignatius
  if ((m = s.match(new RegExp(`ignatius${NEAR}(?:romans|rom\\.?)\\s*(\\d+)`)))) return `ignatius_romans_${m[1]}`;
  if ((m = s.match(new RegExp(`ignatius${NEAR}(?:philadelphians|phld|phil\\.?)\\s*(\\d+)`)))) return `ignatius_philadelphians_${m[1]}`;
  // Chrysostom homilies on Acts
  if ((m = s.match(new RegExp(`chrysostom${NEAR}hom(?:ily|\\.)\\s*(\\d+)${NEAR}acts`)))) return `chrysostom_hom_acts_${m[1]}`;
  // Chrysostom homilies on 1 Corinthians — "Homilies on 1 Corinthians 34.3"
  if ((m = s.match(new RegExp(`chrysostom${NEAR}hom(?:ilies|ily|\\.)?${NEAR}corinthians\\s*(\\d+)`)))) return `chrysostom_hom_1cor_${m[1]}`;
  // 1 Clement — "1 Clement 49:1-5"
  if ((m = s.match(/1\s*clement\s+(\d+)/))) return `first_clement_${m[1]}`;
  // Ignatius to the Ephesians
  if ((m = s.match(new RegExp(`ignatius${NEAR}(?:to the ephesians|ephesians|eph\\.?)\\s*(\\d+)`)))) return `ignatius_ephesians_${m[1]}`;
  // Tertullian Against Praxeas — "Against Praxeas 14"
  if ((m = s.match(new RegExp(`tertullian${NEAR}(?:against praxeas|adv(?:ersus)?\\.?\\s*prax(?:ean|\\.)?|praxeas)\\s*(\\d+)`)))) return `tertullian_praxeas_${m[1]}`;
  // Theophilus To Autolycus — "To Autolycus 2.10" / "Ad Autolycum II.10"
  if ((m = s.match(new RegExp(`theophilus${NEAR}(?:to autolycus|ad autolycum|autol\\.?)\\s*(\\d+)[\\., ]\\s*(\\d+)`)))) return `theophilus_autol_${m[1]}_${m[2]}`;
  // Tertullian Against Marcion — "Against Marcion 5.8"
  if ((m = s.match(new RegExp(`tertullian${NEAR}(?:against marcion|adv\\.?\\s*marc(?:ionem|\\.)?)\\s*(\\d+)[\\., ]\\s*(\\d+)`)))) return `tertullian_marcion_${m[1]}_${m[2]}`;
  // Augustine De Trinitate — "De Trinitate 15.23.44" (book-level page)
  if ((m = s.match(new RegExp(`augustine${NEAR}(?:de trinitate|on the trinity)\\s*(\\d+)`)))) return `augustine_de_trinitate_${m[1]}`;
  // Clement of Alexandria Stromata — "Stromata 7.10.57" (book-level page)
  if ((m = s.match(new RegExp(`clement${NEAR}strom(?:ata|\\.)?\\s*(\\d+)`)))) return `clement_stromata_${m[1]}`;
  // Methodius Banquet of the Ten Virgins — "Banquet 9.2" / "Banquet of the Ten Virgins 9"
  if ((m = s.match(new RegExp(`methodius${NEAR}banquet${NEAR}(\\d+)`)))) return `methodius_banquet_${m[1]}`;
  // Ambrosiaster on 1 Corinthians — "Commentary on 1 Corinthians 13:12"
  if ((m = s.match(new RegExp(`ambrosiaster${NEAR}corinthians\\s*(\\d+)`)))) return `ambrosiaster_1cor_${m[1]}`;
  // Eusebius H.E. (incl. Hegesippus/Gaius/Dionysius/Irenaeus fragments quoted there)
  if ((m = s.match(new RegExp(`(?:eusebius|hegesippus)${NEAR}(?:church history|ecclesiastical history|h\\.?\\s?e\\.?)\\s*(\\d+)[\\., ]\\s*(\\d+)`)))) return `eusebius_he_${m[1]}_${m[2]}`;
  // Ignatius to the Trallians
  if ((m = s.match(new RegExp(`ignatius${NEAR}(?:trallians|trall\\.?)\\s*(\\d+)`)))) return `ignatius_trallians_${m[1]}`;
  // Polycarp to the Philippians
  if ((m = s.match(new RegExp(`polycarp${NEAR}philippians\\s*(\\d+)`)))) return `polycarp_philippians_${m[1]}`;
  // Shepherd of Hermas — "Vision 4.2"
  if ((m = s.match(new RegExp(`hermas${NEAR}vision\\s*(\\d+)[\\., ]\\s*(\\d+)`)))) return `hermas_vision_${m[1]}_${m[2]}`;
  // Tertullian On the Resurrection of the Flesh / De Resurrectione Carnis
  if ((m = s.match(new RegExp(`tertullian${NEAR}(?:on the resurrection of the flesh|de resurrectione carnis|resurrection)\\s*(\\d+)`)))) return `tertullian_res_flesh_${m[1]}`;
  // Hippolytus On Christ and Antichrist
  if ((m = s.match(new RegExp(`hippolytus${NEAR}antichrist\\s*(\\d+)`)))) return `hippolytus_antichrist_${m[1]}`;
  // Epistle of Barnabas
  if ((m = s.match(/(?:epistle of\s+)?barnabas\s+(\d+)/))) return `barnabas_${m[1]}`;
  // Chrysostom Homilies on 1 Thessalonians — "Homilies on First Thessalonians, Homily 8"
  if ((m = s.match(new RegExp(`chrysostom${NEAR}(?:first|1)\\s+thessalonians${NEAR}homily\\s*(\\d+)`)))) return `chrysostom_hom_1thess_${m[1]}`;
  // Chrysostom Homilies on 2 Thessalonians — "Homily 4 on 2 Thessalonians"
  if ((m = s.match(new RegExp(`chrysostom${NEAR}homily\\s*(\\d+)${NEAR}(?:second|2)\\s+thessalonians`)))) return `chrysostom_hom_2thess_${m[1]}`;
  // Augustine City of God — "City of God 20.7" (book-level page)
  if ((m = s.match(new RegExp(`augustine${NEAR}city of god\\s*(\\d+)[\\., ]\\s*(\\d+)`)))) return `augustine_civ_${m[1]}_${m[2]}`;
  // Cyril of Jerusalem Catechetical Lectures — "Catechetical Lectures 15.12" (lecture-level page)
  if ((m = s.match(new RegExp(`cyril${NEAR}catechetical lectures?\\s*(\\d+)`)))) return `cyril_catech_${m[1]}`;
  // Jerome Commentary on Daniel (no section number; whole commentary one page)
  if ((m = s.match(new RegExp(`jerome${NEAR}(?:commentary on\\s+)?daniel`)))) return `jerome_daniel`;
  // Origen De Principiis — "De Principiis II.11.2" (book-level page)
  if ((m = s.match(new RegExp(`origen${NEAR}de principiis\\s*(\\d+)[\\., ]\\s*(\\d+)`)))) return `origen_deprinc_${m[1]}_${m[2]}`;
  // John of Damascus De Fide Orthodoxa — "De Fide Orthodoxa IV.26" (book-level page)
  if ((m = s.match(new RegExp(`damascus${NEAR}(?:de fide orthodoxa|orthodox faith)\\s*(\\d+)`)))) return `damascus_defide_${m[1]}`;
  // Gregory the Great Registrum Epistolarum — "Book V, Letter 20"
  if ((m = s.match(new RegExp(`gregory${NEAR}registrum${NEAR}book\\s*(\\d+)[,\\.]?\\s*(?:letter|ep(?:istle|\\.)?)\\s*(\\d+)`)))) return `gregory_reg_${m[1]}_${m[2]}`;
  // Commodianus Instructions — "Instructions 44"
  if ((m = s.match(new RegExp(`commodianus${NEAR}instructions\\s*(\\d+)`)))) return `commodianus_instructions_${m[1]}`;
  return null;
}

// ── Symmetric comparison cleaning ──────────────────────────────────────────
// The fetched pages interleave inline scripture citations ("Matthew 24:11-12",
// "1 John 4:3") and footnote numbers ("4") inside the translated text; quotes
// legitimately read past them without ellipses (they are citations, not text).
// So strip citation tokens BEFORE normalize, then drop standalone digit
// tokens, quote-mark apostrophes (keeping intra-word ones like "life's"), and
// non-ASCII tokens (Greek/Hebrew) from BOTH the needle and the haystack.
const INLINE_REF_RE = /\b(?:[123]\s*)?[A-Z][a-z]+\.?\s+\d{1,3}(?:[:.]\d{1,3})?(?:-\d{1,3})?(?::\d{1,3})?\b/g;
export function cleanForCompare(s) {
  let n = normalize(String(s).replace(INLINE_REF_RE, ' '));
  n = n.replace(/(^|\s)'+/g, '$1').replace(/'+(?=\s|$)/g, '');
  n = n
    .split(' ')
    .filter((w) => w && !/^\d+$/.test(w) && !/[^\x00-\x7f]/.test(w))
    .join(' ');
  return n;
}

// Split a manuscript quote into its contiguous segments: ellipses ("..."/…)
// mark deliberate skips, and separate block-quote paragraphs are separate
// spans. Each segment must appear contiguously in the source, in order.
export function quoteSegments(quoteText) {
  return String(quoteText)
    .split(/(?:\.\.\.|…|\n+)/)
    .map(cleanForCompare)
    .filter((seg) => seg.split(' ').filter(Boolean).length >= 4);
}

// Fetch a URL with disk caching. Returns the HTML text or null on failure.
async function fetchCached(url) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const h = createHash('sha256').update(url).digest('hex').slice(0, 16);
  const cachePath = join(CACHE_DIR, `${h}.html`);
  if (existsSync(cachePath)) {
    return readFileSync(cachePath, 'utf8');
  }
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'lemma-verify-quotes/0.1 (research; contact: torque@gmail.com)' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    writeFileSync(cachePath, text);
    return text;
  } catch (e) {
    return null;
  }
}

// Extract the readable text from newadvent's HTML (strip nav/scripts).
export function extractNewAdventText(html) {
  // newadvent pages have the article body inside <div id="content" ...> ... </div>
  const m = html.match(/<div[^>]*(?:id="content"|class="post")[^>]*>([\s\S]*?)<\/div>\s*<div[^>]*(?:id="footer"|class="siteinfo")/i);
  const body = m ? m[1] : html;
  return body
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#8212;/g, '—')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&hellip;/g, '…')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Verify a patristic quote by fetching the pinned URL and comparing.
// The comparison is fuzzy: we check whether the manuscript's quote (its
// distinctive content-word run) is present in the fetched text.
export async function verifyPatristic(quoteObj) {
  const key = canonKey(quoteObj.sourceLine || '');
  const sources = loadSources();

  if (!key || !sources[key]) {
    return {
      verdict: 'unroutable_patristic',
      reason: `No URL mapping for source line "${quoteObj.sourceLine}". Add an entry to data/patristic-sources.yaml with a translator pin.`,
      quote: quoteObj,
    };
  }

  const entry = { ...sources[key] };
  // Translator-aware URL choice: when the attribution names an alternate
  // translator we have a URL for (e.g. Lightfoot), verify against THAT
  // edition, not the default — Apostolic-Fathers quotes pinned to Lightfoot
  // must not be compared against Roberts-Donaldson.
  const alt = sources[key].alt_translators || {};
  for (const [name, url] of Object.entries(alt)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(quoteObj.sourceLine || '')) {
      entry.url = url;
      entry.translator = name.charAt(0).toUpperCase() + name.slice(1);
      break;
    }
  }
  const html = await fetchCached(entry.url);
  if (!html) {
    return {
      verdict: 'fetch_failed',
      reason: `Could not fetch ${entry.url}. Check network or use the alt_translators URL if provided.`,
      key,
      url: entry.url,
      quote: quoteObj,
    };
  }
  const text = extractNewAdventText(html);
  const normText = cleanForCompare(text);
  const normQuote = cleanForCompare(quoteObj.quote);

  // Windows must be built from the CONTIGUOUS word sequence — filtering short
  // words out of the window and then searching unfiltered text guarantees a
  // miss (the original Wine-study bug: every un-exact quote came back
  // "absent" because "who/an/the" were dropped from the needle but not the
  // haystack).
  const quoteWords = normQuote.split(' ').filter(Boolean);
  if (quoteWords.length < 6) {
    return {
      verdict: 'too_short_to_verify',
      key,
      url: entry.url,
      translator: entry.translator,
      quote: quoteObj,
    };
  }

  // Check full-quote match first
  if (normText.includes(normQuote)) {
    return {
      verdict: 'verbatim_clean',
      key,
      url: entry.url,
      translator: entry.translator,
      quote: quoteObj,
    };
  }

  // Segment match: ellipses mark deliberate skips and paragraphs are separate
  // spans (per the study house rule: every segment between skips must be
  // verbatim). If every segment appears contiguously in the source, in order,
  // the quote is verbatim.
  const segs = quoteSegments(quoteObj.quote);
  if (segs.length > 0) {
    let pos = 0;
    let allFound = true;
    for (const seg of segs) {
      const idx = normText.indexOf(seg, pos);
      if (idx < 0) {
        allFound = false;
        break;
      }
      pos = idx + seg.length;
    }
    if (allFound) {
      return {
        verdict: 'verbatim_clean',
        key,
        url: entry.url,
        translator: entry.translator,
        segments: segs.length,
        quote: quoteObj,
      };
    }
  }

  // Slide an 8-word contiguous window across the quote; a hit means the quote
  // overlaps the pinned text (wording variance somewhere), no hit means the
  // quote's language is absent from the pinned translation.
  const win = Math.min(8, quoteWords.length);
  let hitPhrase = null;
  for (let start = 0; start + win <= quoteWords.length; start++) {
    const phrase = quoteWords.slice(start, start + win).join(' ');
    if (normText.includes(phrase)) {
      hitPhrase = phrase;
      break;
    }
  }
  if (hitPhrase) {
    const diff = wordDiff(normText.slice(0, 4000), normQuote);
    return {
      verdict: 'wording_variance',
      key,
      url: entry.url,
      translator: entry.translator,
      hit_phrase: hitPhrase,
      diff,
      quote: quoteObj,
    };
  }

  // Distinctive-phrase absent → probable fabrication
  return {
    verdict: 'absent',
    key,
    url: entry.url,
    translator: entry.translator,
    reason: 'No distinctive phrase from the quote was found in the pinned translation. Verify against the actual translator, or against alternate translations, before treating as fabrication.',
    quote: quoteObj,
  };
}
