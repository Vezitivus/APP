# Bezmaksas limitu piezīmes

Skaitļi pārbaudīti 2026. gada 15. novembrī pret pakalpojumu publiskajām lapām. Plāni mainās. Pirms pasākuma atver katra pakalpojuma usage paneli. Šī lietotne neieslēdz nevienu maksas funkciju.

## Vercel Hobby

Avots: [Hobby](https://vercel.com/docs/plans/hobby), [Limits](https://vercel.com/docs/limits).

- 0 USD, kamēr netiek pārsniegts iekļautais apjoms. Pārsniegums aptur lietojumu līdz nākamajam periodam, nevis automātiski izraksta rēķinu.
- Aptuveni 100 GB Fast Data Transfer un 1 000 000 funkciju izsaukumu mēnesī, 4 CPU stundas un 360 GB-stundas atmiņas.
- Funkcijas maksimums 300 sekundes. Šai spēlei pieprasījumi ir īsi.
- Līdz 100 deploy dienā.
- Hobby ir personīgiem projektiem. Ja par pasākumu ņem naudu, izlasi Vercel plāna noteikumus pirms publiskošanas.

Produkcija ir uz Cloudflare Workers, nevis Vercel. Zemāk ir Workers Free 100 000 pieprasījumu dienā slodzes tāme.

## Supabase Free

Avots: [Pricing](https://supabase.com/pricing), [pausēšana](https://supabase.com/docs/guides/platform/free-project-pausing), [Realtime](https://supabase.com/docs/guides/realtime/limits).

- 0 USD. Divi aktīvi projekti. 500 MB datubāze projektam, 5 GB egress, 5 GB kešots egress.
- Realtime: 200 vienlaicīgi savienojumi, 2 miljoni ziņu mēnesī, 100 ziņas sekundē. Šī lietotne Realtime lieto tikai mazajai `tv_feed` rindai. Pilns stāvoklis nāk caur īsu API aptauju.
- Projekts var tikt apturēts pēc nedēļas vājas aktivitātes. Atjaunošana panelī ir iespējama līdz vienam gadam. Automātisku maksas dublējumu nav.
- Egress: 20 telefonu × ~3 KB × reizi 2,5 s × 6 stundas ir krietni zem 1 GB. 5 GB pietiek vairākiem šādiem vakariem, nevis nepārtrauktai aptaujai visu mēnesi.

`service_role` atslēga nav vajadzīga un nav jāliek Vercel. Savienojums iet ar Postgres virkni, kas ir tikai servera mainīgais.

## Cloudinary Free

Avots: [Pricing](https://cloudinary.com/documentation/pricing), [onboarding FAQ](https://cloudinary.com/documentation/developer_onboarding_faq).

- 0 USD, bez termiņa, kamēr iekļaujies 25 kredītos slīdošā 30 dienu logā. Glabāšana skaitās pēc pašreizējā apjoma, nevis loga.
- 1 kredīts = 1000 transformācijas **vai** 1 GB glabāšanas **vai** 1 GB datu pārraides **vai** aptuveni 500 sekundes SD video **vai** 250 sekundes HD video. Kredīti ir kopīgi.
- Video fails līdz 100 MB. Admin API aptuveni 500 pieprasījumi stundā.
- Pārsniegums netiek uzreiz cieti apcirpts: Cloudinary brīdina, un ilgstošs pārsniegums var atslēgt kontu. Tas nav iemesls ieslēgt maksas plānu bez saskaņošanas.

Praktiski vienam TV: 25 kredīti tikai HD pārraidei ir aptuveni 6250 sekundes, tas ir ap 1,7 stundām. SD (720p) ir aptuveni divreiz vairāk, ap 3,5 stundām, ja pārējie kredīti nav aizņemti ar glabāšanu un transformācijām. Garš vakars ar 1080p standby cilpā **neiekļaujas** 25 kredītos. Tāpēc:

- augšupielādē 720p H.264 oriģinālus;
- turi klipus īsus;
- neliec URL transformācijas (`q_auto`, `f_auto`), lietotne tās nepieprasa;
- skaties Usage paneli pirms vakara un tā laikā;
- viens TV, nevis vairāki ekrāni ar tiem pašiem video.

Ja kredītu nepietiek visam vakaram, īstais bezmaksas risinājums ir īsāki un mazākas izšķirtspējas faili, nevis kluss pāreja uz maksas plānu.


## Cloudflare Workers Free

Avots: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Static Assets](https://developers.cloudflare.com/workers/static-assets/).

- 0 USD. **100 000 Worker izsaukumu dienā**. Pārsniegums aptur API līdz UTC pusnaktij (ziemā 02:00 pēc Rīgas laika), nevis automātiski pāriet uz maksas plānu.
- Statiskie faili (`/_next/static`, fonti, `public`) iet caur Workers Static Assets ar `run_worker_first: false` un **neskaitās** kā Worker izsaukumi. Video nāk tieši no Cloudinary, ne caur Worker.
- Hyperdrive ir bezmaksas plānā; katra stāvokļa aptauja tomēr ir arī Worker izsaukums un datubāzes vaicājums, tāpēc aptaujas ir retas.

### Vecā slodze (pirms samazināšanas)

Aptaujas gāja arī slēptā cilnē, bez pauzes:

| Klients | Intervāls | Pieprasījumi stundā |
|---|---:|---:|
| 1 TV `/api/tv/state` | 1,5 s | 2 400 |
| 1 TV `clip_ended` katram ~15 s klipam | katrs klips | ~240 |
| 1 režija `/api/admin/state` | 2 s | 1 800 |
| 20 telefoni `/api/player/state` (un katru reizi `markSeen` + `tick`) | 2,5 s | 28 800 |
| **Kopā** | | **~33 200 / stundā** |

Sešu stundu vakars: **aptuveni 200 000** izsaukumu, plus lapu HTML un jebkāda izstrāde. Tas pārsniedz 100 000 dienas limitu.

### Jaunā slodze

Stāvokļa izmaiņas (Izsaukt, pievienošanās, QR, Turpināt) nāk caur Supabase Realtime pie `tv_feed` — tas nav Worker izsaukums. Worker aptauja ir tikai rezerves, un **tikai redzamā cilnē**. TV pašu standby riņķi ritina lokāli un serverim ziņo tikai riņķa beigās, ievada/izsaukuma/beigu klipa beigās vai kļūmē.

| Klients | Intervāls (redzama cilne) | Pieprasījumi stundā (sliktākais gadījums, cilne visu laiku redzama) |
|---|---:|---:|
| 1 TV rezerve | 15 s standby, 5 s ievada/izsaukuma laikā (~20% vakara) | ~340 |
| 1 TV `cycle_ended` / ievada ziņojumi | ~1 reize / 5 min + reti notikumi | ~20 |
| 1 režija rezerve | 10 s | 360 |
| 20 telefoni rezerve | 25 s | 2 880 |
| Lapu atvēršana (HTML/API, bez `_next/static`) | pāris reizes vakarā | < 50 / vakars |
| **Kopā** | | **aptuveni 3 600 / stundā** |

Sešu stundu vakars (1 TV, 1 režija, 20 telefoni, cilnes paliek atvērtas): **aptuveni 22 000** sliktākajā gadījumā. Ja daļa telefonu ir aizvērti vai fonā (aptauja apstājas), tipisks vakars paliek **ap 15 000–20 000**, krietni zem 25 000 mērķa un 100 000 dienas limita.

Durable Objects / WebSocket netiek lietoti: paliekam pie jau ieslēgtā Supabase Realtime (Free) un retas aptaujas, bez jaunas maksas resursu pieslēgšanas.
