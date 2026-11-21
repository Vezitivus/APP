import type { AutoCategory, CardDef, Category } from "./types";

const FLASH = "izsaukums_flash.mp4";
const PAIR = "izsaukums_pair.mp4";
const TEAM = "izsaukums_team.mp4";

const MISSIONS: { id: string; text: string }[] = [
  { id: "mission_01", text: "Panāc, lai kāds pats ierosina NHL spēli, viņam to tieši neprasot." },
  { id: "mission_02", text: "Iegūsti cita dalībnieka piekrišanu kopīgam izaicinājumam." },
  { id: "mission_03", text: "Panāc, lai kāds izsauc citu cilvēku uz šautriņu dueli." },
  { id: "mission_04", text: "Panāc, lai kāds pastāsta smieklīgu atgadījumu, kuru pārējie nezina." },
  { id: "mission_05", text: "Panāc, lai vēl kāds vienojas ar tevi par kopīgu aktivitāti." },
  { id: "mission_06", text: "Panāc, lai kāds pastāsta savu pirmo iespaidu par citu dalībnieku." },
  { id: "mission_07", text: "Pārliecini kādu izspēlēt draudzīgu revanšu." },
  { id: "mission_08", text: "Panāc, lai kāds pats piedāvā uzspēlēt pokeru." },
  { id: "mission_09", text: "Uzzini drauga iecienītāko filmu un mēģini pārliecināt viņu par savu favorītu." },
  { id: "mission_10", text: "Panāc, lai kāds spontāni ierosina kopīgu fotogrāfiju." },
  { id: "mission_11", text: "Sarunā, lai cits dalībnieks tevi atbalsta nākamajā duelī." },
  { id: "mission_12", text: "Panāc, lai vismaz divi cilvēki izdomā jaunu sacensību noteikumus." },
  { id: "mission_13", text: "Uzzini cita dalībnieka pārsteidzošu hobiju vai prasmi." },
  { id: "mission_14", text: "Panāc, lai kāds piekrīt pārējiem iemācīt praktisku triku." },
  { id: "mission_15", text: "Panāc, lai kāds nosauc vakara labāko šautriņu spēlētāju." },
  { id: "mission_16", text: "Pārliecini kādu kļūt par nākamā dueļa tiesnesi." },
  { id: "mission_17", text: "Panāc, lai kāds pasaka, kuram visvairāk uzticas komandu spēlē." },
  { id: "mission_18", text: "Pārliecini kādu, ka tev ir īpaša vara, neparādot savu kartīti." },
  { id: "mission_19", text: "Iegūsti divus dažādus praktiskus padomus no cita dalībnieka." },
  { id: "mission_20", text: "Panāc, lai kāds pats ierosina kopīgu tostu ar jebkuru dzērienu." },
];

function card(partial: CardDef): CardDef {
  return partial;
}

