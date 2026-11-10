# MELNĀ KASTE — palaist internetā

Šī ir **tiešsaistes**, nevis lokālā Windows versija. ADMIN, TV un dalībnieki strādā ar vienu publisku HTTPS serveri.

## Viena klikšķa izvietošana

[**Izvietot MELNO KASTI Render**](https://render.com/deploy?repo=https://github.com/Vezitivus/APP)

1. Atver augstāk norādīto saiti, piesakies Render un apstiprini `Vezitivus/APP` repozitorija izvietošanu.
2. Render lietos repozitorija saknes `render.yaml`: bezmaksas Python web service un `rootDir: melna-kaste`.
3. Kad Render prasa `ADMIN_PIN`, ievadi paša izvēlētu spēcīgu paroli, kuru tu zināsi. Neievieto paroli GitHub kodā.
4. Apstiprini servisa izveidi. Kad tā statuss ir **Live**, no Render nokopē savu `https://....onrender.com` adresi.
5. Atver **ADMIN**: `https://<tava-adrese>.onrender.com/admin`.
6. Atver **TV**: `https://<tava-adrese>.onrender.com/tv`.
7. Dalībnieki pievienojas caur TV parādīto QR vai `https://<tava-adrese>.onrender.com/join`.

Visi trīs atrodas vienā un tajā pašā serverī un sinhronizējas ar kopīgu spēles stāvokli. Datorā Python nav jāinstalē.

## Video faili

Klipus saliec repozitorija `melna-kaste/static/videos/` mapē. Standby: `standby_01.mp4`, `standby_02.mp4`, … pēc kārtas. Izsaukumu video failu nosaukumi: [VIDEO_NOSAUKUMI.md](VIDEO_NOSAUKUMI.md).

**Svarīgi:** GitHub satura publicēšana izraisīs nākamo Render izvietojumu. Iesācēja bezmaksas Render servisam ir nepastāvīgs disks: ar UI augšupielādētie faili un vietējā SQLite istabas stāvoklis pēc restarta var pazust. Pastāvīgi video jāglabā GitHub, un pasākuma laikā jāizvairās no redeploy; pastāvīgai spēles datu glabāšanai nepieciešama ārēja datubāze.

## Ierobežojumi

- Viens serveris = viena aktīva spēles istaba.
- Bezmaksas serveris var aizmigt pēc 15 minūšu neaktivitātes un uzsilt lēni. Tas ir piemērots izmēģināšanai, nevis kritiski svarīgam pasākumam.
- Kods ir publicēts GitHub, bet reāla Render servisa izveidi konta īpašnieks apstiprina pats. Līdz apstiprināšanai nav strādājošas publiskas spēles adreses.
