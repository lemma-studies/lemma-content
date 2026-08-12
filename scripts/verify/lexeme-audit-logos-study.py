#!/usr/bin/env python3
"""Lexeme audit — Is Jesus the Logos study.
Checks every Greek morphological claim in the manuscript against MorphGNT-SBLGNT
(lemma + parse codes) and Rahlfs LXX (surface forms). Pattern: lexeme-audit-perfect-study.py.
Includes governing-verb checks (Perfect-study lesson: audit the verb, not just the lemma).
"""
import sys, os, unicodedata, bisect, glob

MG = sys.argv[1] if len(sys.argv) > 1 else "morphgnt"   # dir of NN-Xx.txt
LXX_CSV = sys.argv[2] if len(sys.argv) > 2 else "lxx-accented.csv"
LXX_VRS = sys.argv[3] if len(sys.argv) > 3 else "lxx-verses.csv"

def strip(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if not unicodedata.combining(c))

# load morphgnt: rows (ref, parse, text, lemma) ; ref like 040101 (book 04 = John)
rows = []
for f in sorted(glob.glob(os.path.join(MG, "*.txt"))):
    for line in open(f):
        p = line.split()
        if len(p) >= 7:
            rows.append((p[0], p[1] + " " + p[2], p[3], p[6]))

def verse(book, ch, v):
    key = f"{book:02d}{ch:02d}{v:02d}"
    return [r for r in rows if r[0] == key]

checks, fails = [], []
def check(name, ok, detail=""):
    checks.append((name, ok, detail))
    if not ok: fails.append(name)

