# MELNĀ KASTE V6 — Standby video režīms

## Kur ievietot AI klipus

GitHub: https://github.com/Vezitivus/APP/tree/main/melna-kaste/static/videos

Nosauc failus precīzi un ievieto tajā pašā mapē, kur ir izsaukumu video:

- `standby_01.mp4` — piemēram, 7 sekundes
- `standby_02.mp4` — piemēram, 11 sekundes
- `standby_03.mp4` — piemēram, 18 sekundes
- `standby_04.mp4` — piemēram, 9 sekundes
- `standby_05.mp4` — piemēram, 23 sekundes
- ...
- `standby_99.mp4` — atbalstīti arī trīsciparu numuri, piemēram, `standby_100.mp4`.

Nav nepieciešams izveidot visus failus. Video garums nav jānorāda kodā: pāreju nosaka reālais `ended` notikums. Klipi atkārtojas **alfabētiskā failu nosaukumu secībā**, pēc pēdējā atkal sākas pirmais. Nepieciešams vismaz viens `standby_XX.mp4`, lai aktivizētu video gaidīšanas režīmu. Ja neviena nav, paliek iepriekšējais teksta gaidīšanas ekrāns.

## Plūsma

1. TV sāk `standby_01.mp4` un turpina ar `standby_02.mp4` utt.
2. Automātiskais taimeris vai organizators sagatavo izsaukumu; serveris iestata `queued`, bet **nepārtrauc** pašreizējo video.
3. Tikai pēc aktīvā standby video beigām TV ziņo serverim un sāk konkrēto AI izsaukuma video.
4. Kad izsaukuma video beidzas, atveras spēlētāja vārds, QR un pilns 60 sekunžu laiks.
5. Pēc notikuma noslēguma TV atgriežas pie standby klipiem.

Organizatora `SAGATAVOT IZSAUKUMU` un `⏩` ievieto izsaukumu rindā, nevis pārgriež video vidū. `IZLAIST` atceļ rindā gaidošu uzdevumu, nepārtraucot standby video. Režijai TV jāatver ar `/admin` piedāvāto saiti **ATVĒRT TV** (ar aizsargātu TV atslēgu).

## Ieteikumi video izgatavošanai

- 16:9 (1920×1080), MP4 H.264, 24–30 fps.
- Visos standby kadros saglabā **vienādu kompozīciju, kameru, gaismu un izgriezumu**, lai klipu savienojuma vietas nebūtu redzami lēcieni.
- Ja vajadzīgs īsts bezšuvju loop, konkrētā klipa pēdējais kadrs jāpielāgo pirmajam; tikai programmatiska pāreja vien nevar izlabot atšķirīgus kadrus.
- Standby video pēc noklusējuma tiek atskaņoti bez skaņas līdz TV audio aktivizēšanai. Lai izsaukuma video skanētu, TV sākumā nospied **IESLĒGT TV SKAŅU**. Pārlūku automātiskās atskaņošanas noteikumi dažādās iekārtās atšķiras.
- Pēc video pievienošanas GitHub pārizvieto serveri. Tā kā GitHub kopā ar Python kodu pats nedarbina serveri, nepieciešams web hostings.
- AI izsaukuma video failu nosaukumi paliek spēkā kā V5 (skati `VIDEO_NOSAUKUMI.md`).

## Pārbaude

Vienā pārlūkā atver `/admin`, otrā — admin paneļa pogu **ATVĒRT TV**. Palaid spēli, pagaidī līdz standby video sākumam un režijā sagatavo izsaukumu. Pārliecinies, ka standby pabeidzas, tikai tad sākas izsaukuma klips, pēc tam vārds + QR + 60 sekunžu laiks.