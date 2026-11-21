# Video failu vārdi

Vārdi un kartīšu ID nemainās. Failu liec mapē, kas rakstīta pie tā. Jaunā Cloudinary kontā public ID var būt nejaušs (`1_xk3abc` vai gara virkne) un nesatur mapes vārdu. Sinhronizācija pazīst failu pēc mapes un vārda: `1`, `1.mp4` vai `izsaukums_flash`. Vecākā kontā der arī public ID `melna-kaste/standby/1`.

## Augšupielāde

1. Atver Cloudinary Console → **Media Library**.
2. Atver mapi `melna-kaste/standby`, `melna-kaste/calls` vai `melna-kaste/special`. Ja mapes nav, izveido tās.
3. Spied **Upload** vai ievelc failu tieši šajā mapē. Faila vārds datorā jau ir pareizais, piemēram `1.mp4` vai `izsaukums_flash.mp4`.
4. Public ID labot nevajag. Redzamo vārdu atstāj tādu, kāds ir fails.
5. Režijā atver **Video** un spied **Atjaunot no Cloudinary**.

## Standby

Divdesmit vietas mapē `melna-kaste/standby`. Fails saucas tikai ar ciparu, bez `standby_` priekšā.

| Vieta | Mape | Fails |
| --- | --- | --- |
| 1 | `melna-kaste/standby` | `1.mp4` |
| 2 | `melna-kaste/standby` | `2.mp4` |
| … | `melna-kaste/standby` | … |
| 10 | `melna-kaste/standby` | `10.mp4` |
| 20 | `melna-kaste/standby` | `20.mp4` |

Secība ir pēc cipara: 1, 2, 3, …, 9, 10, 11, …, 20. Nav 1, 10, 2. Tukša vieta tiek izlaista. Pēc izsaukuma riņķis sākas no mazākā esošā cipara.

Vecais vārds joprojām der tai pašai vietai, ja jaunā faila nav: `standby_01.mp4` ir 1. vieta, `standby_10.mp4` ir 10. vieta. Ja mapē ir gan `1.mp4`, gan `standby_01.mp4`, tiek atskaņots `1.mp4`.

## Izsaukumi

Šie faili ir mapē `melna-kaste/calls`.

| Uzdevums | ID | Fails |
| --- | --- | --- |
| Pārdod nepārdodamo | `sales_pitch` | `izsaukums_sales_pitch.mp4` |
| Neiespējamais advokāts | `bad_lawyer` | `izsaukums_bad_lawyer.mp4` |
| Sporta komentētājs | `sports_cast` | `izsaukums_sports_cast.mp4` |
| Divas patiesības un vieni meli | `truth_lie` | `izsaukums_truth_lie.mp4` |
| Mēmā reklāma | `mimic` | `izsaukums_mimic.mp4` |
| Nepareizais eksperts | `absurd_duet` | `izsaukums_absurd_duet.mp4` |
| Dzīvā skulptūra | `freeze_frame` | `izsaukums_freeze_frame.mp4` |
| Sliktākā biznesa ideja | `dubious_team` | `izsaukums_dubious_team.mp4` |
| Absurdo likumu komiteja | `committee` | `izsaukums_committee.mp4` |
| Stāsts pa vienam vārdam | `improv_story` | `izsaukums_improv_story.mp4` |
| Trīs cilvēku reklāma | `bad_ad` | `izsaukums_bad_ad.mp4` |
| Trīs piecu sekunžu laikā | `three_in_five` | `izsaukums_three_in_five.mp4` |
| Stāsts atpakaļgaitā | `reverse_story` | `izsaukums_reverse_story.mp4` |
| Tikai nepareizas atbildes | `wrong_answers` | `izsaukums_wrong_answers.mp4` |
| Bez viena vārda | `gesture` | `izsaukums_gesture.mp4` |
| Nenopietnā runa | `look` | `izsaukums_look.mp4` |
| Slepenā misija | `mission_01` … `mission_20` | `izsaukums_mission.mp4` |
| Priekšrocība | `perk_answer`, `perk_untouchable`, `perk_rematch`, `perk_bonus`, `perk_time`, `perk_veto` | `izsaukums_perk.mp4` |
| Brīvā izvēle | `choice` | `izsaukums_choice.mp4` |
| Brīvais duelis | `duel` | `izsaukums_duel.mp4` |
| Ātrais izaicinājums | kategorija FLASH | `izsaukums_flash.mp4` |
| Divu cilvēku izaicinājums | kategorija PAIR | `izsaukums_pair.mp4` |
| Komandas izaicinājums | kategorija TEAM | `izsaukums_team.mp4` |
| Universālais izsaukums | rezerve | `izsaukums_any.mp4` |

Kopīgie notikumi: `global_vote`, `global_duel`, `global_truths`, `global_team`, `global_talent`, `global_rematch`.

Katram var būt `special_<id>.mp4` mapē `melna-kaste/special` vai `izsaukums_<id>.mp4` mapē `melna-kaste/calls`.

Sākums un beigas mapē `melna-kaste/special`: `special_open.mp4`, `special_end.mp4`.