# ---- John 1:1 ----
j11 = verse(4, 1, 1)
w = [r[2] for r in j11]
check("1:1 wording", " ".join(w) == "Ἐν ἀρχῇ ἦν ὁ λόγος, καὶ ὁ λόγος ἦν πρὸς τὸν θεόν, καὶ θεὸς ἦν ὁ λόγος.", " ".join(w))
een = [r for r in j11 if r[3] == "εἰμί"]
check("1:1 ἦν ×3 imperfect εἰμί", len(een) == 3 and all("IAI" in r[1] for r in een), str([r[1] for r in een]))
wclean = [x.rstrip(".,·;") for x in w]
check("1:1c θεός anarthrous before verb", wclean[12:15] == ["καὶ", "θεὸς", "ἦν"], str(wclean[11:16]))
logos_11 = [r for r in j11 if r[3] == "λόγος"]
check("1:1 λόγος masc nom ×3", len(logos_11) == 3 and all("NSM" in r[1] for r in logos_11), str([r[1] for r in logos_11]))
# ---- John 1:2 οὗτος ----
j12 = verse(4, 1, 2)
check("1:2 οὗτος present", any(r[3] == "οὗτος" for r in j12), str([r[2] for r in j12]))
# ---- John 1:3 ἐγένετο aorist γίνομαι ----
j13 = verse(4, 1, 3)
eg = [r for r in j13 if r[3] == "γίνομαι"]
check("1:3 ἐγένετο aorist γίνομαι", len(eg) >= 2 and all("AMI" in r[1] or "AMN" in r[1] for r in eg[:2]), str([(r[2], r[1]) for r in eg]))
# ---- John 1:6 ----
j16 = verse(4, 1, 6)
check("1:6 Ἐγένετο aorist (the Baptist enters by becoming)", any(r[3] == "γίνομαι" and "AMI" in r[1] for r in j16), str([(r[2], r[1]) for r in j16[:2]]))
# ---- John 1:14 ----
j114 = verse(4, 1, 14)
w14 = [r[2] for r in j114]
check("1:14 ὁ λόγος σὰρξ ἐγένετο order", w14[1:5] == ["ὁ", "λόγος", "σὰρξ", "ἐγένετο"], str(w14[:6]))
sk = [r for r in j114 if r[3] == "σκηνόω"]
check("1:14 ἐσκήνωσεν aorist σκηνόω", len(sk) == 1 and "AAI" in sk[0][1], str(sk))
# ---- John 1:15 πρῶτός μου ἦν ----
j115 = verse(4, 1, 15)
w15 = " ".join(r[2] for r in j115)
check("1:15 πρῶτός μου ἦν", "πρῶτός μου ἦν" in w15, w15[-40:])
# ---- John 3:13 — SBLGNT lacks 'ὁ ὢν ἐν τῷ οὐρανῷ' ----
j313 = " ".join(r[2] for r in verse(4, 3, 13))
check("3:13 SBLGNT omits ὁ ὢν ἐν τῷ οὐρανῷ (variant claim)", "οὐρανῷ" not in j313.split("ἀναβέβηκεν")[0] and not j313.rstrip(".").endswith("οὐρανῷ"), j313)
# ---- John 6:62 ----
j662 = " ".join(r[2] for r in verse(4, 6, 62))
check("6:62 ὅπου ἦν τὸ πρότερον", "ὅπου ἦν τὸ πρότερον" in j662, j662)
# ---- John 8:58 ----
j858 = verse(4, 8, 58)
w58 = " ".join(r[2] for r in j858)
check("8:58 πρὶν Ἀβραὰμ γενέσθαι ἐγὼ εἰμί", "πρὶν Ἀβραὰμ γενέσθαι ἐγὼ εἰμί" in w58, w58)
gen = [r for r in j858 if r[2] == "γενέσθαι"]
check("8:58 γενέσθαι aor mid inf γίνομαι", len(gen) == 1 and gen[0][3] == "γίνομαι" and "AMN" in gen[0][1], str(gen))
eimi = [r for r in j858 if r[2].rstrip(".,·;") in ("εἰμί", "εἰμι") and r[3] == "εἰμί"]
check("8:58 εἰμί 1sg present", len(eimi) == 1 and "PAI" in eimi[0][1] and " 1" in eimi[0][1], str(eimi))
# ---- ἤμην available (Ch2 claim: 'the natural Greek was ἤμην') — attested in John ----
hmn = [r for r in rows if r[0].startswith("04") and strip(r[2]) == "ημην"]
check("ἤμην (1sg impf εἰμί) attested in John", len(hmn) >= 1, str([(r[0], r[2]) for r in hmn[:3]]))
# ---- John 17:5 ----
j175 = verse(4, 17, 5)
w175 = " ".join(r[2] for r in j175)
eix = [r for r in j175 if r[3] == "ἔχω"]
check("17:5 εἶχον imperfect ἔχω", len(eix) == 1 and "IAI" in eix[0][1], str(eix))
check("17:5 παρὰ σοί present", "παρὰ σοί" in w175, w175)
# ---- John 17:24 πρὸ καταβολῆς κόσμου ----
j1724 = " ".join(r[2] for r in verse(4, 17, 24))
check("17:24 πρὸ καταβολῆς κόσμου", "πρὸ καταβολῆς κόσμου" in j1724, j1724[-60:])
# ---- 1 John 1:1 neuter relative ----
oj11 = verse(23, 1, 1)
rel = [r for r in oj11 if r[1].startswith("RR") or "RR" in r[1].split()[0]]
first = oj11[0] if oj11 else None
check("1Jn 1:1 opens with neuter relative Ὃ", first is not None and strip(first[2]) == "ο" and "NSN" in first[1] or (first and "ASN" in first[1]), str(first))
# ---- 1 John 1:2 πρὸς τὸν πατέρα ----
oj12 = " ".join(r[2] for r in verse(23, 1, 2))
check("1Jn 1:2 πρὸς τὸν πατέρα", "πρὸς τὸν πατέρα" in oj12, oj12)
# ---- λόγος NT count ----
n_logos = sum(1 for r in rows if r[3] == "λόγος")
check("λόγος NT count = 330 (App A 'roughly 330')", n_logos == 330, str(n_logos))

# ---- LXX checks (surface) ----
words = {}
for line in open(LXX_CSV):
    p = line.rstrip("\n").split("\t")
    if len(p) >= 3: words[int(p[0])] = p[2]
refs, starts = [], []
for line in open(LXX_VRS):
    p = line.strip().split("\t")
    if len(p) == 2: refs.append(p[0]); starts.append(int(p[1]))
def lxx_verse(ref):
    i = refs.index(ref); s = starts[i]
    e = starts[i + 1] if i + 1 < len(starts) else s + 40
    return " ".join(words.get(j, "") for j in range(s, e))
try:
    sir248 = lxx_verse("Sir.24.8")
    check("Sir 24:8 σκηνή-family present (LXX)", "σκην" in strip(sir248), sir248[:100])
except ValueError:
    check("Sir 24:8 σκηνή-family present (LXX)", False, "ref not found in versification")
try:
    isa5511 = lxx_verse("Isa.55.11")
    check("Isa 55:11 LXX uses ῥῆμα not λόγος", "ρημα" in strip(isa5511) and "λογος" not in strip(isa5511).replace("ρημα",""), isa5511[:120])
except ValueError:
    check("Isa 55:11 LXX ῥῆμα", False, "ref not found")

print(f"LEXEME AUDIT — {sum(1 for _,ok,_ in checks if ok)}/{len(checks)} PASS")
for name, ok, detail in checks:
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + ("" if ok else f"  << {detail[:140]}"))
sys.exit(1 if fails else 0)
