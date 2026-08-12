#!/usr/bin/env python3
# Lexeme audit — What Is the Perfect study.
# Verifies every Greek lemma + morphology attribution the manuscript makes
# against the tagged MorphGNT/SBLGNT corpus (github.com/morphgnt/sblgnt).
# Pattern follows lexeme-audit-wine-study.py (morphhb/WLC for Hebrew there).
#
# MorphGNT columns: ref(BBCCVV) POS parse text word normalized lemma
# Parse code (8 chars): person tense voice mood case number gender degree
#   tense: P present, I imperfect, F future, A aorist, X perfect, Y pluperfect
#   voice: A active, M middle, P passive
#   mood:  I indicative, S subjunctive, P participle, D imperative, N infinitive, O optative
import os, sys, unicodedata

DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser(
    '/tmp/claude-1000/-home-tim/d914d3a8-ac1f-4ab4-a113-f9c461115fb7/scratchpad/morphgnt')

FILES = {'01': '61-Mt.txt', '04': '64-Jn.txt', '07': '67-1Co.txt', '09': '69-Ga.txt',
         '10': '70-Eph.txt', '16': '76-2Ti.txt', '20': '80-Jas.txt', '05': '65-Ac.txt',
         '23': '83-1Jn.txt', '06': '66-Ro.txt', '12': '72-Col.txt', '11': '71-Php.txt',
         '19': '79-Heb.txt', '08': '68-2Co.txt'}

def nfd(s):
    return unicodedata.normalize('NFC', s)

_cache = {}
def verse(book, ch, vs):
    if book not in _cache:
        rows = []
        with open(os.path.join(DIR, FILES[book]), encoding='utf-8') as f:
            for line in f:
                p = line.split()
                if len(p) >= 7:
                    rows.append((p[0], p[1], p[2], nfd(p[6])))
        _cache[book] = rows
    ref = f"{book}{ch:02d}{vs:02d}"
    return [(pos, parse, lemma) for (r, pos, parse, lemma) in _cache[book] if r == ref]