export const BUILTIN_CARDS: CardDef[] = [
  card({
    id: "sales_pitch",
    title: "Pārdod nepārdodamo",
    category: "FLASH",
    summary: "Dalībnieks izvēlas vienu citu spēlētāju un mēģina viņam pārdot neredzamu, pilnīgi bezjēdzīgu produktu.",
    rules: [
      "Prezentācijai ir 45 sekundes.",
      "Otrs dalībnieks uzdod vienu ļoti nopietnu jautājumu.",
      "Pārējie nosaka, vai darījums būtu noticis.",
    ],
    durationSeconds: 45,
    minPlayers: 2,
    idealGroup: 2,
    selection: "player_one",
    privacy: "private_card",
    videoFile: "izsaukums_sales_pitch.mp4",
    categoryVideoFile: FLASH,
    allowsDecline: true,
  }),
  card({
    id: "bad_lawyer",
    title: "Neiespējamais advokāts",
    category: "FLASH",
    summary: "Dalībniekam jāaizstāv apgalvojums, ka pēdējam picas gabalam jābūt valsts īpašumā.",
    rules: [
      "Izvēlētais pretinieks ir prokurors.",
      "Prokurors izsaka vienu pretargumentu.",
      "Aizstāvībai ir 30 sekundes.",
      "Publika nosaka rezultātu.",
    ],
    durationSeconds: 30,
    minPlayers: 2,
    idealGroup: 2,
    selection: "player_one",
    privacy: "private_card",
    videoFile: "izsaukums_bad_lawyer.mp4",
    categoryVideoFile: FLASH,
    allowsDecline: true,
  }),
  card({
    id: "sports_cast",
    title: "Sporta komentētājs",
    category: "FLASH",
    summary: "Komentē otra dalībnieka pilnīgi ikdienišķu darbību kā pasaules čempionāta finālu.",
    rules: [
      "Izvēlētais spēlētājs 20 sekundes veic ikdienišķu darbību.",
      "Komentētājam jārunā ar maksimālu dramatismu.",
      "Mērķis ir sasmīdināt pārējos.",
    ],
    durationSeconds: 20,
    minPlayers: 2,
    idealGroup: 2,
    selection: "player_one",
    privacy: "private_card",
    videoFile: "izsaukums_sports_cast.mp4",
    categoryVideoFile: FLASH,
    allowsDecline: true,
  }),
  card({
    id: "truth_lie",
    title: "Divas patiesības un vieni meli",
    category: "FLASH",
    summary: "Dalībnieks nosauc trīs faktus par sevi, no kuriem viens ir izdomāts.",
    rules: [
      "Izvēlētais spēlētājs uzdod vienu precizējošu jautājumu.",
      "Pēc tam viņam jāatmin meli.",
      "Pareizā atbilde tiek atklāta visiem.",
      "Kopējais paredzētais ilgums — līdz 90 sekundēm.",
    ],
    durationSeconds: 90,
    minPlayers: 2,
    idealGroup: 2,
    selection: "player_one",
    privacy: "private_card",
    videoFile: "izsaukums_truth_lie.mp4",
    categoryVideoFile: FLASH,
    allowsDecline: true,
  }),
  card({
    id: "mimic",
    title: "Mēmā reklāma",
    category: "FLASH",
    summary: "Bez vārdiem jāreklamē neeksistējoša ierīce.",
    rules: [
      "Nedrīkst runāt vai rakstīt.",
      "Izvēlētajam dalībniekam 30 sekundēs jāatmin produkts.",
      "Pēc tam tiek atklāts izdomātais produkta nosaukums.",
    ],
    durationSeconds: 30,
    minPlayers: 2,
    idealGroup: 2,
    selection: "player_one",
    privacy: "private_card",
    videoFile: "izsaukums_mimic.mp4",
    categoryVideoFile: FLASH,
    allowsDecline: true,
  }),
  card({
    id: "three_in_five",
    title: "Trīs piecu sekunžu laikā",
    category: "FLASH",
    summary: "Piecu sekunžu laikā jānosauc trīs lietas, kuras nekad nevajadzētu teikt darba intervijā.",
    rules: ["Atbildes nedrīkst atkārtoties.", "Ja neizdodas, cits cilvēks drīkst mēģināt."],
    durationSeconds: 5,
    minPlayers: 1,
    idealGroup: 1,
    selection: "none",
    privacy: "private_card",
    videoFile: "izsaukums_three_in_five.mp4",
    categoryVideoFile: FLASH,
    allowsDecline: true,
  }),
  card({
    id: "reverse_story",
    title: "Stāsts atpakaļgaitā",
    category: "FLASH",
    summary: "Jāizstāsta smieklīgs stāsts, sākot ar tā pēdējo teikumu.",
    rules: ["Pirmais teikums ir stāsta beigas.", "Nākamajās 30 sekundēs jāpaskaidro, kā līdz tām nonāca."],
    durationSeconds: 30,
    minPlayers: 1,
    idealGroup: 1,
    selection: "none",
    privacy: "private_card",
    videoFile: "izsaukums_reverse_story.mp4",
    categoryVideoFile: FLASH,
    allowsDecline: true,
  }),
  card({
    id: "wrong_answers",
    title: "Tikai nepareizas atbildes",
    category: "FLASH",
    summary: "Jāatbild uz jautājumu: “Kas īstenībā ir MELNĀ KASTE?”",
    rules: [
      "Atbildei jābūt apzināti nepareizai.",
      "Atbildes sniegšanai ir 30 sekundes.",
      "Mērķis ir izdomāt iespējami absurdu skaidrojumu.",
    ],
    durationSeconds: 30,
    minPlayers: 1,
    idealGroup: 1,
    selection: "none",
    privacy: "private_card",
    videoFile: "izsaukums_wrong_answers.mp4",
    categoryVideoFile: FLASH,
    allowsDecline: true,
  }),
  card({
    id: "gesture",
    title: "Bez viena vārda",
    category: "FLASH",
    summary: "Ar žestiem jāizskaidro internets cilvēkam no 18. gadsimta.",
    rules: [
      "Nedrīkst runāt, dziedāt vai rakstīt.",
      "Izpildes laiks ir 30 sekundes.",
      "Pirmais, kurš atmin, var izvēlēties nākamo dziesmu.",
    ],
    durationSeconds: 30,
    minPlayers: 1,
    idealGroup: 1,
    selection: "none",
    privacy: "private_card",
    videoFile: "izsaukums_gesture.mp4",
    categoryVideoFile: FLASH,
    allowsDecline: true,
  }),
  card({
    id: "look",
    title: "Nenopietnā runa",
    category: "FLASH",
    summary: "Dalībniekam ļoti nopietnā tonī jāpaskaidro, kāpēc veļasmašīnā pazūd zeķes.",
    rules: [
      "Runas ilgums ir 30 sekundes.",
      "Nedrīkst pasmieties par savu stāstu.",
      "Pārējie skatās, bet apzināti netraucē.",
    ],
    durationSeconds: 30,
    minPlayers: 1,
    idealGroup: 1,
    selection: "none",
    privacy: "private_card",
    videoFile: "izsaukums_look.mp4",
    categoryVideoFile: FLASH,
    allowsDecline: true,
  }),
  card({
    id: "absurd_duet",
    title: "Nepareizais eksperts",
    category: "PAIR",
    summary: "Diviem cilvēkiem jāpaskaidro, kāpēc pirmdiena būtu jāaizliedz ar likumu.",
    rules: [
      "Katram ir 20 sekundes savai teorijai.",
      "Argumenti nedrīkst atkārtoties.",
      "Publika izvēlas smieklīgāko teoriju.",
    ],
    durationSeconds: 40,
    minPlayers: 2,
    idealGroup: 2,
    selection: "system_one",
    privacy: "private_card",
    videoFile: "izsaukums_absurd_duet.mp4",
    categoryVideoFile: PAIR,
    allowsDecline: true,
  }),
  card({
    id: "freeze_frame",
    title: "Dzīvā skulptūra",
    category: "PAIR",
    summary: "Diviem cilvēkiem jāizveido statiska poza par tēmu “Pirmais rīts pēc vecpuišu balles”.",
    rules: ["Sagatavošanai ir 15 sekundes.", "Pozā jāsastingst uz 10 sekundēm.", "Pārējie izdomā skulptūras nosaukumu."],
    durationSeconds: 25,
    minPlayers: 2,
    idealGroup: 2,
    selection: "system_one",
    privacy: "private_card",
    videoFile: "izsaukums_freeze_frame.mp4",
    categoryVideoFile: PAIR,
    allowsDecline: true,
  }),
  card({
    id: "dubious_team",
    title: "Sliktākā biznesa ideja",
    category: "TEAM",
    summary: "Dalībnieki izdomā biznesu, kurā neviens saprātīgs cilvēks neinvestētu.",
    rules: [
      "Sagatavošanai ir 60 sekundes.",
      "Jāizdomā uzņēmuma nosaukums un piedāvājums.",
      "Viens dalībnieks prezentē ideju.",
      "Pārējie ir investori un uzdod jautājumus.",
    ],
    durationSeconds: 90,
    minPlayers: 2,
    idealGroup: 3,
    selection: "system_many",
    privacy: "private_card",
    videoFile: "izsaukums_dubious_team.mp4",
    categoryVideoFile: TEAM,
    allowsDecline: true,
  }),
  card({
    id: "committee",
    title: "Absurdo likumu komiteja",
    category: "TEAM",
    summary: "Komandai jāizdomā viens jauns, smieklīgs pasākuma noteikums.",
    rules: [
      "Sagatavošanai ir 45 sekundes.",
      "Noteikumam jābūt nekaitīgam un izpildāmam.",
      "Pārējie balso, vai noteikums nākamās 10 minūtes būs spēkā.",
    ],
    durationSeconds: 60,
    minPlayers: 2,
    idealGroup: 3,
    selection: "system_many",
    privacy: "private_card",
    videoFile: "izsaukums_committee.mp4",
    categoryVideoFile: TEAM,
    allowsDecline: true,
  }),
  card({
    id: "improv_story",
    title: "Stāsts pa vienam vārdam",
    category: "TEAM",
    summary: "Izvēlētie dalībnieki kopīgi veido stāstu.",
    rules: [
      "Katrs savā gājienā drīkst pateikt tikai vienu vārdu.",
      "Jāsaglabā dalībnieku secība.",
      "Pēc 60 sekundēm stāstam tiek dots nosaukums.",
    ],
    durationSeconds: 60,
    minPlayers: 2,
    idealGroup: 4,
    selection: "system_many",
    privacy: "private_card",
    videoFile: "izsaukums_improv_story.mp4",
    categoryVideoFile: TEAM,
    allowsDecline: true,
  }),
  card({
    id: "bad_ad",
    title: "Trīs cilvēku reklāma",
    category: "TEAM",
    summary: "Komanda reklamē tukšu glāzi kā gada revolucionārāko izgudrojumu.",
    rules: [
      "Katram jāpasaka vismaz viens teikums.",
      "Reklāma nedrīkst pārsniegt 45 sekundes.",
      "Publika izvēlas labāko reklāmas saukli.",
    ],
    durationSeconds: 45,
    minPlayers: 2,
    idealGroup: 3,
    selection: "system_many",
    privacy: "private_card",
    videoFile: "izsaukums_bad_ad.mp4",
    categoryVideoFile: TEAM,
    allowsDecline: true,
  }),
  card({
    id: "choice",
    title: "Brīvā izvēle",
    category: "CHOICE",
    summary: "Dalībnieks pats izdomā dueli vai kopīgu aktivitāti un izvēlas cilvēkus no reģistrētā saraksta.",
    rules: [
      "Duelī ieraksti aktivitātes nosaukumu un, ja vajag, noteikumus, tad izvēlies vienu pretinieku.",
      "Kopīgā aktivitātē ieraksti nosaukumu un izvēlies vienu vai vairākus citus dalībniekus.",
      "Sevi izvēlēties nevar. Vienu cilvēku nevar atzīmēt divreiz.",
      "Pēc apstiprināšanas TV parāda nosaukumu un iesaistītos.",
    ],
    durationSeconds: 0,
    minPlayers: 2,
    idealGroup: 2,
    selection: "player_choice",
    privacy: "private_card",
    videoFile: "izsaukums_choice.mp4",
    categoryVideoFile: null,
    allowsDecline: true,
  }),
  card({
    id: "duel",
    title: "Brīvais duelis",
    category: "CHOICE",
    summary: "Dalībnieks izdomā dueli, ieraksta noteikumus un izvēlas vienu pretinieku.",
    rules: [
      "Aktivitātes nosaukums nav ierobežots ar iepriekš sagatavotu sarakstu.",
      "Izvēlies tieši vienu pretinieku no reģistrētajiem dalībniekiem.",
      "Sevi izvēlēties nevar.",
    ],
    durationSeconds: 0,
    minPlayers: 2,
    idealGroup: 2,
    selection: "player_choice",
    privacy: "private_card",
    videoFile: "izsaukums_duel.mp4",
    categoryVideoFile: null,
    allowsDecline: true,
  }),
  ...missionCards(),
  ...perkCards(),
  ...globalCards(),
];

