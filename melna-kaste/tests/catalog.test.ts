import { describe, expect, it } from "vitest";
import { catalog } from "../src/lib/game/cards";

const challenges: { id: string; title: string; category: string; videoFile: string; phrase: string }[] = [
  { id: "sales_pitch", title: "Pārdod nepārdodamo", category: "FLASH", videoFile: "izsaukums_sales_pitch.mp4", phrase: "45 sekundes" },
  { id: "bad_lawyer", title: "Neiespējamais advokāts", category: "FLASH", videoFile: "izsaukums_bad_lawyer.mp4", phrase: "picas gabalam" },
  { id: "sports_cast", title: "Sporta komentētājs", category: "FLASH", videoFile: "izsaukums_sports_cast.mp4", phrase: "čempionāta finālu" },
  { id: "truth_lie", title: "Divas patiesības un vieni meli", category: "FLASH", videoFile: "izsaukums_truth_lie.mp4", phrase: "90 sekundēm" },
  { id: "mimic", title: "Mēmā reklāma", category: "FLASH", videoFile: "izsaukums_mimic.mp4", phrase: "Nedrīkst runāt" },
  { id: "absurd_duet", title: "Nepareizais eksperts", category: "PAIR", videoFile: "izsaukums_absurd_duet.mp4", phrase: "pirmdiena" },
  { id: "freeze_frame", title: "Dzīvā skulptūra", category: "PAIR", videoFile: "izsaukums_freeze_frame.mp4", phrase: "vecpuišu balles" },
  { id: "dubious_team", title: "Sliktākā biznesa ideja", category: "TEAM", videoFile: "izsaukums_dubious_team.mp4", phrase: "60 sekundes" },
  { id: "committee", title: "Absurdo likumu komiteja", category: "TEAM", videoFile: "izsaukums_committee.mp4", phrase: "nekaitīgam" },
  { id: "improv_story", title: "Stāsts pa vienam vārdam", category: "TEAM", videoFile: "izsaukums_improv_story.mp4", phrase: "tikai vienu vārdu" },
  { id: "bad_ad", title: "Trīs cilvēku reklāma", category: "TEAM", videoFile: "izsaukums_bad_ad.mp4", phrase: "tukšu glāzi" },
  { id: "three_in_five", title: "Trīs piecu sekunžu laikā", category: "FLASH", videoFile: "izsaukums_three_in_five.mp4", phrase: "darba intervijā" },
  { id: "reverse_story", title: "Stāsts atpakaļgaitā", category: "FLASH", videoFile: "izsaukums_reverse_story.mp4", phrase: "pēdējo teikumu" },
  { id: "wrong_answers", title: "Tikai nepareizas atbildes", category: "FLASH", videoFile: "izsaukums_wrong_answers.mp4", phrase: "Kas īstenībā ir MELNĀ KASTE" },
  { id: "gesture", title: "Bez viena vārda", category: "FLASH", videoFile: "izsaukums_gesture.mp4", phrase: "18. gadsimta" },
  { id: "look", title: "Nenopietnā runa", category: "FLASH", videoFile: "izsaukums_look.mp4", phrase: "pazūd zeķes" },
];

const missions = [
  "Panāc, lai kāds pats ierosina NHL spēli, viņam to tieši neprasot.",
  "Iegūsti cita dalībnieka piekrišanu kopīgam izaicinājumam.",
  "Panāc, lai kāds izsauc citu cilvēku uz šautriņu dueli.",
  "Panāc, lai kāds pastāsta smieklīgu atgadījumu, kuru pārējie nezina.",
  "Panāc, lai vēl kāds vienojas ar tevi par kopīgu aktivitāti.",
  "Panāc, lai kāds pastāsta savu pirmo iespaidu par citu dalībnieku.",
  "Pārliecini kādu izspēlēt draudzīgu revanšu.",
  "Panāc, lai kāds pats piedāvā uzspēlēt pokeru.",
  "Uzzini drauga iecienītāko filmu un mēģini pārliecināt viņu par savu favorītu.",
  "Panāc, lai kāds spontāni ierosina kopīgu fotogrāfiju.",
  "Sarunā, lai cits dalībnieks tevi atbalsta nākamajā duelī.",
  "Panāc, lai vismaz divi cilvēki izdomā jaunu sacensību noteikumus.",
  "Uzzini cita dalībnieka pārsteidzošu hobiju vai prasmi.",
  "Panāc, lai kāds piekrīt pārējiem iemācīt praktisku triku.",
  "Panāc, lai kāds nosauc vakara labāko šautriņu spēlētāju.",
  "Pārliecini kādu kļūt par nākamā dueļa tiesnesi.",
  "Panāc, lai kāds pasaka, kuram visvairāk uzticas komandu spēlē.",
  "Pārliecini kādu, ka tev ir īpaša vara, neparādot savu kartīti.",
  "Iegūsti divus dažādus praktiskus padomus no cita dalībnieka.",
  "Panāc, lai kāds pats ierosina kopīgu tostu ar jebkuru dzērienu.",
];

