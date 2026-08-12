#!/usr/bin/env python3
# Lexeme audit — Sermon on the Mount Study (applicability of Matt 5-7).
# Verifies every verse-level original-language attribution the manuscript makes
# against tagged ground-truth texts:
#   NT Greek : MorphGNT/SBLGNT (github.com/morphgnt/sblgnt)
#   Hebrew   : Strong's-tagged WLC (OpenScriptures morphhb)
# Pattern follows lexeme-audit-trumpet-study.py.
#
# MorphGNT columns: ref(BBCCVV) POS parse text word normalized lemma
# Parse code (8 chars): person tense voice mood case number gender degree
#   tense: P present, I imperfect, F future, A aorist, X perfect, Y pluperfect
#   voice: A active, M middle, P passive
#   mood:  I indicative, S subjunctive, P participle, D imperative, N infinitive, O optative
import os, re, sys, unicodedata

BASE = sys.argv[1] if len(sys.argv) > 1 else \
    '/tmp/claude-1000/-home-tim/d1d2f718-bac8-4c0b-adbc-6f567017011b/scratchpad'
GNT = os.path.join(BASE, 'morphgnt')
WLC = os.path.join(BASE, 'morphhb')

FILES = {'01': '61-Mt.txt', '02': '62-Mk.txt', '03': '63-Lk.txt', '04': '64-Jn.txt',
         '05': '65-Ac.txt', '06': '66-Ro.txt', '07': '67-1Co.txt', '08': '68-2Co.txt',
         '09': '69-Ga.txt', '10': '70-Eph.txt', '11': '71-Php.txt', '12': '72-Col.txt',
         '13': '73-1Th.txt', '14': '74-2Th.txt', '15': '75-1Ti.txt', '16': '76-2Ti.txt',
         '17': '77-Tit.txt', '18': '78-Phm.txt', '19': '79-Heb.txt', '20': '80-Jas.txt',
         '21': '81-1Pe.txt', '22': '82-2Pe.txt', '23': '83-1Jn.txt', '24': '84-2Jn.txt',
         '25': '85-3Jn.txt', '26': '86-Jud.txt', '27': '87-Re.txt'}

def nfc(s):
    return unicodedata.normalize('NFC', s)

_cache = {}
def book_rows(book):
    if book not in _cache:
        rows = []
        with open(os.path.join(GNT, FILES[book]), encoding='utf-8') as f:
            for line in f:
                p = line.split()
                if len(p) >= 7:
                    rows.append((p[0], p[1], p[2], nfc(p[6])))
        _cache[book] = rows
    return _cache[book]

def verse(book, ch, vs):
    ref = f"{book}{ch:02d}{vs:02d}"
    return [(pos, parse, lemma) for (r, pos, parse, lemma) in book_rows(book) if r == ref]

def wlc_lemmas(hbook, ch, vs):
    path = os.path.join(WLC, f'{hbook}.xml')
    key = 'H:' + hbook
    if key not in _cache:
        _cache[key] = open(path, encoding='utf-8').read()
    m = re.search(rf'osisID="{hbook}\.{ch}\.{vs}"(.*?)</verse>', _cache[key], re.S)
    if m is None:
        return None
    out = set()
    for l in re.findall(r'lemma="([^"]+)"', m.group(1)):
        for part in l.split('/'):
            part = part.strip().split(' ')[0]
            if part.isdigit():
                out.add(part)
    return out