function missionCards(): CardDef[] {
  return MISSIONS.map((mission, index) => ({
    id: mission.id,
    title: `Slepenā misija ${index + 1}`,
    category: "MISSION" as const,
    summary: mission.text,
    rules: [
      "Citi dalībnieki nedrīkst uzzināt misijas mērķi.",
      "Misija notiek pasākuma fonā un neaptur pārējos izsaukumus.",
      "Kad izdodas, atzīmē to telefonā. Organizators var apstiprināt rezultātu.",
    ],
    durationSeconds: 1800,
    minPlayers: 1,
    idealGroup: 1,
    selection: "none" as const,
    privacy: "secret_mission" as const,
    videoFile: "izsaukums_mission.mp4",
    categoryVideoFile: null,
    allowsDecline: true,
  }));
}

function perkCards(): CardDef[] {
  const perks: { id: string; title: string; summary: string }[] = [
    { id: "perk_answer", title: "Atbilde pirms izvēles", summary: "Tiesības izvēlēties nākamā dueļa disciplīnu." },
    { id: "perk_untouchable", title: "Neaizskaramais", summary: "Vienu reizi atteikties no dueļa." },
    { id: "perk_rematch", title: "Revanša tiesības", summary: "Pieprasīt atkārtotu dueli pēc zaudējuma." },
    { id: "perk_bonus", title: "Bonusa mēģinājums", summary: "Pieprasīt vienu papildu mēģinājumu." },
    { id: "perk_time", title: "Laika meistars", summary: "Pieprasīt papildu trīs minūtes atbilstošā uzdevumā." },
    { id: "perk_veto", title: "Veto tiesības", summary: "Vienu reizi noraidīt papildu nosacījumu." },
  ];
  return perks.map((perk) => ({
    id: perk.id,
    title: perk.title,
    category: "PERK" as const,
    summary: perk.summary,
    rules: [
      "Priekšrocība paliek telefonā, līdz to izmanto vai spēle beidzas.",
      "Izmantošanu reģistrē organizators.",
      "Pēc izmantošanas to nevar aktivizēt vēlreiz.",
    ],
    durationSeconds: 0,
    minPlayers: 1,
    idealGroup: 1,
    selection: "none" as const,
    privacy: "perk" as const,
    videoFile: "izsaukums_perk.mp4",
    categoryVideoFile: null,
    allowsDecline: true,
  }));
}

