#!/usr/bin/env python3
# Lexeme audit — Trumpet Call Study (rapture/antichrist ordering).
# Verifies every verse-level original-language attribution the manuscript makes
# against tagged ground-truth texts:
#   NT Greek : MorphGNT/SBLGNT (github.com/morphgnt/sblgnt)
#   Hebrew/Aramaic : Strong's-tagged WLC (OpenScriptures morphhb)
# Pattern follows lexeme-audit-perfect-study.py (Greek) and
# lexeme-audit-wine-study.py (Hebrew).
#
# MorphGNT columns: ref(BBCCVV) POS parse text word normalized lemma
# Parse code (8 chars): person tense voice mood case number gender degree
#   tense: P present, I imperfect, F future, A aorist, X perfect, Y pluperfect
#   voice: A active, M middle, P passive
#   mood:  I indicative, S subjunctive, P participle, D imperative, N infinitive, O optative
import os, re, sys, unicodedata

BASE = sys.argv[1] if len(sys.argv) > 1 else \
    '/tmp/claude-1000/-home-tim/a3066745-1008-4401-8f12-aea477492ae8/scratchpad'
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
    if hbook not in _cache:
        _cache[hbook] = open(path, encoding='utf-8').read()
    m = re.search(rf'osisID="{hbook}\.{ch}\.{vs}"(.*?)</verse>', _cache[hbook], re.S)
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
#        (used both for manuscript negative claims and to test manuscript
#         claims we expect to be wrong — a FAIL here = lemma unexpectedly present)
#   CNT (book,ch,vs, lemma, n, label)            lemma occurs exactly n times in verse
#   NT  (lemma, n, label)                        lemma occurs exactly n times in whole NT
#   BK  (book, lemma, min_n, label)              lemma occurs >= min_n times in book
#   RNG (book,ch,vs1,vs2, lemma, label)          lemma occurs somewhere in ch:vs1-vs2
#   H   (hbook,ch,vs, strongs, label)            Strong's number present in WLC verse
# ---------------------------------------------------------------------------
CLAIMS = [
 # ===== harpazo (G726) — Appendix A + Ch1 word study =====
 ('P','01',12,29,['ἁρπάζω'],None,        'harpazo in Matt 12:29 (AppA:20 semantic range; strong man)'),
 ('P','01',13,19,['ἁρπάζω'],None,        'harpazo in Matt 13:19 (AppA:21/48; Ch1:215 "catcheth away")'),
 ('P','04',6,15,['ἁρπάζω'],None,         'harpazo in John 6:15 (AppA:22 "take him by force"; Ch1:210)'),
 ('P','04',10,29,['ἁρπάζω'],None,        'harpazo in John 10:29 (Ch1:216 "pluck out of my Father\'s hand")'),
 ('P','05',8,39,['ἁρπάζω'],None,         'harpazo in Acts 8:39 (AppA:23/34; Ch1:211,217 Philip)'),
 ('P','05',8,39,['ἁρπάζω'],[(1,'A'),(2,'P')],
                                          'CLAIM AppA:38 — Acts 8:39 harpazo "aorist passive"'),
 ('P','08',12,2,['ἁρπάζω'],None,         'harpazo in 2 Cor 12:2 (AppA:23/41; Ch1:218 third heaven)'),
 ('P','08',12,4,['ἁρπάζω'],None,         'harpazo in 2 Cor 12:4 (AppA:23/41; Ch1:219 paradise)'),
 ('P','13',4,17,['ἁρπάζω'],None,         'harpazo in 1 Thess 4:17 (AppA:27-31; Ch1:220; AppH:13; Ch4:35)'),
 ('P','13',4,17,['ἁρπάζω'],[(1,'A'),(2,'P')],
                                          'CLAIM AppA:30-33 — 1 Thess 4:17 harpazo "aorist passive / aorist tense = point event"'),
 ('P','27',12,5,['ἁρπάζω'],None,         'harpazo in Rev 12:5 (Ch1:29,221 "child caught up unto God")'),
 # ===== antichristos (G500) =====
 ('CNT','23',2,18,'ἀντίχριστος',2,       'antichristos 2x in 1 John 2:18 (AppA:100-103 singular "shall come" + plural "many antichrists")'),
 ('P','23',2,22,['ἀντίχριστος'],None,    'antichristos in 1 John 2:22 (AppA:107; Ch1:238; AppG:13)'),
 ('P','23',4,3,['ἀντίχριστος'],None,     'antichristos in 1 John 4:3 (AppA:94; Ch1:239; AppG:13)'),
 ('P','24',1,7,['ἀντίχριστος'],None,     'antichristos in 2 John 7 (AppA:113-114; AppG:13)'),
 ('P','23',3,24,['ἀντίχριστος'],None,    'CLAIM AppG:13 — antichristos in "1 John 3:24"'),
 ('NT','ἀντίχριστος',4,                  'CLAIM AppG:13 — "4 occurrences in 1-2 John" (= whole NT; word occurs nowhere else)'),
 ('N','01',24,5,'ἀντίχριστος',           'NOTE Ch1:233/AppA — Matt 24:5 listed under antichristos semantic range; word itself absent (expected: christos)'),
 ('N','01',24,24,'ἀντίχριστος',          'NOTE Ch1:233/AppA — Matt 24:24 listed under antichristos semantic range; word itself absent (expected: pseudochristos)'),
 ('P','01',24,24,['ψευδόχριστος'],None,  'supporting — pseudochristos is the actual Matt 24:24 term'),
 # ===== parousia (G3952) =====
 ('P','08',10,10,['παρουσία'],None,      'parousia in 2 Cor 10:10 (AppA:149 "bodily presence")'),
 ('P','07',16,17,['παρουσία'],None,      'parousia in 1 Cor 16:17 (AppA:150 coming of Stephanas)'),
 ('P','13',2,19,['παρουσία'],None,       'parousia in 1 Thess 2:19 (AppA:151,155-159)'),
 ('CNT','13',2,19,'παρουσία',2,          'CLAIM AppA:156 — 1 Thess 2:19 glossed "presence (parousia)... coming (parousia)" = 2 occurrences'),
 ('P','13',3,13,['παρουσία'],None,       'parousia in 1 Thess 3:13 (AppA:161-165)'),
 ('P','13',4,15,['παρουσία'],None,       'parousia in 1 Thess 4:15 (AppA:167-171)'),
 ('P','13',5,23,['παρουσία'],None,       'parousia in 1 Thess 5:23 (AppA:173-177)'),
 ('P','01',24,3,['παρουσία'],None,       'parousia in Matt 24:3 (Ch1:141 Olivet key term)'),
 ('P','14',2,1,['παρουσία'],None,        'parousia in 2 Thess 2:1 ("by the coming of our Lord" — AppH:17-20 context)'),
 # ===== salpinx (G4536) =====
 ('P','07',14,8,['σάλπιγξ'],None,        'salpinx in 1 Cor 14:8 (AppA:209 military trumpet)'),
 ('P','07',15,52,['σάλπιγξ','ἔσχατος'],None,
                                          'salpinx + eschatos in 1 Cor 15:52 (AppA:215-218 "eschatos salpinx"; Ch1:307)'),
 ('P','13',4,16,['σάλπιγξ','θεός'],None, 'salpinx theou in 1 Thess 4:16 (AppA:222-225 "trump of God")'),
 ('P','01',24,31,['σάλπιγξ'],None,       'salpinx in Matt 24:31 (Ch1:129,136 trumpet gathers the elect; Ch4:150)'),
 # ===== apostasia (G646) =====
 ('P','14',2,3,['ἀποστασία'],None,       'apostasia in 2 Thess 2:3 (AppA:258-263 "falling away")'),
 ('P','05',21,21,['ἀποστασία'],None,     'apostasia in Acts 21:21 (AppA:265-269 "forsake Moses")'),
 ('NT','ἀποστασία',2,                    'CLAIM AppA:267 — Acts 21:21 is "the only other NT occurrence" (NT total = 2)'),
 # ===== orge (G3709) =====
 ('P','13',1,10,['ὀργή'],None,           'orge in 1 Thess 1:10 (AppA:299-300 "wrath to come")'),
 ('P','13',5,9,['ὀργή'],None,            'orge in 1 Thess 5:9 (AppA:302-303; Ch1:56; Ch4:84)'),
 ('P','27',6,16,['ὀργή'],None,           'orge in Rev 6:16 (AppA:305-306 "wrath of the Lamb")'),
 ('P','27',6,17,['ὀργή'],None,           'orge in Rev 6:17 (AppA:305-306 "day of his wrath")'),
 ('P','06',5,9,['ὀργή'],None,            'orge in Rom 5:9 (AppA:308-309 "saved from wrath")'),
 # ===== thlipsis (G2347) =====
 ('P','04',16,33,['θλῖψις'],None,        'thlipsis in John 16:33 (AppA:331,337-338)'),
 ('P','01',24,21,['θλῖψις','μέγας'],None,'thlipsis megale in Matt 24:21 (AppA:333,340-341; Ch4:150)'),
 ('P','27',7,14,['θλῖψις','μέγας'],None, 'thlipsis (great tribulation) in Rev 7:14 (AppA:343-344)'),
 ('P','05',14,22,['θλῖψις'],None,        'thlipsis in Acts 14:22 (AppA:332,346-347)'),
 # ===== apantesis (G529) vs apantao (G528) =====
 ('P','13',4,17,['ἀπάντησις'],None,      'apantesis (noun) in 1 Thess 4:17 (AppA:358-371; Ch4:129,144; Ch3:260)'),
 ('P','01',25,6,['ἀπάντησις'],None,      'apantesis in Matt 25:6 (AppA:373-374 bridegroom; SBLGNT reads apantesin)'),
 ('P','05',28,15,['ἀπάντησις'],None,     'apantesis in Acts 28:15 (AppA:376-377 Appii Forum)'),
 ('P','13',4,17,['ἀπαντάω'],None,        'CLAIM AppH:14,68 — "to meet — apantao (verb)" in 1 Thess 4:17'),
 # ===== 2 Thess 2 terminology =====
 ('P','14',2,3,['ἁμαρτία'],None,         'CLAIM Ch1:91/AppG:14 — "man of sin, ho anthropos tes hamartias" in 2 Thess 2:3 [TR/KJV vs SBLGNT edition]'),
 ('P','14',2,3,['ἀνομία','ἄνθρωπος'],None,
                                          'anthropos tes anomias in 2 Thess 2:3 (AppG:15 "variant reading" — SBLGNT/critical text)'),
 ('P','14',2,3,['υἱός','ἀπώλεια'],None,  'huios tes apoleias in 2 Thess 2:3 (Ch1:92 "son of perdition")'),
 ('P','14',2,6,['κατέχω'],None,          'to katechon in 2 Thess 2:6 (Ch1:93; Ch3:304)'),
 ('P','14',2,7,['κατέχω'],None,          'ho katechon in 2 Thess 2:7 (Ch3:304)'),
 ('P','14',2,8,['ἄνομος'],None,          'ho anomos in 2 Thess 2:8 (Ch1:94,256,279 "that Wicked")'),
 ('P','14',2,3,['ἄνομος'],None,          'CLAIM Ch1:279 — v8 anomos is the "same Greek" as in v3 (i.e. anomos present in 2 Thess 2:3)'),
 ('P','14',2,1,['ἐπισυναγωγή'],None,     'episynagoge in 2 Thess 2:1 (AppH:20; Ch5:117 "our gathering together")'),
 # ===== Rev 3:10 (Ch5:45) =====
 ('P','27',3,10,['κατέχω'],None,         'CLAIM Ch5:45 — "the Greek term katecho (to keep from) in Revelation 3:10"'),
 ('P','27',3,10,['τηρέω','ἐκ'],None,     'supporting — Rev 3:10 actual wording: tereo ("I will keep thee") + ek ("out of the hour")'),
 # ===== episynagoge in Hebrews (AppH:64) =====
 ('P','19',12,23,['ἐπισυναγωγή'],None,   'CLAIM AppH:64 — "Paul uses episynagoge elsewhere — Hebrews 12:23 general assembly"'),
 ('RNG','19',12,22,23,'πανήγυρις',        'supporting — KJV Heb 12:23 "general assembly" = panegyris (SBLGNT verse division places it at 12:22)'),
 ('P','19',12,23,['ἐκκλησία'],None,      'supporting — Heb 12:23 "church of the firstborn" = ekklesia (not episynagoge)'),
 ('P','19',10,25,['ἐπισυναγωγή'],None,   'supporting — the only other NT episynagoge is Heb 10:25 ("assembling of ourselves")'),
 # ===== 1 Cor 15:51-52 word study (Ch1:306-309) =====
 ('P','07',15,52,['ἀλλάσσω'],None,       'allasso in 1 Cor 15:52 (Ch1:308 "changed")'),
 ('P','07',15,51,['μυστήριον','ἀλλάσσω'],None,
                                          'mysterion (+ allasso "we shall all be changed") in 1 Cor 15:51 (Ch1:309; Ch4:27)'),
 # ===== 1 Thess 5:1 (Ch1:54) =====
 ('P','13',5,1,['χρόνος','καιρός'],None, 'chronos kai kairos in 1 Thess 5:1 (Ch1:54 "times and seasons")'),
 # ===== Matt 24 key terms (Ch1:139-142) =====
 ('P','01',24,14,['τέλος'],None,         'to telos in Matt 24:14 (Ch1:140 "then shall the end come")'),
 ('P','01',24,8,['ὠδίν'],None,           'odines in Matt 24:8 (Ch1:142 "beginning of sorrows" = birth pangs)'),
 ('P','01',24,31,['ἐπισυνάγω'],None,     'NOTE Ch5:117 — Matt 24:31 gathering verb is episynago, same syn+ago root the claim calls "different"'),
 # ===== Appendix G: therion occurrence list =====
 ('P','27',11,7,['θηρίον'],None,         'therion in Rev 11:7 (AppG:17)'),
 ('RNG','27',13,1,10,'θηρίον',           'therion in Rev 13:1-10 (AppG:17)'),
 ('P','27',14,9,['θηρίον'],None,         'therion in Rev 14:9 (AppG:17)'),
 ('P','27',15,2,['θηρίον'],None,         'therion in Rev 15:2 (AppG:17)'),
 ('P','27',16,2,['θηρίον'],None,         'therion in Rev 16:2 (AppG:17)'),
 ('P','27',16,10,['θηρίον'],None,        'therion in Rev 16:10 (AppG:17)'),
 ('P','27',16,13,['θηρίον'],None,        'therion in Rev 16:13 (AppG:17)'),
 ('RNG','27',17,3,17,'θηρίον',           'therion in Rev 17:3-17 (AppG:17)'),
 ('P','27',19,19,['θηρίον'],None,        'therion in Rev 19:19 (AppG:17)'),
 ('P','27',20,4,['θηρίον'],None,         'therion in Rev 20:4 (AppG:17)'),
 ('P','27',20,10,['θηρίον'],None,        'therion in Rev 20:10 (AppG:17)'),
 ('BK','27','θηρίον',36,                 'CLAIM AppG:17 — therion "36+ occurrences in Revelation"'),
 # ===== Appendix G: false prophet =====
 ('P','27',16,13,['ψευδοπροφήτης'],None, 'pseudoprophetes in Rev 16:13 (AppG:19)'),
 ('P','27',19,20,['ψευδοπροφήτης'],None, 'pseudoprophetes in Rev 19:20 (AppG:19,36,53)'),
 ('P','27',20,10,['ψευδοπροφήτης'],None, 'pseudoprophetes in Rev 20:10 (AppG:19)'),
 # ===== Appendix G: Babylon =====
 ('P','27',14,8,['Βαβυλών'],None,        'Babylon in Rev 14:8 (AppG:20)'),
 ('P','27',16,19,['Βαβυλών'],None,       'Babylon in Rev 16:19 (AppG:20)'),
 ('P','27',17,5,['Βαβυλών'],None,        'Babylon in Rev 17:5 (AppG:20)'),
 ('P','27',18,2,['Βαβυλών'],None,        'Babylon in Rev 18:2 (AppG:20)'),
 ('P','27',18,10,['Βαβυλών'],None,       'Babylon in Rev 18:10 (AppG:20)'),
 ('P','27',18,21,['Βαβυλών'],None,       'Babylon in Rev 18:21 (AppG:20)'),
 # ===== Appendix G: little horn (Aramaic, Dan 7:8) =====
 ('H','Dan',7,8,'7162',                  'qeren (horn, Aramaic H7162) in Dan 7:8 (AppG:18 "qeren z`arah")'),
 ('H','Dan',7,8,'2192',                  'ze`er (little, Aramaic H2192) in Dan 7:8 (AppG:18 "qeren z`arah")'),
]

