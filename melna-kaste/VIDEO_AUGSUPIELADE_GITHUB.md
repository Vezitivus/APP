# Kā pievienot AI izsaukuma video MELNAJAI KASTEI

## 1. Sagatavo klipu
- MP4, H.264 + AAC, 16:9, vēlams 1920×1080.
- Ieteicamais ilgums: 5–15 sekundes.
- Katrs video ir tikai izsaukuma signāls: simpātiska sieviete paziņo **precīzu kartītes nosaukumu**, bet neizstāsta uzdevuma noteikumus.
- Pirmkoda konfigurācijā noteiktais viena faila augšupielādes limits: 40 MiB. GitHub pārlūka augšupielādes limits var būt mazāks, tāpēc iesakām īsu un saspiestu klipu.

## 2. Augšupielādē GitHub
1. Atver [spēles video mapi](https://github.com/Vezitivus/APP/tree/main/melna-kaste/static/videos).
2. Izvēlies **Add file → Upload files**.
3. Ievelc savu `.mp4` failu un izvēlies **Commit changes**.
4. Uzmanību: video kļūs publiski redzams GitHub repozitorijā.

## 3. Piesaisti video attiecīgajai kartītei
Atver [video_manifest.json](https://github.com/Vezitivus/APP/blob/main/melna-kaste/static/video_manifest.json) un spied zīmuļa ikonu **Edit this file**.

Piemērs, kā izskatītos manifests ar vienu video:

```json
{
  "videos": [
    {
      "id": "bundle_nepareizais_eksperts_01",
      "file": "nepareizais_eksperts.mp4",
      "title": "Nepareizais eksperts — AI izsaukums",
      "cardId": "absurd_duet"
    }
  ]
}
```

- **file:** precīzi sakrīt ar augšupielādētā MP4 faila nosaukumu.
- **id:** unikāla vērtība, sākas ar `bundle_`.
- **cardId:** konkrētās kartītes ID no `app.py`; vispārīgām kartītēm izmanto `mission`, `perk`, `choice`, `duel`, `flash`, `pair`, `team` vai `any`.
- Ja gribi vairākus video vienai kartītei, ieliec vairākus ierakstus masīvā `videos` ar dažādiem `id` un `file`.
- Saglabā izmaiņas ar **Commit changes**.

## 4. Kā tas tiks atskaņots
Kad ir palaists **Python serveris** un pēc jaunā GitHub commit veikta servera izvietošana, sistēma izmantos pievienotos MP4 failus.

**Gaidīšanas ekrāns → AI video pilnekrānā ar skaņu → video beigas → dalībnieka vārds un QR → 60 sekunžu laiks.**

Līdz serveris nav izvietots, failu pievienošana GitHub neaktivizē spēli publiskā interneta adresē.

## Svarīgi
Ja izmanto Render bezmaksas web service, pārlūkā organizatora sadaļā augšupielādētie faili var pazust pēc servera pārstartēšanas. **Pastāvīgai bezmaksas glabāšanai dod priekšroku augšupielādei GitHub un manifesta atjaunināšanai.** Šis risinājums der nelielai īsu video kolekcijai; lielākai bibliotēkai vajadzēs objektu glabātuvi.
