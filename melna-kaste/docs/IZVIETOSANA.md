# Izvietošana

Viss paliek pasūtītāja kontos. Šis repozitorijs nesatur paroles. Neieslēdz maksas plānus: Cloudflare Workers paliek **Free**, Supabase paliek **Free**, Cloudinary paliek **Free**. Neieslēdz Supabase Point in Time Recovery, papildu datoru, Workers Paid vai Cloudinary maksas papildinājumus. Vercel konfigurācija repozitorijā paliek, bet Vercel un Netlify reģistrācija tika atteikta, tāpēc izvietošana ir Cloudflare.

## 1. Supabase

1. Izveido projektu organizācijā ar Free plānu. Reģions: tuvākais Eiropai, piemēram Frankfurt.
2. SQL Editor → New query → ielīmē `supabase/migrations/0001_init.sql` → Run. Vēlākos atjauninājumus (piemēram, `0002_player_pin.sql`) palaid tāpat, pēc kārtas.
3. Project Settings → Database → Connection string → **Transaction pooler** (ports 6543). Tas ir `DATABASE_URL`.
4. Project Settings → API. Nokopē Project URL un `anon` `public` atslēgu. **Nekopē `service_role` atslēgu lietotnē.** Tā nav vajadzīga, un tā apiet drošības politikas.

Free projekts var tikt apturēts pēc nedēļas bez aktivitātes. Pirms pasākuma atver Supabase paneli un, ja projekts ir paused, nospied Resume. `/api/health` var atvērt ar roku. Uz Cloudflare automātiskas dienas pārbaudes nav, un tā negarantē, ka Supabase projektu neapturēs.

## 2. Cloudinary

1. Izveido bezmaksas kontu. Ne pievieno maksas add-on.
2. Settings → API Keys. Nokopē Cloud name, API Key un API Secret.
3. Media Library izveido mapes un ieliec video tā, kā aprakstīts `CLOUDINARY.md`.
4. Pēc augšupielādes režijā atver Video un spied **Atjaunot no Cloudinary**. Jaunu publicēšanu nevajag.

## 3. Cloudflare Workers

Izvietošana ir no mapes `melna-kaste`. Adapteris ir `@opennextjs/cloudflare`. Workers Free plānā saspiestais Worker nedrīkst pārsniegt **3 MiB**. Pēc `npm run cf:build` komanda `npx wrangler deploy --dry-run` izdrukā rindu `gzip:`. Skaitās tikai saspiestais izmērs, nevis statiskie faili.

1. Izveido Cloudflare kontu un neieslēdz Workers Paid.
2. Pieslēdz Wrangler šim kontam:

```bash
cd melna-kaste
npx wrangler login
```

3. Servera vērtības ir Worker noslēpumi. Tās lasa katrs pieprasījums, nevis build. `wrangler secret put` prasa vērtību terminālī. Neliec to komandas argumentā un neliec `wrangler.jsonc`.

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler secret put PUBLIC_URL
npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
```

| Mainīgais | Kur |
| --- | --- |
| `DATABASE_URL` | Supabase **transaction pooler**, ports **6543**. Tiešā 5432 adrese no Worker nedrīkst |
| `ADMIN_PASSWORD` | Gara parole, vismaz 8 zīmes |
| `SESSION_SECRET` | Vismaz 32 nejaušas zīmes |
| `PUBLIC_URL` | `https://melna-kaste.<konts>.workers.dev`, bez slīpsvītras beigās. Var ielikt pēc pirmā deploy, pārbūve nav vajadzīga |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary |
| `CLOUDINARY_API_KEY` | Cloudinary |
| `CLOUDINARY_API_SECRET` | Cloudinary, nekad `NEXT_PUBLIC_` |

`DATABASE_SSL` produkcijā neliek. Tas ir tikai lokālam Postgres bez SSL.

4. Build laikā vajag tikai divus publiskos mainīgos. Next.js tos ieraksta pārlūka paketē. Tos neliek ar `wrangler secret put`. Ievieto čaulā tieši pirms build (vai `.env.production`, kuru nekomitē):

```bash
export NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-atslēga
```