function globalCards(): CardDef[] {
  const events: { id: string; title: string; summary: string }[] = [
    { id: "global_vote", title: "Klusā balsošana", summary: "Visi norāda uz iespējami labāko komandas kapteini." },
    { id: "global_duel", title: "Negaidītais duelis", summary: "Divi brīvprātīgie sacenšas šautriņu mešanā." },
    { id: "global_truths", title: "Divas patiesības", summary: "Izvēlētais spēlētājs nosauc divas patiesības un vienus melus." },
    { id: "global_team", title: "Pārsteiguma komanda", summary: "Dalībnieki sadalās komandās īsam izaicinājumam." },
    { id: "global_talent", title: "Nezināmais talants", summary: "Katrs nosauc pārējiem nezināmu prasmi." },
    { id: "global_rematch", title: "Revanša stunda", summary: "Iespējams pieprasīt revanšu iepriekšējā spēlē." },
  ];
  return events.map((event) => ({
    id: event.id,
    title: event.title,
    category: "GLOBAL" as const,
    summary: event.summary,
    rules: ["Notikums attiecas uz visiem klātesošajiem.", "Individuāls QR nav nepieciešams."],
    durationSeconds: 0,
    minPlayers: 2,
    idealGroup: 2,
    selection: "none" as const,
    privacy: "public_event" as const,
    videoFile: `izsaukums_${event.id}.mp4`,
    categoryVideoFile: null,
    allowsDecline: false,
  }));
}

