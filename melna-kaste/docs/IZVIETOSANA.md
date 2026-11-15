# Izvietošana

Viss paliek pasūtītāja kontos. Šis repozitorijs nesatur paroles. Neieslēdz maksas plānus: Vercel paliek **Hobby**, Supabase paliek **Free**, Cloudinary paliek **Free**. Neieslēdz Supabase Point in Time Recovery, papildu datoru, Vercel spend vai Cloudinary maksas papildinājumus.

## 1. Supabase

1. Izveido projektu organizācijā ar Free plānu. Reģions: tuvākais Eiropai, piemēram Frankfurt.
2. SQL Editor → New query → ielīmē `supabase/migrations/0001_init.sql` → Run.
3. Project Settings → Database → Connection string → **Transaction pooler** (ports 6543). Tas ir `DATABASE_URL`.
4. Project Settings → API. Nokopē Project URL un `anon` `public` atslēgu. **Nekopē `service_role` atslēgu lietotnē.** Tā nav vajadzīga, un tā apiet drošības politikas.

Free projekts var tikt apturēts pēc nedēļas bez aktivitātes. Pirms pasākuma atver Supabase paneli un, ja projekts ir paused, nospied Resume. Lietotnes `/api/health` reizi dienā vaicā datubāzei, bet tas negarantē, ka Supabase projektu neapturēs.

## 2. Cloudinary

1. Izveido bezmaksas kontu. Ne pievieno maksas add-on.
2. Settings → API Keys. Nokopē Cloud name, API Key un API Secret.
3. Media Library izveido mapes un ieliec video tā, kā aprakstīts `CLOUDINARY.md`.
4. Pēc augšupielādes režijā atver Video un spied **Atjaunot no Cloudinary**. Jaunu publicēšanu nevajag.

## 3. Vercel

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

## 4. Pārbaude pēc izvietošanas

1. Atver `/admin`, ieej ar `ADMIN_PASSWORD`, izveido spēli.
2. Atver doto TV saiti citā logā un nospied **Aktivizēt TV**.
3. Ar telefonu noskenē uzgaidāmās telpas QR. Ievadi vārdu. Atkārto ar otru telefonu.
4. Režijā sāc spēli, pievieno sešus testa dalībniekus, sagatavo kartīti un pārbaudi QR citā pārlūkā ar atjaunošanas kodu.
5. Pārbaudi, ka svešs vārds un kods kartīti neatver.

Publiskās adreses pēc deploy:

- spēle: `PUBLIC_URL/`
- režija: `PUBLIC_URL/admin`
- TV: `PUBLIC_URL/tv` (darba saite ar `?pair=` parādās režijā)
- pievienošanās: `PUBLIC_URL/join`
