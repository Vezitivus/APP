# Bezmaksas limitu piezīmes

Skaitļi pārbaudīti 2026. gada 15. novembrī pret pakalpojumu publiskajām lapām. Plāni mainās. Pirms pasākuma atver katra pakalpojuma usage paneli. Šī lietotne neieslēdz nevienu maksas funkciju.

## Vercel Hobby

Avots: [Hobby](https://vercel.com/docs/plans/hobby), [Limits](https://vercel.com/docs/limits).

- 0 USD, kamēr netiek pārsniegts iekļautais apjoms. Pārsniegums aptur lietojumu līdz nākamajam periodam, nevis automātiski izraksta rēķinu.
- Aptuveni 100 GB Fast Data Transfer un 1 000 000 funkciju izsaukumu mēnesī, 4 CPU stundas un 360 GB-stundas atmiņas.
- Funkcijas maksimums 300 sekundes. Šai spēlei pieprasījumi ir īsi.
- Līdz 100 deploy dienā.
- Hobby ir personīgiem projektiem. Ja par pasākumu ņem naudu, izlasi Vercel plāna noteikumus pirms publiskošanas.

Viena vakara aptuvena slodze: TV, režija un 20 telefonu ik pēc 1,5–2,5 sekundēm sešas stundas ir daži simti tūkstošu izsaukumu. Tas ievietojas 1 000 000, bet aktīva izstrāde visu mēnesi plus vairāki vakari var tuvoties robežai. Tāpēc TV aptauja nav biežāka par 1,5 sekundēm, un pulkstenis starp aptaujām iet klienta pusē no servera termiņa.

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