const BUILTIN_BY_ID = new Map(BUILTIN_CARDS.map((card) => [card.id, card]));

/** No call video was produced for these cards, so they are not in the live game. */
export const RETIRED_CARD_IDS = new Set(["choice", "duel"]);

export function isBuiltinCard(id: string): boolean {
  return BUILTIN_BY_ID.has(id) && !RETIRED_CARD_IDS.has(id);
}

export function catalog(custom: CardDef[] = []): CardDef[] {
  const merged = new Map(BUILTIN_BY_ID);
  for (const card of custom) merged.set(card.id, card);
  return [...merged.values()].filter((card) => !RETIRED_CARD_IDS.has(card.id));
}

export function cardById(id: string, custom: CardDef[] = []): CardDef | undefined {
  if (RETIRED_CARD_IDS.has(id)) return undefined;
  return custom.find((card) => card.id === id) ?? BUILTIN_BY_ID.get(id);
}

export function isPlayable(card: CardDef, eligibleCount: number): boolean {
  if (card.category === "GLOBAL") return eligibleCount >= 2;
  if (eligibleCount < card.minPlayers) return false;
  if (
    (card.selection === "system_one" ||
      card.selection === "player_one" ||
      card.selection === "player_many" ||
      card.selection === "player_choice") &&
    eligibleCount < 2
  ) {
    return false;
  }
  if (card.selection === "system_many" && eligibleCount < 2) return false;
  return true;
}

export function categoryOf(card: CardDef): Category {
  return card.category;
}

export function isAutoCategory(category: Category): category is AutoCategory {
  return category !== "GLOBAL";
}
