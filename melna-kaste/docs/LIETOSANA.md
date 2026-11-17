# Lietošana

## Pirms viesiem

1. Atver `/admin` telefonā vai datorā un ieej ar paroli.
2. Ja vajag tukšu vakaru, spied **Jauna spēle**. Vecie vakari paliek datubāzē.
3. Atver TV saiti uz lielā ekrāna un nospied **Aktivizēt TV**. Tas atļauj skaņu un, ja pārlūks atļauj, pilnekrānu.
4. Uzgaidāmajā ekrānā ir QR un kods. Viesi skenē, ievada tikai vārdu un saglabā atjaunošanas kodu.
5. Kad ir vismaz divi cilvēki, spied **Sākt**.

Testam vari pievienot sešus dalībniekus ar pogu režijā. Kodi parādās vienu reizi.

## Vakara laikā

Kad spēle ir sākusies, standby ir tukšs ekrāns: tikai video pa visu kadru, secībā `standby_01`, `standby_02`, … un tad atkal no pirmā. Nav koda, teksta vai statusa. TV pats maina klipus pēc to īstajām beigām. Automātiskais logs (sākumā 10–20 minūtes) tikai **sagatavo** nākamo izsaukumu. Video netiek pārtraukts. Izsaukums sākas, kad noslēdzas pēdējais standby klips.

Izsaukuma video vispirms ir pa visu ekrānu. Kad tas beidzas, meitene ar visu video noslīd uz leju, zelta ietvarā, un turpina klusi cilpot. Augšā ir liels QR, izsauktā vārds un uzdevuma nosaukums. Kartītes teksts joprojām ir tikai telefonā. Ja izsaukumam nav video, ietvarā ir mierīga melna zīme, un QR tāpat ir augšā.

Šis skats **nepazūd pats**. Nav skenēšanas taimera. Dalībnieks var skenēt visu laiku, kamēr QR ir ekrānā. Režijā, kamēr TV rāda izsaukumu, ir liela poga **Turpināt**. Tā aizver TV skatu un atgriež tīru standby no `standby_01`. Tas paliek spēkā arī tad, ja TV pārlādē. Ja kartīte jau ir atvērta, uzdevums telefonā turpinās. Ja neviens vēl nav skenējis, QR vairs neder.

Slepenā režija, kuru ekrāns nerāda:

- **Paātrināt** — sagatavo notikumu uzreiz, negaidot intervālu. Kamēr TV rāda izsaukumu, paātrināt neko nedara.
- **Izlaist** — noņem sagatavoto vai aktīvo notikumu. Ja standby video vēl iet, tas turpinās. Aktīvu izsaukumu izlaižot, TV atgriežas pie `standby_01`.
- **Nomainīt** — patur to pašu kartīti, anulē veco QR.
- **Turpināt** — aizver TV izsaukumu. **Atsākt auto** ir cita poga: tā tikai atsāk automātisko sagatavošanu pēc pauzes.

Var apturēt automātiku, izslēgt auto izsaukumus, pabeigt uzdevumu, atzīmēt dueļa uzvarētāju, apstiprināt misiju vai priekšrocību. Dalībnieks var atteikties. Misijas un priekšrocības paliek telefonā. Pēc Turpināt tās vairs netur TV, un nākamo izsaukumu var gatavot. Parastam uzdevumam TV paliek tukšs, bet nākamo izsaukumu gatavo, kad uzdevums ir pabeigts vai izlaists.

Ja nav neviena standby video, TV ir melns. Testa cikls joprojām ilgst 20 sekundes, bet uz ekrāna nav nekā. Tas ir tikai pārbaudei.

## Pēc vakara

**Pabeigt** noliek visus ekrānus noslēguma skatā. **Atiestatīt** prasa otru apstiprinājumu un iztukšo pašreizējo sesiju. Lai saglabātu vakaru un sāktu jaunu, spied **Jauna spēle**.