# ---------------------------------------------------------------------------
# Claim table. Kinds:
#   P  (book,ch,vs, [lemmas], parsereq, label)   all lemmas present in verse;
#        parsereq = [(idx,char),...] applies to the FIRST lemma if given
#   N  (book,ch,vs, lemma, label)                lemma absent from verse
#   CNT (book,ch,vs, lemma, n, label)            lemma occurs exactly n times in verse
#   BKCNT (book, lemma, n, label)                lemma occurs exactly n times in whole book
#   PHRASE_MT ('kingdom-of-heaven', n, label)    special: count basileia..ouranos verses
#   H   (hbook,ch,vs, strongs, label)            Strong's number present in WLC verse
# ---------------------------------------------------------------------------
CLAIMS = [
 # ===== pleroo (G4137) — AppA pleroo section + Ch1:74-76 + Ch4:94 + Overview:22 =====
 ('P','01',5,17,['πληρόω'],[(1,'A'),(2,'A'),(3,'N')],
                                'CLAIM AppA:22-24/Ch1:76 — Matt 5:17 πληρῶσαι aorist active infinitive'),
 ('CNT','01',5,17,'καταλύω',2,  'CLAIM AppA:22/394 — Matt 5:17 καταλῦσαι twice, contrasted with πληρῶσαι'),
 ('P','01',5,17,['νομίζω'],None,'CLAIM AppA:411 — Matt 5:17 opens Μὴ νομίσητε ("do not think")'),
 # Matthew fulfillment-formula verses (AppA:41-51)
 ('P','01',1,22,['πληρόω'],[(1,'A'),(2,'P'),(3,'S')],
                                'CLAIM AppA:41 — Matt 1:22 πληρωθῇ (aorist passive subjunctive)'),
 ('P','01',2,15,['πληρόω'],None,'CLAIM AppA:42 — Matt 2:15 fulfillment formula'),
 ('P','01',2,17,['πληρόω'],None,'CLAIM AppA:43 — Matt 2:17 fulfillment formula'),
 ('P','01',2,23,['πληρόω'],None,'CLAIM AppA:44 — Matt 2:23 fulfillment formula'),
 ('P','01',4,14,['πληρόω'],None,'CLAIM AppA:45 — Matt 4:14 fulfillment formula'),
 ('P','01',8,17,['πληρόω'],None,'CLAIM AppA:46 — Matt 8:17 fulfillment formula'),
 ('P','01',12,17,['πληρόω'],None,'CLAIM AppA:47 — Matt 12:17 fulfillment formula'),
 ('P','01',13,35,['πληρόω'],None,'CLAIM AppA:48 — Matt 13:35 fulfillment formula'),
 ('P','01',21,4,['πληρόω'],None, 'CLAIM AppA:49 — Matt 21:4 fulfillment formula'),
 ('P','01',26,54,['πληρόω'],None,'CLAIM AppA:50 — Matt 26:54 πληρωθῶσιν'),
 ('P','01',26,56,['πληρόω'],None,'CLAIM AppA:51 — Matt 26:56 fulfillment formula'),
 # BDAG literal-sense examples (AppA:30-31)
 ('P','01',13,48,['πληρόω'],None,'CLAIM AppA:30 — Matt 13:48 filling a net (πληρόω literal sense)'),
 ('P','01',23,32,['πληρόω'],None,'CLAIM AppA:30 — Matt 23:32 "fill ye up the measure"'),
 ('P','02',1,15,['πληρόω'],None, 'CLAIM AppA:31 — Mark 1:15 "the time is fulfilled"'),
 # Paul usage (AppA:65-69, Ch1:330)
 ('P','06',8,4,['πληρόω'],[(1,'A'),(2,'P'),(3,'S')],
                                'CLAIM AppA:67 — Rom 8:4 πληρωθῇ (aorist passive subjunctive)'),
 ('P','06',13,8,['πληρόω'],[(1,'X'),(2,'A')],
                                'CLAIM AppA:68 — Rom 13:8 πεπλήρωκεν (perfect active)'),
 ('P','09',5,14,['πληρόω'],[(1,'X'),(2,'P')],
                                'CLAIM AppA:69/Ch1:330 — Gal 5:14 πεπλήρωται (perfect passive)'),
 # ===== teleios (G5046) — AppA teleios section + Ch1:155-173 =====
 ('CNT','01',5,48,'τέλειος',2,  'CLAIM AppA:100 — Matt 5:48 τέλειος twice (τέλειοι ... τέλειός)'),
 ('P','01',5,48,['εἰμί'],[(1,'F'),(3,'I')],
                                'CLAIM AppA:102 — Matt 5:48 Ἔσεσθε future indicative'),
 ('N','03',6,36,'τέλειος',      'CLAIM AppA:113-120 — Luke 6:36 uses οἰκτίρμων NOT τέλειος'),
 ('CNT','03',6,36,'οἰκτίρμων',2,'CLAIM AppA:118 — Luke 6:36 οἰκτίρμονες ... οἰκτίρμων (twice)'),
 ('P','01',19,21,['τέλειος'],None,'CLAIM Ch1:165 — Matt 19:21 "If thou wilt be perfect"'),
 ('P','07',2,6,['τέλειος'],None,  'CLAIM AppA:144/Ch1:166 — 1 Cor 2:6 τελείοις'),
 ('P','07',13,10,['τέλειος'],None,'CLAIM Ch1:167 — 1 Cor 13:10 τὸ τέλειον'),
 ('P','10',4,13,['τέλειος'],None, 'CLAIM Ch1:168 — Eph 4:13 τέλειον (corporate maturity)'),
 ('P','11',3,15,['τέλειος'],None, 'CLAIM AppA:145/Ch1:169 — Phil 3:15 τέλειοι'),
 ('P','12',1,28,['τέλειος'],None, 'CLAIM Ch1:170 — Col 1:28 "present every man perfect"'),
 ('P','20',1,4,['τέλειος','ὁλόκληρος'],None,
                                  'CLAIM AppA:146/Ch1:171 — James 1:4 τέλειοι + ὁλόκληροι'),
 ('P','20',1,25,['τέλειος'],None, 'CLAIM Ch1:172 — James 1:25 "perfect law of liberty"'),
 ('P','20',3,2,['τέλειος'],None,  'CLAIM AppA:147/Ch1:173 — James 3:2 "a perfect man"'),
 # ===== makarios (G3107) — AppA makarios section, Beatitudes =====
 ('P','01',5,3,['μακάριος'],None, 'CLAIM AppA:173 — Matt 5:3 μακάριοι'),
 ('P','01',5,4,['μακάριος'],None, 'CLAIM AppA:176 — Matt 5:4'),
 ('P','01',5,5,['μακάριος'],None, 'CLAIM AppA:179 — Matt 5:5'),
 ('P','01',5,6,['μακάριος'],None, 'CLAIM AppA:182 — Matt 5:6'),
 ('P','01',5,7,['μακάριος'],None, 'CLAIM AppA:185 — Matt 5:7'),
 ('P','01',5,8,['μακάριος'],None, 'CLAIM AppA:188 — Matt 5:8'),
 ('P','01',5,9,['μακάριος'],None, 'CLAIM AppA:191 — Matt 5:9'),
 ('P','01',5,10,['μακάριος'],None,'CLAIM AppA:194 — Matt 5:10'),
 ('P','01',5,11,['μακάριος'],None,'Beatitude 9 — Matt 5:11 (Ch3:5 quotes it)'),
 ('P','01',11,6,['μακάριος'],None, 'CLAIM AppA:230 — Matt 11:6'),
 ('P','01',13,16,['μακάριος'],None,'CLAIM AppA:231 — Matt 13:16'),
 ('P','01',16,17,['μακάριος'],None,'CLAIM AppA:232 — Matt 16:17'),
 ('P','01',24,46,['μακάριος'],None,'CLAIM AppA:233 — Matt 24:46'),
 # ===== basileia ton ouranon — AppA kingdom section =====
 ('PHRASE_MT','kingdom-of-heaven',32,
                                'CLAIM AppA:259 — "kingdom of heaven" appears 32x in Matthew'),
 ('PHRASE_NT_OUTSIDE_MT','kingdom-of-heaven',0,
                                'CLAIM AppA:259 — "kingdom of heaven" nowhere else in the NT'),
 ('P','01',12,28,['βασιλεία','θεός'],None,'CLAIM AppA:259/293 — Matt 12:28 "kingdom of God"'),
 ('P','01',19,24,['βασιλεία','θεός'],None,'CLAIM AppA:259 — Matt 19:24 "kingdom of God"'),
 ('P','01',21,31,['βασιλεία','θεός'],None,'CLAIM AppA:259 — Matt 21:31 "kingdom of God"'),
 ('P','01',21,43,['βασιλεία','θεός'],None,'CLAIM AppA:259 — Matt 21:43 "kingdom of God"'),
 ('N','01',6,33,'θεός',          'CHECK AppA:259 — Matt 6:33 "kingdom of God" only "in some manuscripts" (SBLGNT omits θεοῦ)'),
 # Synoptic parallels table (AppA:263-268)
 ('P','02',1,15,['βασιλεία','θεός'],None,'CLAIM AppA:265 — Mark 1:15 kingdom of God'),
 ('P','02',4,11,['βασιλεία','θεός'],None,'CLAIM AppA:266 — Mark 4:11'),
 ('P','03',8,10,['βασιλεία','θεός'],None,'CLAIM AppA:266 — Luke 8:10'),
 ('P','02',4,30,['βασιλεία','θεός'],None,'CLAIM AppA:267 — Mark 4:30'),
 ('P','03',13,18,['βασιλεία','θεός'],None,'CLAIM AppA:267 — Luke 13:18'),
 ('P','02',10,14,['βασιλεία','θεός'],None,'CLAIM AppA:268 — Mark 10:14'),
 ('P','03',18,16,['βασιλεία','θεός'],None,'CLAIM AppA:268 — Luke 18:16'),
 # tense/aspect claims (AppA:289-298)
 ('P','01',4,17,['ἐγγίζω'],[(1,'X')],
                                'CLAIM AppA:290 — Matt 4:17 ἤγγικεν perfect tense of ἐγγίζω'),
 ('P','01',5,3,['εἰμί'],[(1,'P')],
                                'CLAIM AppA:291 — Matt 5:3 ἐστιν present tense'),
 ('P','01',12,28,['φθάνω'],[(1,'A')],
                                'CLAIM AppA:293 — Matt 12:28 ἔφθασεν (aorist of φθάνω)'),
 ('P','01',6,10,['ἔρχομαι'],[(1,'A'),(3,'D')],
                                'CLAIM AppA:296 — Matt 6:10 ἐλθέτω aorist imperative'),
 # ===== dikaiosyne (G1343) — AppA + Ch1:113-115 =====
 ('CNT','01',5,20,'δικαιοσύνη',1,
                                'CHECK AppA:334 — study glosses BOTH English "righteousness" in 5:20 with Greek; SBLGNT has δικαιοσύνη ONCE (KJV supplies the second)'),
 ('P','01',5,20,['περισσεύω'],None,'CLAIM Ch1:113 — Matt 5:20 "exceed" = περισσεύω'),
 ('P','01',5,6,['δικαιοσύνη'],None, 'CLAIM AppA:328 — Matt 5:6 δικαιοσύνην'),
 ('P','01',5,10,['δικαιοσύνη'],None,'CLAIM AppA:331 — Matt 5:10 δικαιοσύνης'),
 ('P','01',6,1,['δικαιοσύνη'],None, 'CLAIM AppA:337/365 — Matt 6:1 δικαιοσύνην (critical text, not ἐλεημοσύνην)'),
 ('N','01',6,1,'ἐλεημοσύνη',    'CLAIM AppA:365 — SBLGNT/NA28 Matt 6:1 reads δικαιοσύνην; ἐλεημοσύνη is the variant (should be absent; note 6:2 has it)'),
 ('P','01',6,33,['δικαιοσύνη'],None,'CLAIM AppA:340 — Matt 6:33 δικαιοσύνην'),
 ('P','01',3,15,['δικαιοσύνη','πληρόω'],None,
                                'CLAIM AppA:369 — Matt 3:15 "fulfil all righteousness" connects πληρόω + δικαιοσύνη'),
 ('P','01',21,32,['δικαιοσύνη'],None,'CLAIM AppA:370 — Matt 21:32 "way of righteousness"'),
 ('MT57CNT','δικαιοσύνη',5,     'CLAIM AppA:326/Ch1:115 — δικαιοσύνη 5x in the Sermon (5:6, 5:10, 5:20, 6:1, 6:33)'),
 # ===== katalyo (G2647) — AppA katalyo section =====
 ('P','01',24,2,['καταλύω'],None, 'CLAIM AppA:415 — Matt 24:2 καταλυθήσεται'),
 ('P','01',26,61,['καταλύω'],None,'CLAIM AppA:403/416 — Matt 26:61 "destroy the temple"'),
 ('P','01',27,40,['καταλύω'],None,'CLAIM AppA:403 — Matt 27:40 "Thou that destroyest the temple"'),
 ('P','02',14,58,['καταλύω'],None,'CLAIM AppA:403 — Mark 14:58'),
 ('P','05',6,14,['καταλύω'],None, 'CLAIM AppA:403 — Acts 6:14'),
 ('P','05',5,38,['καταλύω'],None, 'CLAIM AppA:417 — Acts 5:38 καταλυθήσεται'),
 ('P','05',5,39,['καταλύω'],None, 'CLAIM AppA:417 — Acts 5:39 καταλῦσαι'),
 ('P','09',2,18,['καταλύω'],[(1,'A')],
                                'CLAIM AppA:418 — Gal 2:18 κατέλυσα (aorist)'),
 ('P','03',9,12,['καταλύω'],None, 'CLAIM AppA:405 — Luke 9:12 lodging sense'),
 ('P','03',19,7,['καταλύω'],None, 'CLAIM AppA:405 — Luke 19:7 lodging sense'),
 # ===== nomos tou Christou — AppA law-of-Christ section =====
 ('P','09',6,2,['ἀναπληρόω','νόμος','Χριστός'],None,
                                'CLAIM AppA:448/454 — Gal 6:2 ἀναπληρόω + νόμον τοῦ Χριστοῦ'),
 ('P','07',9,21,['ἔννομος','Χριστός','ἄνομος'],None,
                                'CLAIM AppA:451/468 — 1 Cor 9:21 ἔννομος Χριστοῦ + ἄνομος category'),
 ('P','07',9,20,['νόμος'],None,  'CLAIM AppA:470 — 1 Cor 9:20 ὑπὸ νόμον category'),
 # ===== entole (G1785) / entellomai (G1781) — AppA + Ch1:224-228 =====
 ('P','01',5,19,['ἐντολή','οὗτος'],None,
                                'CLAIM AppA:498-505 — Matt 5:19 ἐντολῶν + τούτων ("these commandments")'),
 ('P','01',22,36,['ἐντολή','μέγας'],None,
                                'CLAIM AppA:511 — Matt 22:36 ἐντολὴ μεγάλη'),
 ('P','01',22,38,['ἐντολή'],None,'CLAIM AppA:511 — Matt 22:38 "first and great commandment"'),
 ('P','01',22,40,['ἐντολή'],None,'CLAIM AppA:511 — Matt 22:40 "on these two commandments" ἐντολαῖς'),
 ('P','01',28,20,['ἐντέλλομαι'],[(1,'A')],
                                'CLAIM AppA:518-521/Ch1:224 — Matt 28:20 ἐνετειλάμην aorist of ἐντέλλομαι'),
 ('N','01',28,20,'ἐντολή',      'CLAIM Ch1:228 — the noun ἐντολή does NOT appear in Matt 28:20 (verb only)'),
 ('P','04',13,34,['ἐντολή','καινός'],None,
                                'CLAIM AppA:525 — John 13:34 ἐντολὴν καινήν'),
 ('P','23',2,3,['ἐντολή'],None,  'CLAIM AppA:526 — 1 John 2:3 ἐντολάς'),
 ('P','23',2,4,['ἐντολή'],None,  'CLAIM AppA:526 — 1 John 2:4 ἐντολάς'),
 ('P','23',3,23,['ἐντολή'],None, 'CLAIM AppA:527 — 1 John 3:23 ἐντολή'),
 # ===== Ch1 / Ch4 / Overview verb claims =====
 ('P','01',7,24,['ποιέω'],None,  'CLAIM Overview:31/Ch1:200/Ch4:40 — Matt 7:24 ποιέω "doeth"'),
 ('P','01',7,26,['ποιέω'],None,  'CLAIM Ch1:200 — Matt 7:26 ποιέω (negated doer)'),
 ('P','01',7,28,['ἐκπλήσσομαι'],[(1,'I'),(2,'P')],
                                'CLAIM Ch1:213 — Matt 7:28 ἐξεπλήσσοντο imperfect passive of ἐκπλήσσω'),
 ('P','01',7,29,['ἐξουσία'],None,'CLAIM Ch1:215 — Matt 7:29 ἐξουσία "authority"'),
 # ===== Hebrew claims (morphhb, Strong's-tagged WLC) =====
 ('H','Gen',6,9,'8549',          'CLAIM AppA:128 — Gen 6:9 Noah tamim (H8549)'),
 ('H','Gen',17,1,'8549',         'CLAIM AppA:129 — Gen 17:1 "be thou perfect" tamim'),
 ('H','Deut',18,13,'8549',       'CLAIM AppA:130 — Deut 18:13 "thou shalt be perfect" tamim'),
 ('H','Ps',1,1,'835',            'CLAIM AppA:207 — Ps 1:1 ashre (H835)'),
 ('H','Ps',32,1,'835',           'CLAIM AppA:210 — Ps 32:1 ashre'),
 ('H','Ps',40,5,'835',           'CLAIM AppA:213 (folded 2026-08-03) — Ps 40:4 Eng = MT 40:5 ashre (replaced Jer 17:7, which is barukh H1288)'),
]

