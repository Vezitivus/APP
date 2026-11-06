# MELNĀ KASTE — AI video nosaukumi un piesaiste

Visus klipus saglabā ar **precīzu** tabulā norādīto `.mp4` faila nosaukumu un augšupielādē vienā mapē:

`Vezitivus/APP/melna-kaste/static/videos/`

Manifestā `static/video_manifest.json` visas piesaistes **jau ir sagatavotas**. To nevajag labot, un nav jāpārdēvē kartītes vai jālabo Python/JavaScript kods. Trūkstošie video automātiski tiek izlaisti.

## 16 konkrētie uzdevumi

| Uzdevuma nosaukums, ko video saka AI sieviete | Saglabātais MP4 faila nosaukums |
|---|---|
| PĀRDOD NEPĀRDODAMO | `izsaukums_sales_pitch.mp4` |
| NEIESPĒJAMAIS ADVOKĀTS | `izsaukums_bad_lawyer.mp4` |
| SPORTA KOMENTĒTĀJS | `izsaukums_sports_cast.mp4` |
| DIVAS PATIESĪBAS UN VIENI MELI | `izsaukums_truth_lie.mp4` |
| MĒMĀ REKLĀMA | `izsaukums_mimic.mp4` |
| NEPAREIZAIS EKSPERTS | `izsaukums_absurd_duet.mp4` |
| DZĪVĀ SKULPTŪRA | `izsaukums_freeze_frame.mp4` |
| SLIKTĀKĀ BIZNESA IDEJA | `izsaukums_dubious_team.mp4` |
| ABSURDO LIKUMU KOMITEJA | `izsaukums_committee.mp4` |
| STĀSTS PA VIENAM VĀRDAM | `izsaukums_improv_story.mp4` |
| TRĪS CILVĒKU REKLĀMA | `izsaukums_bad_ad.mp4` |
| TRĪS PIECU SEKUNŽU LAIKĀ | `izsaukums_three_in_five.mp4` |
| STĀSTS ATPAKAĻGAITĀ | `izsaukums_reverse_story.mp4` |
| TIKAI NEPAREIZAS ATBILDES | `izsaukums_wrong_answers.mp4` |
| BEZ VIENA VĀRDA | `izsaukums_gesture.mp4` |
| NENOPIETNĀ RUNA | `izsaukums_look.mp4` |

## 8 universālie izsaukumi

| Nosaukums | MP4 faila nosaukums |
|---|---|
| SLEPENĀ MISIJA | `izsaukums_mission.mp4` |
| PRIEKŠROCĪBA | `izsaukums_perk.mp4` |
| BRĪVĀ IZVĒLE | `izsaukums_choice.mp4` |
| BRĪVAIS DUELIS | `izsaukums_duel.mp4` |
| ĀTRAIS IZAICINĀJUMS | `izsaukums_flash.mp4` |
| DIVU CILVĒKU IZAICINĀJUMS | `izsaukums_pair.mp4` |
| KOMANDAS IZAICINĀJUMS | `izsaukums_team.mp4` |
| MELNĀ KASTE | `izsaukums_any.mp4` |

## Atlases loģika

1. Sākumā tiek meklēts konkrētās kartītes video, piemēram, `izsaukums_absurd_duet.mp4`.
2. Ja tā nav, tiek meklēts kategorijas video, piemēram, `izsaukums_pair.mp4`.
3. Ja nav arī tā, tiek meklēts `izsaukums_any.mp4`.
4. Ja video nav, izsaukums uzreiz rāda dalībnieka vārdu un QR.

**Svarīgi:** Video nedrīkst izstāstīt slepenā uzdevuma noteikumus vai nosaukt konkrēta dalībnieka vārdu. Video ir tikai īss kinematogrāfisks signāls, kurā tiek skaidri izrunāts uzdevuma virsraksts. Slepeno saturu atver QR kartītē.

Ieteicamais formāts: MP4 (H.264 + AAC), 16:9, 1920 × 1080, 5–15 sekundes.

Kad video beidzas, TV rāda izsaukto dalībnieku un QR; 60 sekunžu atpakaļskaitīšana sākas tikai **pēc video atskaņošanas**.

## Kā augšupielādēt

1. Atver [video mapi GitHub](https://github.com/Vezitivus/APP/tree/main/melna-kaste/static/videos).
2. **Add file → Upload files**.
3. Ievieto nosauktos `.mp4` failus.
4. Spied **Commit changes**.
5. Hostings pēc jaunās versijas izvietošanas automātiski atradīs klipus.

Repozitorijs ir publisks, tātad arī šie video ir publiski. GitHub glabā failus, bet **nepalaiž Python spēles serveri**. Reālai spēlei ar vairākiem telefoniem nepieciešams pieslēgts hostings un publiska HTTPS adrese.

## Kā tiek izrunāts nosaukums

Visiem konkrētajiem uzdevumiem: “Uzmanību, džeki… Nākamais izaicinājums — **[KARTĪTES NOSAUKUMS]!**” ar rotaļīgu, intriģējošu intonāciju, bez noteikumu izstāstīšanas.

Universālajiem klipiem lieto tikai kategorijas nosaukumu, piemēram: “Melnā kaste atver jaunu slepeno misiju!”
