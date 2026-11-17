# Cloudinary

Kontam jāpaliek Free plānā. Lietotne video netransformē: tā atskaņo augšupielādēto `secure_url`. Transformācijas tērē tos pašus 25 kredītus, ko glabāšana un datu pārraide.

## Mapes

Augšupielādē tieši šajās mapēs (Media Library vai Upload API):

- `melna-kaste/standby/` — secīgie gaidīšanas video
- `melna-kaste/calls/` — izsaukuma video
- `melna-kaste/special/` — sākums, noslēgums un kopīgie notikumi

Public ID piemērs: `melna-kaste/standby/standby_01`.

## Standby vārdi

`standby_01.mp4`, `standby_02.mp4`, `standby_03.mp4`, … Numurs var būt 2 vai 3 cipari. Secība vienmēr ir pēc numura, neatkarīgi no garuma. Nejaušas secības nav. `standby_10.mp4` nāk pēc `standby_09.mp4`.

Pēc katra izsaukuma cikls sākas no `standby_01.mp4`.

## Izsaukumi

Fails saucas precīzi tā, kā `docs/VIDEO_NOSAUKUMI.md`. Programmu mainīt nevajag. Ja uzdevumam faila nav, tiek ņemts kategorijas video (`izsaukums_flash.mp4`, `izsaukums_pair.mp4`, `izsaukums_team.mp4`). Ja nav arī tā, tiek ņemts `izsaukums_any.mp4`. Ja nav neviena, pēc cikla beigām uzreiz rāda vārdu, uzdevuma nosaukumu un QR zelta ietvarā. Šis skats paliek, kamēr režijā nospiež Turpināt.

Rezerves video nedrīkst saukt cita uzdevuma nosaukumu. Tāpēc `izsaukums_choice.mp4` netiek lietots dueļa vietā.

Kopīgajiem notikumiem vispirms meklē `melna-kaste/special/special_global_vote.mp4` (un pārējos `special_<id>.mp4`), pēc tam `calls` mapi.

Papildu, neobligāti:

- `melna-kaste/special/special_open.mp4` — vienu reizi spēles sākumā
- `melna-kaste/special/special_end.mp4` — noslēguma ekrānā

## Ieteicamais fails

MP4, H.264, AAC, 16:9, 24–30 kadri sekundē. Free plānā viens fails līdz 100 MB.

1080p HD datu pārraide tērē kredītus aptuveni divreiz ātrāk nekā SD. Vienam vakaram ar vienu TV drošāk ir augšupielādēt **1280×720**, īsus klipus, un sekot Cloudinary Usage logam. Sīkāk `BEZMAKSAS_LIMITI.md`.

Jaunam uzdevumam režijā → Video → **Jauna kartīte** ieraksti ID un faila vārdu `izsaukums_<id>.mp4`, augšupielādē failu mapē `calls` un spied **Atjaunot no Cloudinary**.
