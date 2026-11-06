# Kur ievietot savus MELNĀS KASTES AI video

## Ērtākais: organizatora video bibliotēka

Atver savas izvietotās spēles adresi un pieliec `/admin/videos`. Piemēram, `https://<tavs-domens>/admin/videos`. Ievadi administratora paroli. Spied **PIEVIENOT VIDEO** → **VIDEO NOSAUKUMS** → **PIESAISTĪT KARTĪTEI** → **MP4 FAILS** → **AUGŠUPIELĀDĒT UN SAGLABĀT**.

Ja videoklips saucas `nepareizais_eksperts.mp4`, izvēlies kartīti **NEPAREIZAIS EKSPERTS** (`absurd_duet`). Ja video izsauc vispārīgu slepenu misiju, izvēlies **Slepenās misijas** (`mission`). Ja klipā nav konkrēta uzdevuma nosaukuma, vari izmantot **Visiem izsaukumiem** (`any`) kā rezervi.

Video noformējums: MP4 (H.264 + AAC), 16:9, 1920×1080, vēlams 5–15 s, ne vairāk kā 40 MiB. Video ar balsi un mūziku gatavo kā vienu failu.

## Pastāvīgi bez maksas (ja pats uzturi GitHub kodu)

Lai video nepazustu bezmaksas hostinga restartā, ieliec MP4 **pašā projektā**:

```text
MELNA_KASTE_WEB_V5/
  static/
    videos/
      nepareizais_eksperts.mp4   ← video fails
      slepena_misija_01.mp4     ← cits video fails
    video_manifest.json          ← piesaiste uzdevumiem
```

Pēc failu ielikšanas atver `static/video_manifest.json` un papildini:

```json
{
  "videos": [
    {
      "id": "bundle_nepareizais_eksperts_01",
      "file": "nepareizais_eksperts.mp4",
      "title": "Nepareizais eksperts — AI izsaukums",
      "cardId": "absurd_duet"
    },
    {
      "id": "bundle_slepena_misija_01",
      "file": "slepena_misija_01.mp4",
      "title": "Slepenās misijas izsaukums",
      "cardId": "mission"
    }
  ]
}
```

`id` jābūt unikālam un jāsākas ar `bundle_`. `file` jābūt tieši tādam pašam faila nosaukumam kā mapē `static/videos/`. `cardId` drīkst būt `any`, `mission`, `perk`, `choice`, `duel`, `flash`, `pair`, `team` vai konkrēts ID no `app.py` / `CARD_DECK` (piemēram, `absurd_duet`).

Ievietojot abus failus **GitHub projektā**, nodrošini, ka serveris veic jaunu izvietošanu no atjauninātās versijas. **Nav nepieciešams manuāli iestatīt datubāzes ierakstu** — manifestu lietotne nolasa pati. Konkrētas kartītes klips ir prioritārāks nekā kategorijas vai vispārīgais klips.

**Uzmanību par bezmaksas serveriem:** ja MP4 augšupielādē tieši serverī un tam nav pastāvīga diska, faili pēc restartēšanās var pazust. GitHub glabāšanai savukārt ir failu/repozitoriju izmēra un lietošanas ierobežojumi; saglabā īsus saspiestus klipus. Ja bibliotēka kļūst liela, piemērotāks ir objektu glabāšanas serviss ar pastāvīgu apjomu (jāuzstāda atsevišķi).

## Kā video darbojas spēles gaitā?

Gaidīšanas ekrāns → TV pilnekrāna izsaukuma AI video ar skaņu → video beidzas → dalībnieka vārds un QR → pilnas 60 sekundes skenēšanai → slepena kartīte telefonā. Ja klips nav piesaistīts, sistēma uzreiz rāda QR.

**Video ir paziņojums, nevis uzdevuma instrukcija.** Izsaukuma video nosauc kartītes nosaukumu; pilni noteikumi pieejami tikai attiecīgajam spēlētājam pēc QR skenēšanas.