def parse_ok(parse, reqs):
    for idx, ch in reqs:
        if len(parse) <= idx or parse[idx] != ch:
            return False
    return True

def phrase_mt_count(book):
    # count verses containing basileia followed within 3 tokens by ouranos lemma
    rows = book_rows(book)
    verses = {}
    for r, pos, parse, lemma in rows:
        verses.setdefault(r, []).append(lemma)
    n = 0
    for r, lemmas in verses.items():
        for i, l in enumerate(lemmas):
            if l == nfc('βασιλεία') and nfc('οὐρανός') in [nfc(x) for x in lemmas[i+1:i+4]]:
                n += 1
    return n

PASS = FAIL = 0
lines = []
for c in CLAIMS:
    kind = c[0]
    ok = None; detail = ''
    if kind == 'P':
        _, book, ch, vs, lemmas, req, label = c
        rows = verse(book, ch, vs)
        vl = [l for (_,_,l) in rows]
        missing = [l for l in lemmas if nfc(l) not in vl]
        if missing:
            ok = False; detail = f"missing {','.join(missing)}; verse lemmas: {' '.join(vl[:18])}"
        elif req:
            hits = [(p, parse) for (p, parse, l) in rows if l == nfc(lemmas[0])]
            ok = any(parse_ok(parse, req) for (_, parse) in hits)
            detail = f"parses of {lemmas[0]}: {[parse for (_,parse) in hits]}"
        else:
            ok = True
    elif kind == 'N':
        _, book, ch, vs, lemma, label = c
        vl = [l for (_,_,l) in verse(book, ch, vs)]
        ok = nfc(lemma) not in vl
        detail = f"verse lemmas: {' '.join(vl[:18])}" if not ok else ''
    elif kind == 'CNT':
        _, book, ch, vs, lemma, n, label = c
        vl = [l for (_,_,l) in verse(book, ch, vs)]
        cnt = vl.count(nfc(lemma))
        ok = cnt == n; detail = f"found {cnt}, expected {n}"
    elif kind == 'MT57CNT':
        _, lemma, n, label = c
        cnt = 0
        for r, pos, parse, l in book_rows('01'):
            chnum = int(r[2:4])
            if 5 <= chnum <= 7 and l == nfc(lemma):
                cnt += 1
        ok = cnt == n; detail = f"found {cnt} in Matt 5-7, expected {n}"
    elif kind == 'PHRASE_MT':
        _, _, n, label = c
        cnt = phrase_mt_count('01')
        ok = cnt == n; detail = f"found {cnt} verses, expected {n}"
    elif kind == 'PHRASE_NT_OUTSIDE_MT':
        _, _, n, label = c
        cnt = sum(phrase_mt_count(b) for b in FILES if b != '01')
        ok = cnt == n; detail = f"found {cnt} outside Matthew, expected {n}"
    elif kind == 'H':
        _, hbook, ch, vs, strongs, label = c
        found = wlc_lemmas(hbook, ch, vs)
        if found is None:
            ok = False; detail = 'verse not found in WLC'
        else:
            ok = strongs in found
            detail = f"strongs present: {sorted(found)}" if not ok else ''
    status = 'PASS' if ok else 'FAIL'
    if ok: PASS += 1
    else: FAIL += 1
    lines.append(f"[{status}] {label}" + (f"\n         {detail}" if detail and not ok else ''))

print(f"Lexeme audit — Sermon on the Mount: {PASS} pass, {FAIL} fail, {len(CLAIMS)} claims\n")
for l in lines:
    print(l)
