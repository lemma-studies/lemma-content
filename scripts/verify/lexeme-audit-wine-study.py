import re, os
DIR=os.path.expanduser('/tmp/claude-1000/-home-tim/898f9e2e-7ea8-4d41-8eeb-0e3a074d6f64/scratchpad/morphhb')
cache={}
def lemmas(book,ch,vs):
    if book not in cache:
        cache[book]=open(f'{DIR}/{book}.xml').read()
    m=re.search(rf'osisID="{book}\.{ch}\.{vs}"(.*?)</verse>',cache[book],re.S)
    if not m: return None
    out=set()
    for l in re.findall(r'lemma="([^"]+)"',m.group(1)):
        for part in l.split('/'):
            part=part.strip().split(' ')[0]
            if part.isdigit(): out.add(part)
    return out
CLAIMS=[
 ("Gen",9,21,"3196","yayin: Noah"),("1Sam",25,36,"3196","yayin: Nabal 25:36"),("1Sam",25,37,"3196","yayin: Nabal 25:37"),
 ("Prov",20,1,"3196","yayin: Prov 20:1"),("Prov",20,1,"7941","shekar: Prov 20:1"),("Prov",20,1,"3887","lets: Prov 20:1"),
 ("Prov",23,30,"3196","yayin: Prov 23:30"),("Prov",23,30,"4469","mimsak: Prov 23:30"),("Prov",23,31,"3196","yayin: Prov 23:31"),
 ("Isa",25,6,"3196","yayin: Isa 25:6 [App A yayin entry]"),
 ("Ps",104,15,"3196","yayin: Ps 104:15"),("Ps",104,15,"3824","lebab: Ps 104:15"),
 ("Gen",27,25,"3196","yayin: Gen 27:25"),("Gen",14,18,"3196","yayin: Melchizedek"),("Gen",49,11,"3196","yayin: Gen 49:11"),
 ("Num",15,5,"3196","yayin: Num 15:5"),("Num",28,7,"7941","shekar: Num 28:7"),
 ("Deut",14,26,"3196","yayin: Deut 14:26"),("Deut",14,26,"7941","shekar: Deut 14:26"),
 ("Isa",5,11,"7941","shekar: Isa 5:11"),("Isa",5,11,"3196","yayin: Isa 5:11"),
 ("Hab",2,15,"3196","yayin: Hab 2:15 [App A yayin function list]"),
 ("Isa",55,1,"3196","yayin: Isa 55:1"),
 ("Deut",7,13,"8492","tirosh: Deut 7:13"),("Deut",11,14,"8492","tirosh: Deut 11:14"),("Deut",28,51,"8492","tirosh: Deut 28:51"),
 ("Prov",3,10,"8492","tirosh: Prov 3:10"),("Hos",4,11,"3196","yayin: Hos 4:11"),("Hos",4,11,"8492","tirosh: Hos 4:11"),
 ("Zech",9,17,"8492","tirosh: Zech 9:17"),("Judg",9,13,"8492","tirosh: Judg 9:13"),("Isa",65,8,"8492","tirosh: Isa 65:8"),
 ("Mic",6,15,"8492","tirosh: Mic 6:15"),("Mic",6,15,"3196","yayin: Mic 6:15"),
 ("Lev",10,9,"3196","yayin: Lev 10:9"),("Lev",10,9,"7941","shekar: Lev 10:9"),
 ("Num",6,3,"3196","yayin: Num 6:3"),("Num",6,3,"7941","shekar: Num 6:3"),("Judg",13,4,"7941","shekar: Judg 13:4"),
 ("Joel",1,5,"6071","asis: Joel 1:5"),("Isa",49,26,"6071","asis: Isa 49:26"),
 ("Joel",4,18,"6071","asis: Joel 3:18 EN = MT 4:18"),("Amos",9,13,"6071","asis: Amos 9:13"),("Song",8,2,"6071","asis: Song 8:2"),
 ("Deut",32,14,"2561","chemer: Deut 32:14"),("Isa",27,2,"2561","chemer: Isa 27:2 [known chemed variant risk]"),
 ("Ezra",6,9,"2562","chamar: Ezra 6:9"),("Ezra",7,22,"2562","chamar: Ezra 7:22"),("Dan",5,1,"2562","chamar: Dan 5:1"),
 ("Gen",43,34,"7937","shakar vb: Gen 43:34"),("Song",5,1,"7937","shakar vb: Song 5:1"),
 ("Prov",31,4,"3196","yayin: Prov 31:4"),("Prov",31,4,"7941","shekar: Prov 31:4"),
 ("Prov",31,6,"7941","shekar: Prov 31:6"),("Prov",31,6,"3196","yayin: Prov 31:6"),
 ("Prov",9,5,"3196","yayin: Prov 9:5"),
 ("2Sam",16,1,"3196","yayin: 2Sam 16:1"),("1Chr",27,27,"3196","yayin: 1Chr 27:27"),
 ("Deut",21,20,"2151","zolel: Deut 21:20"),("Deut",21,20,"5433","sove: Deut 21:20"),
 ("Prov",23,20,"5433","sove: Prov 23:20"),("Prov",23,20,"2151","zolel: Prov 23:20"),
 ("Prov",23,21,"5433","sove: Prov 23:21"),("Prov",23,21,"2151","zolel: Prov 23:21"),
]
fails=[]
for book,ch,vs,strong,label in CLAIMS:
    ls_=lemmas(book,ch,vs)
    if ls_ is None: print(f"?? VERSE NOT FOUND {book} {ch}:{vs} — {label}"); fails.append(label); continue
    if strong in ls_: print(f"PASS  {label}")
    else: print(f"FAIL  {label} — lemmas present: {sorted(ls_)}"); fails.append(label)
print(f"\n{len(CLAIMS)-len(fails)}/{len(CLAIMS)} passed. FAILURES: {len(fails)}")
for f in fails: print(" -",f)
