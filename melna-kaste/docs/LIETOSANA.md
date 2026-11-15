# Lietošana

## Pirms viesiem

1. Atver `/admin` telefonā vai datorā un ieej ar paroli.
2. Ja vajag tukšu vakaru, spied **Jauna spēle**. Vecie vakari paliek datubāzē.
3. Atver TV saiti uz lielā ekrāna un nospied **Aktivizēt TV**. Tas atļauj skaņu un, ja pārlūks atļauj, pilnekrānu.
4. Uzgaidāmajā ekrānā ir QR un kods. Viesi skenē, ievada tikai vārdu un saglabā atjaunošanas kodu.
5. Kad ir vismaz divi cilvēki, spied **Sākt**.

Testam vari pievienot sešus dalībniekus ar pogu režijā. Kodi parādās vienu reizi.

## Vakara laikā

TV pats maina standby video pēc to īstajām beigām, secībā `standby_01`, `standby_02`, … un tad atkal no pirmā. Automātiskais logs (sākumā 10–20 minūtes) tikai **sagatavo** nākamo izsaukumu. Video netiek pārtraukts. Izsaukums sākas, kad noslēdzas pēdējais standby klips.

Pēc izsaukuma video parādās vārds, QR un pilns skenēšanas laiks. Taimeris nesākas video laikā. Kartītes teksts ir tikai izsauktā telefonā.

Slepenā režija, kuru ekrāns nerāda:

- **Paātrināt** — sagatavo notikumu uzreiz. Ja jau rāda QR, saīsina laiku līdz 5 sekundēm.
- **Izlaist** — noņem sagatavoto vai aktīvo notikumu. Ja video vēl iet, tas turpinās.
- **Nomainīt** — patur to pašu kartīti, anulē veco QR.

Var apturēt automātiku, izslēgt auto izsaukumus, pabeigt uzdevumu, atzīmēt dueļa uzvarētāju, apstiprināt misiju vai priekšrocību. Dalībnieks var atteikties. Misijas un priekšrocības paliek telefonā un neaptur nākamos izsaukumus.

Ja nav neviena standby video, TV rāda melnu gaidīšanas ekrānu, un testa cikls ilgst 20 sekundes. Tas ir tikai pārbaudei.

## Pēc vakara

**Pabeigt** noliek visus ekrānus noslēguma skatā. **Atiestatīt** prasa otru apstiprinājumu un iztukšo pašreizējo sesiju. Lai saglabātu vakaru un sāktu jaunu, spied **Jauna spēle**.