const perks = [
  { id: "perk_answer", title: "Atbilde pirms izvēles", summary: "Tiesības izvēlēties nākamā dueļa disciplīnu." },
  { id: "perk_untouchable", title: "Neaizskaramais", summary: "Vienu reizi atteikties no dueļa." },
  { id: "perk_rematch", title: "Revanša tiesības", summary: "Pieprasīt atkārtotu dueli pēc zaudējuma." },
  { id: "perk_bonus", title: "Bonusa mēģinājums", summary: "Pieprasīt vienu papildu mēģinājumu." },
  { id: "perk_time", title: "Laika meistars", summary: "Pieprasīt papildu trīs minūtes atbilstošā uzdevumā." },
  { id: "perk_veto", title: "Veto tiesības", summary: "Vienu reizi noraidīt papildu nosacījumu." },
];

const globals = [
  { id: "global_vote", title: "Klusā balsošana", summary: "Visi norāda uz iespējami labāko komandas kapteini." },
  { id: "global_duel", title: "Negaidītais duelis", summary: "Divi brīvprātīgie sacenšas šautriņu mešanā." },
  { id: "global_truths", title: "Divas patiesības", summary: "Izvēlētais spēlētājs nosauc divas patiesības un vienus melus." },
  { id: "global_team", title: "Pārsteiguma komanda", summary: "Dalībnieki sadalās komandās īsam izaicinājumam." },
  { id: "global_talent", title: "Nezināmais talants", summary: "Katrs nosauc pārējiem nezināmu prasmi." },
  { id: "global_rematch", title: "Revanša stunda", summary: "Iespējams pieprasīt revanšu iepriekšējā spēlē." },
];

describe("specifikācijas kartītes", () => {
  const cards = catalog();
  const byId = new Map(cards.map((card) => [card.id, card]));

  it("satur visus gatavos izaicinājumus ar savu video", () => {
    for (const spec of challenges) {
      const card = byId.get(spec.id);
      expect(card, spec.id).toMatchObject({
        title: spec.title,
        category: spec.category,
        videoFile: spec.videoFile,
        allowsDecline: true,
      });
      const text = `${card?.summary}\n${card?.rules.join("\n")}`;
      expect(text).toContain(spec.phrase);
    }
  });

  it("satur 20 slepenās misijas, sešas priekšrocības un sešus kopīgos notikumus", () => {
    missions.forEach((text, index) => {
      const card = byId.get(`mission_${String(index + 1).padStart(2, "0")}`);
      expect(card?.summary).toBe(text);
      expect(card?.category).toBe("MISSION");
      expect(card?.privacy).toBe("secret_mission");
      expect(card?.videoFile).toBe("izsaukums_mission.mp4");
    });
    for (const spec of perks) {
      expect(byId.get(spec.id)).toMatchObject({ ...spec, category: "PERK", privacy: "perk", videoFile: "izsaukums_perk.mp4" });
    }
    for (const spec of globals) {
      expect(byId.get(spec.id)).toMatchObject({
        ...spec,
        category: "GLOBAL",
        privacy: "public_event",
        videoFile: `izsaukums_${spec.id}.mp4`,
      });
    }
    expect(byId.get("choice")).toMatchObject({ title: "Brīvā izvēle", category: "CHOICE", videoFile: "izsaukums_choice.mp4" });
    expect(byId.get("duel")).toMatchObject({ title: "Brīvais duelis", category: "CHOICE", videoFile: "izsaukums_duel.mp4" });
    expect(cards.filter((card) => card.category === "MISSION")).toHaveLength(20);
    expect(cards.filter((card) => card.category === "PERK")).toHaveLength(6);
    expect(cards.filter((card) => card.category === "GLOBAL")).toHaveLength(6);
  });
});
