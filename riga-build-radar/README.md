# Būvju Radars

Webapp/PWA Rīgas būvniecības objektu apsekošanai.

## Funkcijas
- GPS brauciena ierakstīšana un dzīva līnija kartē.
- Visi pabeigtie braucieni glabājas Supabase un ir redzami no telefona un datora.
- Objekta karodziņš no pašreizējās GPS vietas vai ar labo klikšķi/long-press uz kartes.
- Adrese, objekta tips, stadija, statuss, fasāde, piezīmes un foto.
- Foto glabājas privātā Supabase Storage bucket `object-photos`.
- Magic-link pieslēgšanās ar e-pastu.
- Row Level Security: lietotājs redz tikai savus datus.
- Aktīvais brauciens paralēli tiek glabāts localStorage, lai nejauša lapas pārlāde nezaudētu maršrutu.
- GeoJSON eksports.

## Supabase pieslēgšana
1. Izveido Supabase projektu.
2. SQL Editor palaid `supabase/schema.sql`.
3. Authentication ieslēdz Email/Magic Link.
4. Paņem Project URL un Publishable key (vai legacy anon key).
5. Pēc GitHub Pages URL iegūšanas pievieno to Supabase Auth `Site URL` un `Redirect URLs`.
6. Atver webapp un pirmajā reizē ievadi Project URL + Publishable key.

**Nekad** neliec browserī Supabase secret/service-role key. Browserī izmanto tikai publishable/anon key; datu aizsardzību nodrošina RLS.

## GitHub Pages
Repo Settings → Pages → Build and deployment → Source → `GitHub Actions`.
Workflow `.github/workflows/riga-build-radar-pages.yml` publicē mapi `riga-build-radar/`.

## Dati
`trips.path` satur pilnu GPS punktu masīvu, tāpēc visas vēsturiskās brauciena līnijas paliek pieejamas vienā kartē arī datorā.

`objects` satur karodziņus un būvniecības informāciju. `object_photos` sasaista objektus ar Supabase Storage failiem.

## Webapp ierobežojums
Mobilais pārlūks var apturēt GPS, ja ekrāns tiek aizslēgts vai pārlūks pilnībā aiziet fonā. App mēģina izmantot Screen Wake Lock, bet web platforma nevar garantēt native background GPS.