# (book, ch, vs, lemma, parse_requirements as (index, expected_char) list or None,
#  present=True/False, label describing the manuscript's claim)
C = lambda *a: a
CLAIMS = [
 # --- 1 Cor 13:8 ---
 C('07',13,8,'παύω',[(1,'F'),(2,'M'),(3,'I')],True,'παύσονται future middle indicative (tongues) — Ch1/AppA/At-a-Glance'),
 C('07',13,8,'καταργέω',[(1,'F'),(2,'P')],True,'καταργηθήσ- future passive (prophecies/knowledge) — Ch1/AppA'),
 # --- 1 Cor 13:9 ---
 C('07',13,9,'μέρος',None,True,'ἐκ μέρους (in part) — AppA entry'),
 # --- 1 Cor 13:10 ---
 C('07',13,10,'τέλειος',None,True,'τὸ τέλειον present in v.10'),
 C('07',13,10,'ἔρχομαι',[(1,'A'),(3,'S')],True,'ὅταν ἔλθῃ aorist subjunctive — Ch1 grammar claim'),
 C('07',13,10,'καταργέω',[(1,'F'),(2,'P')],True,'καταργηθήσεται future passive in v.10'),
 # --- 1 Cor 13:11 ---
 C('07',13,11,'γίνομαι',[(1,'X')],True,'γέγονα PERFECT (corrected from aorist per Fable F6) — Ch1'),
 C('07',13,11,'καταργέω',[(1,'X'),(2,'A')],True,'κατήργηκα perfect active — Ch1 "perfect tense" claim'),
 C('07',13,11,'λαλέω',[(1,'I')],True,'ἐλάλουν imperfect — Ch1'),
 C('07',13,11,'φρονέω',[(1,'I')],True,'ἐφρόνουν imperfect — Ch1'),
 C('07',13,11,'λογίζομαι',[(1,'I')],True,'ἐλογιζόμην imperfect — Ch1'),
 # --- 1 Cor 13:12 ---
 C('07',13,12,'ἔσοπτρον',None,True,'ἔσοπτρον in v.12 — AppA entry'),
 C('07',13,12,'αἴνιγμα',None,True,'ἐν αἰνίγματι in v.12 — AppA entry'),
 C('07',13,12,'ἐπιγινώσκω',[(1,'F'),(2,'M')],True,'ἐπιγνώσομαι future middle — Ch1'),
 C('07',13,12,'ἐπιγινώσκω',[(1,'A'),(2,'P')],True,'ἐπεγνώσθην aorist passive — Ch1'),
 C('07',13,12,'γινώσκω',[(1,'P')],True,'γινώσκω present (arti ginōskō) — Ch1'),
 # --- 1 Cor 13:13 ---
 C('07',13,13,'νυνί',None,True,'νυνὶ δέ in v.13 — Ch1/AppA'),
 C('07',13,13,'μένω',[(1,'P')],True,'μένει present — AppA'),
 # --- Eph 4:13 ---
 C('10',4,13,'τέλειος',None,True,'ἄνδρα τέλειον — Ch1 Ephesians parallel'),
 C('10',4,13,'ἀνήρ',None,True,'ἄνδρα in Eph 4:13'),
 # --- 2 Tim 3:17 (the Gemini F1 fix: artios present, teleios ABSENT) ---
 C('16',3,17,'ἄρτιος',None,True,'ἄρτιος in 2 Tim 3:17 — corrected claim'),
 C('16',3,17,'ἐξαρτίζω',[(1,'X'),(2,'P'),(3,'P')],True,'ἐξηρτισμένος perfect passive participle'),
 C('16',3,17,'τέλειος',None,False,'NEGATIVE: τέλειος absent from 2 Tim 3:17'),
 C('16',3,16,'τέλειος',None,False,'NEGATIVE: τέλειος absent from 2 Tim 3:16'),
 # --- Jas 1:25 ---
 C('20',1,25,'τέλειος',None,True,'νόμον τέλειον — keep-James half of the fix'),
 # --- John 17:23 ---
 C('04',17,23,'τελειόω',[(1,'X'),(2,'P'),(3,'P')],True,'τετελειωμένοι perfect passive participle — Ch0/Ch2/Ch5'),
 # --- Round-2 additions (Fable v2 findings) ---
 C('07',8,2,'ἐπιγινώσκω',None,False,'NEGATIVE: no ἐπιγινώσκω in 1 Cor 8:2 (App A fix)'),
 C('07',8,3,'γινώσκω',None,True,'ἔγνωσται simplex in 1 Cor 8:3'),
 C('09',4,9,'ἐπιγινώσκω',None,False,'NEGATIVE: Gal 4:9 has simplex γνωσθέντες, not compound'),
 C('09',4,9,'γινώσκω',None,True,'γνόντες/γνωσθέντες simplex in Gal 4:9'),
 C('01',11,27,'ἐπιγινώσκω',None,True,'Matt 11:27 compound (kept contrast prooftext)'),
 C('06',1,32,'ἐπιγινώσκω',None,True,'Rom 1:32 compound (kept contrast prooftext)'),
 C('12',1,6,'ἐπιγινώσκω',None,True,'Col 1:6 compound (kept contrast prooftext)'),
 C('20',1,17,'δώρημα',None,True,'Jas 1:17 δώρημα τέλειον (corrected from δόμα)'),
 C('20',1,23,'ἔσοπτρον',None,True,'Jas 1:23 ἔσοπτρον (View 1 conjunction argument)'),
 C('05',20,1,'παύω',[(3,'N')],True,'Acts 20:1 παύσασθαι infinitive (corrected from indicative)'),
 C('07',15,54,'ὅταν',None,True,'1 Cor 15:54 ὅταν parallel'),
 C('23',3,2,'ὅταν',None,False,'NEGATIVE: 1 Jn 3:2 has ἐάν, not ὅταν (parallel recast)'),
 C('07',2,6,'τέλειος',None,True,'1 Cor 2:6 τέλειος (View 3 usage list)'),
 C('07',14,20,'τέλειος',None,True,'1 Cor 14:20 τέλειος (View 3 usage list)'),
 C('11',3,15,'τέλειος',None,True,'Phil 3:15 τέλειος (View 3 usage list)'),
 C('12',1,28,'τέλειος',None,True,'Col 1:28 τέλειος (View 3 usage list)'),
 # --- v4.2 additions ---
 C('19',1,1,'πολυμερῶς',None,True,'Heb 1:1 πολυμερῶς (View 1 argument 8 bridge)'),
 C('08',3,18,'κατοπτρίζομαι',None,True,'2 Cor 3:18 κατοπτριζόμενοι (App A esoptron note)'),
 # --- Matt 5:48 ---
 C('01',5,48,'τέλειος',None,True,'τέλειοι/τέλειος in Matt 5:48 — Ch2'),
 C('01',5,48,'εἰμί',[(1,'F')],True,'Ἔσεσθε future of εἰμί in Matt 5:48 — Fable R3 F1 fix'),
 C('01',5,48,'γίνομαι',None,False,'NEGATIVE: no γίνομαι in Matt 5:48 (fabricated ginesthe removed)'),
]

fails = []
for book, ch, vs, lemma, parsereq, present, label in CLAIMS:
    rows = verse(book, ch, vs)
    if not rows:
        print(f"?? VERSE NOT FOUND {book} {ch}:{vs} — {label}"); fails.append(label); continue
    hits = [(pos, parse) for (pos, parse, lm) in rows if lm == nfd(lemma)]
    if not present:
        if hits: print(f"FAIL  {label} — lemma unexpectedly PRESENT"); fails.append(label)
        else: print(f"PASS  {label}")
        continue
    if not hits:
        print(f"FAIL  {label} — lemma not in verse; lemmas: {sorted({lm for _,_,lm in rows})}")
        fails.append(label); continue
    if parsereq:
        ok = any(all(parse[i] == c for (i, c) in parsereq) for (_, parse) in hits)
        if ok: print(f"PASS  {label}")
        else:
            print(f"FAIL  {label} — parses found: {[p for _, p in hits]}"); fails.append(label)
    else:
        print(f"PASS  {label}")

print(f"\n{len(CLAIMS)-len(fails)}/{len(CLAIMS)} passed. FAILURES: {len(fails)}")
for f in fails: print(" -", f)
