# MELNĀ KASTE — WEB V5

Universāla pārlūkā darbināma pasākumu spēle no **2 dalībniekiem**, bez fiksēta dalībnieku limita lietotnes loģikā. Viena izvietota instance pašlaik uztur **vienu spēles istabu vienlaikus**. Reālais vienlaicīgo lietotāju limits atkarīgs no servera jaudas; liela mēroga slodzes testi nav veikti.

## Spēles plūsma
1. TV atver `/tv`, kur parādās pievienošanās QR un sešzīmju istabas kods.
2. Katrs atver `/join`, ievada tikai vārdu. Sesijas atslēga saglabājas konkrētā pārlūka `localStorage` (nav jāveido konts).
3. Organizators atver `/admin`, ievada `ADMIN_PIN` un sāk spēli (vajag vismaz 2 dalībniekus).
4. Automātiski vai manuāli tiek izsaukts spēlētājs: TV redzams vārds, 60 sekunžu taimeris un QR.
5. QR atver **atsevišķu saiti** `/mission/<nonce>` tālruņa pārlūkā. Slepeno saturu var atvērt tikai izsauktais dalībnieks ar derīgu sesiju.
6. Misijas, priekšrocības, duelis vai izvēle ietekmē spēles norisi. **Digitālas likmes un kredīti netiek izmantoti**; vienošanās notiek tikai klātienē.

## Neredzamā režija
Tikai organizatora panelī ir nelielas pogas:
- `⏩` / `N` — uzreiz izsaukt nākamo; aktīva QR gadījumā saīsināt atlikušo laiku līdz 5 sekundēm.
- `↷` / `S` — klusām izlaist aktuālo QR vai aktīvu uzdevumu.
- `⇄` / `R` — nomainīt izsaukto spēlētāju, saglabājot notikuma tipu.

TV nerāda režijas komandu nosaukumus. Mainot izsaukto dalībnieku, TV vienkārši atjaunojas ar citu vārdu. Tastatūras saīsnes darbojas, kad fokuss nav ievades laukā.

## Palaišana lokāli (testēšanai)
```bash
pip install -r requirements.txt
export ADMIN_PIN='izdomā-garu-drošu-paroli'
uvicorn app:app --host 0.0.0.0 --port 8000
```
Windows PowerShell: `$env:ADMIN_PIN="izdomā-garu-drošu-paroli"`; tad `uvicorn app:app --host 0.0.0.0 --port 8000`.

Atver `http://localhost:8000/admin` un `http://localhost:8000/tv`.

