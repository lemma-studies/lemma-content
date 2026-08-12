// Modern-track "verifier" — emits a worklist for the human/Playwright dance.
// The actual verification is interactive (Tim logs in, agent drives Playwright).
// See ~/.claude/skills/lemma-verify-quotes/references/archive-org-playwright-recipe.md
//
// This module extracts distinctive phrases from each modern quote and stages
// the worklist in a stable order so the agent can iterate.

const STOPWORDS = new Set([
  'the','a','an','of','and','or','but','if','then','that','this','these','those',
  'in','on','at','to','from','by','for','with','without','not','no','yes','be',
  'is','are','was','were','been','being','have','has','had','do','does','did',
  'as','so','than','though','although','because','since','when','while','where',
  'why','how','what','who','whom','which','one','some','any','all','many','much',
]);

export function distinctivePhrase(quote, { minWords = 4, maxWords = 7 } = {}) {
  // Prefer a run of consecutive non-stopword tokens.
  const tokens = quote.replace(/[^\p{L}\p{N}'’\s-]/gu, ' ').split(/\s+/).filter(Boolean);
  const contentIdx = tokens.map((t, i) => (STOPWORDS.has(t.toLowerCase()) ? -1 : i)).filter((i) => i >= 0);
  if (contentIdx.length === 0) return tokens.slice(0, maxWords).join(' ');

  // Slide a window; pick the window with the highest content-word density.
  let best = { start: 0, count: 0 };
  for (let start = 0; start + minWords <= tokens.length; start++) {
    const end = Math.min(start + maxWords, tokens.length);
    let count = 0;
    for (let j = start; j < end; j++) {
      if (!STOPWORDS.has(tokens[j].toLowerCase())) count++;
    }
    if (count > best.count) best = { start, count };
  }
  return tokens.slice(best.start, best.start + maxWords).join(' ');
}

export function makeWorklistItem(quoteObj) {
  const distinctive = distinctivePhrase(quoteObj.quote);
  return {
    location: `${quoteObj.filePath}:${quoteObj.line}`,
    kind: quoteObj.kind,
    quote_head: quoteObj.quote.slice(0, 120) + (quoteObj.quote.length > 120 ? '…' : ''),
    source_line: quoteObj.sourceLine || '(no attribution line captured)',
    distinctive_phrase: distinctive,
    ia_identifier: null, // populated during Playwright pass
    verdict: null,       // populated during Playwright pass
    notes: null,         // populated during Playwright pass
  };
}
