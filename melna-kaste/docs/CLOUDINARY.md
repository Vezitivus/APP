# Cloudinary

Kontam jāpaliek Free plānā. Lietotne video netransformē: tā atskaņo augšupielādēto `secure_url`. Transformācijas tērē tos pašus 25 kredītus, ko glabāšana un datu pārraide.

## Mape

Visus video liec **vienā mapē** `melna-kaste`. Apakšmapes `standby`, `calls` un `special` vairs nav vajadzīgas. Sinhronizācija atpazīst failu pēc vārda (`1`, `1.mp4`, `izsaukums_flash`, `special_open`). Vecākā kontā, kur faili jau ir apakšmapēs, tie joprojām tiek nolasīti.

## Augšupielāde Media Library

1. Atver Cloudinary Console → **Media Library**.
2. Izveido mapi `melna-kaste`, ja tās nav. Atver šo mapi.
3. Spied **Upload** vai ievelc failu tieši šajā mapē.
4. Pirms augšupielādes nosauk failu tā, kā šajā failā un `VIDEO_NOSAUKUMI.md`. Piemēram `1.mp4` vai `izsaukums_flash.mp4`.
5. Public ID var ignorēt. Jaunā kontā mape un public ID ir atsevišķi: public ID bieži ir nejauša virkne vai faila vārds ar piedēkli (`1_xk3abc`). Vecākā kontā public ID var būt `melna-kaste/standby/1` vai `melna-kaste/1`. Abi varianti der.
6. Režijā atver **Video** un spied **Atjaunot no Cloudinary**.

Redzamo vārdu Media Library nemaini. `1` un `1.mp4` abi der. `10.mp4` nedrīkst kļūt par `1.mp4`.

## Standby vārdi

Divdesmit vietas. Fails saucas tikai ar ciparu un atrodas mapē `melna-kaste`:

`1.mp4`, `2.mp4`, `3.mp4`, …, `10.mp4`, …, `20.mp4`.

Garums var būt jebkāds. Secība vienmēr ir pēc cipara, nevis pēc burtiem: pēc `9.mp4` nāk `10.mp4`, nevis `1.mp4` vēlreiz un nevis kaut kas starpā. Nejaušas secības nav. Tukša vieta tiek izlaista, pārējie iet tālāk.

Režijā sadaļa **Standby video** rāda visas 20 vietas: kuras ir, kuru trūkst, un kurš klips šobrīd skan.

Pēc katra izsaukuma riņķis sākas no mazākā esošā cipara. Ja ir `1.mp4`, tas ir pirmais.

Vecais vārds joprojām aizpilda to pašu vietu, ja jaunā faila nav: `standby_01.mp4` ir 1. vieta, `standby_10.mp4` ir 10. vieta. Ja ir abi, tiek ņemts `1.mp4`.

Automātiskais izsaukums nesākas klipa vidū un nesākas arī tad, kad beidzas tikai pašreizējais klips. Tas gaida, līdz noskan pēdējais video šajā riņķī. Režijā tad rakstīts **Gaida, kamēr beigsies standby riņķis**. Poga **Izsaukt** ir izņēmums: tā sāk izsaukumu uzreiz.

## Izsaukumi

Fails saucas precīzi tā, kā `docs/VIDEO_NOSAUKUMI.md`, un arī tas ir mapē `melna-kaste`. Programmu mainīt nevajag. Ja uzdevumam faila nav, tiek ņemts kategorijas video (`izsaukums_flash.mp4`, `izsaukums_pair.mp4`, `izsaukums_team.mp4`). Ja nav arī tā, tiek ņemts `izsaukums_any.mp4`. Ja nav neviena, pēc cikla beigām uzreiz rāda vārdu, uzdevuma nosaukumu un QR zelta ietvarā. Šis skats paliek, kamēr režijā nospiež Turpināt.

Rezerves video nedrīkst saukt cita uzdevuma nosaukumu. Tāpēc `izsaukums_choice.mp4` netiek lietots dueļa vietā.

Kopīgajiem notikumiem vispirms meklē `special_global_vote.mp4` (un pārējos `special_<id>.mp4`), pēc tam `izsaukums_<id>.mp4`.

Papildu, neobligāti, tajā pašā mapē:

- `special_open.mp4` — vienu reizi spēles sākumā
- `special_end.mp4` — noslēguma ekrānā

## Ieteicamais fails

MP4, H.264, AAC, 16:9, 24–30 kadri sekundē. Free plānā viens fails līdz 100 MB.

1080p HD datu pārraide tērē kredītus aptuveni divreiz ātrāk nekā SD. Vienam vakaram ar vienu TV drošāk ir augšupielādēt **1280×720**, īsus klipus, un sekot Cloudinary Usage logam. Sīkāk `BEZMAKSAS_LIMITI.md`.

Jaunam uzdevumam režijā → Video → **Jauna kartīte** ieraksti ID un faila vārdu `izsaukums_<id>.mp4`, augšupielādē failu mapē `melna-kaste` un spied **Atjaunot no Cloudinary**.