Ja `cf:build` laikā mapē ir `.env`, `.env.local` vai `.env.production` ar `DATABASE_URL` vai parolēm, adapteris ieraksta tās Workerī kā rezerves. Produkcijas build vidē atstāj tikai `NEXT_PUBLIC_*`. Lokālais `npm run dev` joprojām lieto `.env.local`.

5. Uzbūvē un izvieto:

```bash
npm run cf:build
npm run cf:deploy
```

`cf:build` palaiž Next.js build un OpenNext. `cf:deploy` augšupielādē jau uzbūvēto `.open-next` un pats no jauna nebūvē. Abas komandas laiž no `melna-kaste`. Atkārtots deploy patur jau ieliktos noslēpumus.

Wrangler priekšskatījumam vari nokopēt `.dev.vars.example` uz `.dev.vars`. `npm run dev` šo failu nelasa.

Vercel cron, kas reizi dienā vaicā `/api/health`, uz Cloudflare nepārceļas. Pirms pasākuma atver Supabase paneli un, ja projekts ir paused, nospied Resume.

## 4. Vercel

Šo lieto tikai tad, ja Vercel konts tomēr ir pieejams. `vercel.json` un `npm run build` paliek.

1. Importē šo GitHub repozitoriju.
2. Root Directory: `melna-kaste`. Framework: Next.js.
3. Environment Variables — tās pašas, kas `.env.example`:

| Mainīgais | Kur |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler |
| `ADMIN_PASSWORD` | Garš parole, vismaz 8 zīmes. Tikai serverī. |
| `SESSION_SECRET` | Vismaz 32 nejaušas zīmes. Tikai serverī. |
| `PUBLIC_URL` | Gatavā `https://….vercel.app` adrese, bez slīpsvītras beigās |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary |
| `CLOUDINARY_API_KEY` | Cloudinary |
| `CLOUDINARY_API_SECRET` | Cloudinary, nekad `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tikai anon atslēga |

4. Deploy. Pēc pirmā deploy `PUBLIC_URL` var salikt un uztaisīt Redeploy, lai saites būtu pareizas.
5. Atstāj plānu Hobby. Cron `/api/health` reizi dienā ir Hobby limitos.

## 5. Pārbaude pēc izvietošanas

1. Atver `/admin`, ieej ar `ADMIN_PASSWORD`, izveido spēli.
2. Atver doto TV saiti citā logā un nospied **Aktivizēt TV**.
3. Ar telefonu noskenē uzgaidāmās telpas QR. Ievadi vārdu un izvēlies 4 ciparu PIN. Atkārto ar otru telefonu.
4. Režijā sāc spēli, sagatavo kartīti un pārbaudi QR citā pārlūkā ar vārdu un PIN.
5. Pārbaudi, ka svešs vārds un PIN kartīti neatver, un ka režija PIN tekstu neredz.

Publiskās adreses pēc deploy:

- spēle: `PUBLIC_URL/`
- režija: `PUBLIC_URL/admin`
- TV: `PUBLIC_URL/tv` (darba saite ar `?pair=` parādās režijā)
- pievienošanās: `PUBLIC_URL/join`

## Cloudflare Hyperdrive (datubāze no Worker)

Worker nevar tieši pārbaudīt Supabase TLS sertifikātu (postgres.js tad atkārto savienojumus līdz kļūdai "Too many subrequests"). Tāpēc Worker pieslēdzas caur Cloudflare Hyperdrive (bezmaksas plānā pieejams), kas pats veido TLS savienojumu ar Supabase.

- Hyperdrive konfigurācija: `melna-kaste-db` (ID `f72cb34784234d118bc3cae9ae3f3035`, piesaiste `HYPERDRIVE` failā `wrangler.jsonc`).
- Izcelsme: Supabase session pooler (tas pats resursdators, ports 5432).
- `DATABASE_URL` secret paliek kā rezerve (Node / Vercel), bet uz Worker tiek lietots `HYPERDRIVE`.
- Izveidots ar: `npx wrangler hyperdrive create melna-kaste-db --connection-string="postgresql://...:5432/postgres"`.
- `postgres` ir `serverExternalPackages` sarakstā, lai Workers būvējums izmantotu postgres.js `workerd` versiju (cloudflare:sockets).
- Cloudinary secrets vairs nav obligāti izvietošanai; bez tiem darbojas 20 s testa cikls.