## Izvietošana internetā (Render, Railway vai cits Python hostings)
- Izveido Python Web Service no šī projekta Git repozitorija.
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app:app --host 0.0.0.0 --port $PORT --workers 1 --proxy-headers`
- Vides mainīgie: `ADMIN_PIN` (obligāti droša parole), `PUBLIC_URL` (publiska HTTPS adrese), `DATABASE_URL` (ieteicams PostgreSQL pastāvīgai datu glabāšanai).
- Ja `DATABASE_URL` nav norādīts, izmanto lokālu SQLite failu. Uz hostinga ar nepastāvīgu disku dati var pazust pēc pārstartēšanas.
- Izmanto **vienu servera worker**, jo spēles stāvoklis pašlaik tiek turēts arī servera atmiņā. Vairākas instances bez papildu sinhronizācijas nav atbalstītas.
- Publiskam pasākumam izmanto HTTPS. Pirms pasākuma pārbaudi QR un sesiju darbību vairākos reālos telefonos.

**Svarīgi:** lietotne šobrīd ir pirmā testējamā versija, nevis jau publicēta interneta adrese. QR atvēršana jaunā cilnē ir atkarīga no telefona kameras/pārlūka darbības: QR ved uz atsevišķu lapu, bet operētājsistēma nosaka, vai tā ir jauna cilne. iPhone gadījumā dažādi QR skeneri var atvērt citu pārlūku, kurā iepriekšējā sesija nav saglabāta.

## Render konfigurācijas fails
Projekta saknē ir `render.yaml`, kas apraksta vienu Python tīmekļa servisu. Tas neizveido datubāzi automātiski. Pastāvīgai spēles datu saglabāšanai uzstādi `DATABASE_URL` uz atsevišķu PostgreSQL datubāzi. Ja hostings piedāvā tikai īslaicīgu failu sistēmu, SQLite dati var pazust pēc restartēšanas. **Nav automātiski publicēts — vajadzīgs savienots hostinga konts.**

### Slodzes un drošības robežas
- Dalībnieku skaitam aplikācijas kodā nav noteikts augšējais limits; tas nenozīmē neierobežotu servera jaudu.
- Viena instance = viena spēle vienlaikus. Lai daudz neatkarīgas spēles notiktu vienlaicīgi, jāievieš vairākistabu atbalsts.
- Publicējot internetā, obligāti iestati spēcīgu `ADMIN_PIN`, lieto HTTPS un nedalies ar administrēšanas paroli.
- Datu bāzē tiek saglabāti pseidonīmi un sesiju atslēgas, nevis pilni personīgie profili.

## V3: atsevišķa režija un tīrs TV

- **Režija:** `/admin` — privāts organizatora panelis ar paroli, izsaukumiem, pārslēgšanu, pauzi, ātro paātrināšanu, izlaidīšanu, spēlētāja nomaiņu un rezultātiem.
- **TV:** `/tv` — tikai publiski nepieciešamā informācija. Pievienošanās laikā rāda QR un vārdus, pēc spēles sākuma visu ekrānu aizņem aktuālais notikums, duelis vai izsaukums. Režijas pogas un slepeno kartīšu teksts netiek parādīts.
- **Sinhronizācija:** abi skati izmanto to pašu servera spēles stāvokli un ik pēc aptuveni 2,5 sekundēm atjauno datus. Ekrānus var atvērt dažādās ierīcēs; abām jābūt pieejamai tai pašai HTTPS servera adresei.
- **Duēļu kartīte:** izsauktais spēlētājs no reģistrēto dalībnieku saraksta izvēlas vienu pretinieku un **pats ieraksta aktivitātes nosaukumu** (2–100 rakstzīmes). Nosūtītā izvēle parādās TV.
- **Izvēles kartīte:** izsauktais izvēlas “Duelis” vai “Aktivitāte”. Aktivitātes režīmā pats ieraksta nosaukumu un izvēlas **vienu vai vairākus citus spēlētājus** ar atzīmējamām izvēles rūtiņām. Tikai apstiprinātas izvēles kļūst publiskas.
- **Notikuma pabeigšana:** organizators var noslēgt aktuālo kopīgo aktivitāti, lai TV atgrieztos gaidīšanas skatā.
- **Nav digitālu likmju:** likmes paliek tikai klātienē un netiek glabātas.

**Demonstrācijas statuss:** spēles avots ir sagatavots, pārbaudīts ar automatizētiem API testiem, bet nav publicēts Vezitivus mājaslapā. Pirms izvietošanas internetā jānodrošina droša `ADMIN_PIN`, publisks HTTPS domēns un pastāvīga datubāze, ja dati jāsaglabā pēc servera restartēšanas.

## V4 — TV pilnekrāns un noteikumu kartītes

- `/tv` ir **tikai prezentācijas saturs**: bez joslām, papildus rāmjiem, statusa rindām un ievades vadības elementiem. Tas pielāgojas TV izmēram (`100vw` × `100dvh`), neizveido horizontālu vai vertikālu ritināšanu un automātiski samazina saturu garākiem tekstiem.
- `/admin` paliek atsevišķa, ar paroli aizsargāta vadība. Gan TV, gan režija koplieto vienu servera stāvokli.
- Personīgais QR atver atsevišķu `/mission/{nonce}` adresi. Tā satur noteikumus, ilgumu un konkrēto darbību; pirms aktivizācijas TV neredz slepeno saturu.
- V4 iekļauj **16 gatavas noteikumu kartītes** no trim klasēm: `flash` (ātrie jautrie izaicinājumi, bez ievades), `pair` (viens izvēlēts cits cilvēks), `team` (vairāki izvēlēti cilvēki). Visām noteikumu kartītēm ir skaidri izpildes soļi, un aktivitāte nav jāieraksta.
- Saglabātas `mission` (20 slepenās misijas), `perk` (6 priekšrocības), `choice` (brīvā aktivitātes/duelēšanās izvēle ar teksta ievadi) un organizatora manuāli izsaucams `duel`.
- Standarta automātiskajā kāršu sadalījumā brīvā izvēle ir tikai ~9% izsaukumu. Izvēles kartītē var **pašam ierakstīt aktivitāti**, izvēlēties vienu pretinieku vai vairākus dalībniekus. Pārējās kartītes jau satur norises noteikumus.
- `POST /api/card/activate` pārbauda dalībnieka sesiju, vienreizējo QR, atlases prasības un to, vai nav citas aktīvas publiskas aktivitātes, pēc tam publicē tikai apstiprinātu, publiski nepieciešamo kartītes saturu.
- Kartītes ar komandu izvēli pielāgo minimālo dalībnieku skaitu arī **divu cilvēku** istabā.
- Režija joprojām ļauj klusi izlaist, nomainīt cilvēku un paātrināt izsaukumu. Virtuālās likmes nav.

### V4 pārbaudes

`python -m pytest -q test_mk_web.py` — 5 sekmīgi integrācijas testi, ieskaitot privātumu, skenēšanas piekļuvi, kartīšu noteikumus, atlasi un TV sinhronizāciju. Veikta 1920×1080, 1366×768, 375×812 TV HTML/CSS pārlūka renderēšanas pārbaude bez dokumenta ritināšanas.

**Publikācijas statuss:** šis ir koda izlaidums un lokāls demo. Reālā Vezitivus lapa nav mainīta, un publisks bezmaksas hostings nav automātiski izveidots. Pirms publicēšanas nepieciešama izvēlētā mitināšanas pakalpojuma autorizācija, droša admin parole un noturīga datubāze.


## V5 — VIDEO BIBLIOTĒKA, AI IZSAUKUMA VIDEO

Atsevišķa privāta organizatora lapa: **`/admin/videos`**.

1. Atver **`/admin`**, ievadi `ADMIN_PIN` un izvēlies **VIDEO BIBLIOTĒKA**.
2. Spied **PIEVIENOT VIDEO**, izvēlies MP4 failu, ievadi nosaukumu un izvēlies precīzu kartīti (piemēram, `NEPAREIZAIS EKSPERTS`) vai vispārīgu kategoriju.
3. Video parādās sarakstā ar priekšskatījumu; vienai kartītei drīkst piesaistīt vairākus video. Sistēma iespēju robežās rotē klipus, nevis atkārto vienu un to pašu.
4. Pirms QR izsaukuma TV atskaņo izvēlēto video pilnekrānā **ar skaņu**; kad video beidzas, parādās dalībnieka vārds un QR, un tikai tad sākas 60 sekunžu skaitīšana.
5. Ja pārlūks bloķē skaņu, TV rāda vienreizēju pogu **ATSKAŅOT IZSAUKUMU AR SKAŅU**. Ja fails nav pieejams vai klips iestrēgst, sistēma automātiski pāriet uz QR (drošības aizture līdz 45 s).
6. TV jāatver **no organizatora paneļa pogas**, kas nodod privātu TV kontrolatslēgu, nepiešķirot tai organizatora tiesības. Tas aizsargā pāreju video → QR.

Sagatavotam MP4: **1920×1080, 16:9, H.264 video + AAC audio, 5–15 sekundes**, kopējais fails ne lielāks par **40 MiB**. Katrā video jānosauc kartītes virsraksts, bet nevajag skaidrot noteikumus. Noteikumus rāda tikai privātā QR lapa.

### Kur atrodas faili?

**Variantā A — augšupielāde lapā:** pēc noklusējuma tie ir `static/videos/`. Serveris tiem piešķir neparedzamu drošu faila nosaukumu, bet piesaisti glabā datubāzē. Ja hostings piedāvā pastāvīgu disku, iestati vides mainīgo `VIDEO_DIR` uz tā direktoriju un `DATABASE_URL` uz noturīgu PostgreSQL datubāzi. **Render bezmaksas servisa lokālais disks nav pastāvīgs**; augšupielādētie faili var pazust pēc restartēšanas vai jaunas izvietošanas.

**Variantā B — video pievienoti projektam:** saglabā MP4 failus `static/videos/` un pieraksti tiem piešķirtos kartīšu ID failā `static/video_manifest.json`. Šie faili tiks piegādāti kopā ar GitHub izvietoto projektu un paliks arī pēc servera restartēšanas, ja nav izdzēsti no repozitorija. Skat. `VIDEO_SAGLABASANA.md` ar precīzu JSON piemēru.

**Šī V5 versija NAV publicēta Vezitivus mājaslapā**. Tā ir sagatavota izvietošanai; publisks HTTPS domēns un hostinga konts vēl jākonfigurē. Pirms īsta pasākuma jāpārbauda skaņa TV pārlūkā, QR ar vairākām reālām ierīcēm un servera restartēšanās scenārijs.

## Automātiska video piesaiste pēc faila nosaukuma

Skati [VIDEO_NOSAUKUMI.md](VIDEO_NOSAUKUMI.md). 16 konkrēto uzdevumu un 8 universālie MP4 nosaukumi jau ir piesaistīti `static/video_manifest.json`. Video vienkārši jāievieto `static/videos/` — nekādu papildu sasaistes darbību. Servera hostings ir jāizvieto atsevišķi: GitHub nekļūst par Python serveri.