fails = []
def report(ok, label, detail=''):
    if ok:
        print(f"PASS  {label}")
    else:
        print(f"FAIL  {label}{' — ' + detail if detail else ''}")
        fails.append(label + (f" — {detail}" if detail else ''))

for claim in CLAIMS:
    kind = claim[0]
    if kind == 'P':
        _, book, ch, vs, lemmas, parsereq, label = claim
        rows = verse(book, ch, vs)
        if not rows:
            report(False, label, f"VERSE NOT FOUND {book} {ch}:{vs}"); continue
        vl = {lm for _, _, lm in rows}
        missing = [l for l in lemmas if nfc(l) not in vl]
        if missing:
            report(False, label, f"lemma(s) {missing} not in verse; lemmas: {sorted(vl)}"); continue
        if parsereq:
            hits = [parse for _, parse, lm in rows if lm == nfc(lemmas[0])]
            ok = any(all(p[i] == c for (i, c) in parsereq) for p in hits)
            report(ok, label, '' if ok else f"parses found for {lemmas[0]}: {hits}")
        else:
            report(True, label)
    elif kind == 'N':
        _, book, ch, vs, lemma, label = claim
        rows = verse(book, ch, vs)
        if not rows:
            report(False, label, f"VERSE NOT FOUND {book} {ch}:{vs}"); continue
        present = any(lm == nfc(lemma) for _, _, lm in rows)
        report(not present, label, 'lemma unexpectedly PRESENT' if present else '')
    elif kind == 'CNT':
        _, book, ch, vs, lemma, n, label = claim
        rows = verse(book, ch, vs)
        cnt = sum(1 for _, _, lm in rows if lm == nfc(lemma))
        report(cnt == n, label, f"actual count in verse = {cnt}" if cnt != n else '')
    elif kind == 'NT':
        _, lemma, n, label = claim
        cnt, wh = 0, []
        for book in FILES:
            for r, _, _, lm in book_rows(book):
                if lm == nfc(lemma):
                    cnt += 1; wh.append(f"{FILES[book][3:-4]} {r}")
        report(cnt == n, label, f"actual NT count = {cnt}: {wh}" if cnt != n else '')
    elif kind == 'BK':
        _, book, lemma, mn, label = claim
        cnt = sum(1 for _, _, _, lm in book_rows(book) if lm == nfc(lemma))
        report(cnt >= mn, label, f"actual count = {cnt}" if cnt < mn else f"(actual = {cnt})")
        if cnt >= mn:
            pass
    elif kind == 'RNG':
        _, book, ch, v1, v2, lemma, label = claim
        found = any(any(lm == nfc(lemma) for _, _, lm in verse(book, ch, v))
                    for v in range(v1, v2 + 1))
        report(found, label, '' if found else f"lemma not found anywhere in {ch}:{v1}-{v2}")
    elif kind == 'H':
        _, hbook, ch, vs, strongs, label = claim
        ls_ = wlc_lemmas(hbook, ch, vs)
        if ls_ is None:
            report(False, label, f"VERSE NOT FOUND {hbook} {ch}:{vs}"); continue
        report(strongs in ls_, label, '' if strongs in ls_ else f"Strong's present: {sorted(ls_)}")

print(f"\n{len(CLAIMS)-len(fails)}/{len(CLAIMS)} passed. FAILURES: {len(fails)}")
for f in fails:
    print(" -", f)
