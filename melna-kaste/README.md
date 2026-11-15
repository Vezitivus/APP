# MELNĀ KASTE

Tiešsaistes pasākumu spēle trim sinhronizētiem skatiem: režija, TV un dalībnieka telefons. Spēles stāvoklis ir serverī un Postgres datubāzē. Video tiek glabāti Cloudinary. Lietotājam nav jāinstalē nekas — tikai jāatver adrese pārlūkā.

## Kāpēc šis steks

- **Next.js uz Vercel Hobby** dod HTTPS adresi bez sava servera. Funkcijas ir īsas, tāpēc spēles taimeri nav process atmiņā: termiņus raksta serveris, un jebkurš ekrāns, kas vaicā stāvokli, tos pielieto.
- **Supabase Free** dod Postgres. Viena rinda `games.snapshot` ir autoritatīvais stāvoklis, pārējās tabulas ir tās projekcija. `tv_feed` ir vienīgā tabula, ko drīkst lasīt publiskā atslēga, un tikai bez slepenā satura.
- **Cloudinary Free** glabā un atdod video. API noslēpums paliek serverī. Atskaņošanai tiek lietots oriģinālais `secure_url`, bez jaunām transformācijām, lai netērētu kredītus.

Bezmaksas limitu skaitļi ir `docs/BEZMAKSAS_LIMITI.md`.

## Adreses

| Adrese | Skats |
| --- | --- |
| `/` | Sākums |
| `/admin` | Organizatora režija |
| `/admin/videos` | Video bibliotēka |
| `/tv` | Publiskais ekrāns |
| `/join` | Pievienošanās |
| `/player` | Dalībnieka telefons |
| `/mission/{id}` | Privātā kartīte |

## Lokāla pārbaude

```bash
cd melna-kaste
npm install
npm test
```

Lai palaistu pašu lietotni, nokopē `.env.example` uz `.env.local`, aizpildi vērtības un palaiž `npm run dev`. Bez `DATABASE_URL` lapas atveras, bet spēle atbild, ka datubāze nav pievienota.

Izvietošana pasūtītāja kontos: `docs/IZVIETOSANA.md`. Lietošana: `docs/LIETOSANA.md`. Video mapes un failu vārdi: `docs/CLOUDINARY.md` un `docs/VIDEO_NOSAUKUMI.md`.
