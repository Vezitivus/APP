# Cloudinary

Kontam jāpaliek Free plānā. Lietotne video netransformē: tā atskaņo augšupielādēto `secure_url`. Transformācijas tērē tos pašus 25 kredītus, ko glabāšana un datu pārraide.

## Mapes

Augšupielādē tieši šajās mapēs (Media Library vai Upload API):

- `melna-kaste/standby/` — secīgie gaidīšanas video
- `melna-kaste/calls/` — izsaukuma video
- `melna-kaste/special/` — sākums, noslēgums un kopīgie notikumi

Public ID piemērs: `melna-kaste/standby/1`.

## Standby vārdi

Divdesmit vietas. Fails saucas tikai ar ciparu:

`1.mp4`, `2.mp4`, `3.mp4`, …, `10.mp4`, …, `20.mp4`.

Public ID ir `melna-kaste/standby/1` … `melna-kaste/standby/20`. Garums var būt jebkāds. Secība vienmēr ir pēc cipara, nevis pēc burtiem: pēc `9.mp4` nāk `10.mp4`, nevis `1.mp4` vēlreiz un nevis kaut kas starpā. Nejaušas secības nav. Tukša vieta tiek izlaista, pārējie iet tālāk.

Režijā sadaļa **Standby video** rāda visas 20 vietas: kuras ir, kuru trūkst, un kurš klips šobrīd skan.

Pēc katra izsaukuma riņķis sākas no mazākā esošā cipara. Ja ir `1.mp4`, tas ir pirmais.

Vecais vārds joprojām aizpilda to pašu vietu, ja jaunā faila nav: `standby_01.mp4` ir 1. vieta, `standby_10.mp4` ir 10. vieta. Ja ir abi, tiek ņemts `1.mp4`.

Automātiskais izsaukums nesākas klipa vidū un nesākas arī tad, kad beidzas tikai pašreizējais klips. Tas gaida, līdz noskan pēdējais video šajā riņķī. Režijā tad rakstīts **Gaida, kamēr beigsies standby riņķis**. Poga **Izsaukt** ir izņēmums: tā sāk izsaukumu uzreiz.

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
