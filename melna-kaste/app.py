"""MELNĀ KASTE — online-first game for any group of at least two guests.
Guests have disposable session tickets, not accounts or personal profiles.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime
import io
import json
import os
from pathlib import Path
import random
import re
import secrets
import string
import time
from typing import Optional
from urllib.parse import quote
import uuid

from fastapi import FastAPI, Header, HTTPException, Request, UploadFile, File, Form
from fastapi.responses import FileResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, text
import qrcode
import qrcode.image.svg

ROOT = Path(__file__).resolve().parent
MIN_GUESTS = 2
DB_URL = os.environ.get("DATABASE_URL", "sqlite:///./melna_kaste.db")
if DB_URL.startswith("postgres://"):
    DB_URL = "postgresql+psycopg://" + DB_URL[len("postgres://"):]
elif DB_URL.startswith("postgresql://"):
    DB_URL = "postgresql+psycopg://" + DB_URL[len("postgresql://"):]
VIDEO_DIR = Path(os.environ.get('VIDEO_DIR', str(ROOT / 'static' / 'videos'))).resolve()
VIDEO_DIR.mkdir(parents=True, exist_ok=True)
STANDBY_NAME = re.compile(r"^standby_[0-9]{2,3}\.mp4$")
MAX_VIDEO_BYTES = 40 * 1024 * 1024  # 40 MiB; keep short announcement clips.
engine = create_engine(DB_URL, pool_pre_ping=True)
with engine.begin() as c:
    c.execute(text("CREATE TABLE IF NOT EXISTS mk_game (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)"))
    c.execute(text("""CREATE TABLE IF NOT EXISTS mk_videos (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, card_id TEXT NOT NULL,
      filename TEXT NOT NULL, size_bytes INTEGER NOT NULL, created_at BIGINT NOT NULL
    )"""))

def ms(): return int(time.time() * 1000)
def uid(prefix=""): return prefix + uuid.uuid4().hex[:15]
def room_code(): return "".join(secrets.choice("ABCDEFGHJKLMNPQRSTUVWXYZ23456789") for _ in range(6))

def new_game():
    return {
        "room": room_code(), "phase": "lobby", "paused": False,
        "auto": True, "intervalMin": 10, "intervalMax": 20,
        "nextAt": None, "guests": [], "call": None, "duel": None,
        "globalEvent": None, "events": [], "history": [], "usedMissionIds": [],
        "eventCount": 0, "lastCallGuestId": None, "usedCardIds": [], "usedVideoIds": [],
    }

with engine.begin() as c:
    saved = c.execute(text("SELECT payload FROM mk_game WHERE id = 1")).scalar_one_or_none()
state = json.loads(saved) if saved else new_game()

def persist():
    payload = json.dumps(state, ensure_ascii=False)
    with engine.begin() as c:
        result = c.execute(text("UPDATE mk_game SET payload=:p WHERE id=1"), {"p": payload})
        if result.rowcount == 0:
            c.execute(text("INSERT INTO mk_game (id,payload) VALUES (1,:p)"), {"p": payload})

if not saved: persist()
ADMIN_PIN = os.environ.get("ADMIN_PIN", "").strip()
if not ADMIN_PIN:
    ADMIN_PIN = secrets.token_urlsafe(15)
    print("\n*** MELNĀ KASTE ADMIN_PIN (set this ENV variable in production):", ADMIN_PIN, "***\n", flush=True)
TV_CONTROL_KEY = os.environ.get("TV_CONTROL_KEY", "") or secrets.token_urlsafe(26)
lock = asyncio.Lock()

MISSIONS = [
    "Panāc, lai cits dalībnieks pats ierosina NHL spēli, viņam to tieši neprasot.",
    "Iegūsti cita cilvēka piekrišanu vienam kopīgam izaicinājumam.",
    "Panāc, lai kāds izsauc citu cilvēku uz šautriņu dueli.",
    "Liec kādam pastāstīt smieklīgu, īstu atgadījumu, ko pārējie nezina.",
    "Panāc, lai vēl kāds vienojas ar tevi par nākamo kopīgo aktivitāti.",
    "Panāc, lai kāds izstāsta savu pirmo iespaidu par citu dalībnieku.",
    "Pārliecini kādu izspēlēt draudzīgu revanšu.",
    "Panāc, lai kāds pats piedāvā uzspēlēt pokeru.",
    "Uzzini viena drauga iecienītāko filmu un pamēģini pārliecināt viņu par savu favorītu.",
    "Panāc, lai kāds spontāni ierosina kopīgu foto.",
    "Sarunā, lai cits dalībnieks tevi atbalsta nākamajā duelī.",
    "Panāc, lai vismaz divi cilvēki kopīgi izdomā jaunas sacensības noteikumus.",
    "Uzzini no cita cilvēka vienu pārsteidzošu hobiju vai prasmi.",
    "Panāc, lai kāds piekrīt iemācīt pārējiem vienu praktisku triku.",
    "Panāc, lai kāds nosauc, kurš ir šī vakara labākais šautriņu spēlētājs.",
    "Pārliecini kādu uzņemties nākamā dueļa tiesneša lomu.",
    "Panāc, lai kāds publiski pasaka, kuram no klātesošajiem visvairāk uzticas komandu spēlē.",
    "Pārliecini vismaz vienu cilvēku, ka tev ir īpaša vara, neparādot savu ekrānu.",
    "Iegūsti divus dažādus praktiskus padomus no cita dalībnieka.",
    "Panāc, lai kāds pats ierosina kopīgu tostu (ar jebkuru dzērienu).",
]
PERKS = [
    ("ATBILDE PIRMS IZVĒLES", "Nākamā dueļa disciplīnu drīksti izvēlēties tu. Parādi šo priekšrocību organizatoram."),
    ("NEAIZSKARAMAIS", "Vienu reizi drīksti atteikties no izsaukuma uz dueli bez sekām."),
    ("REVANŠA TIESĪBAS", "Pēc nākamā zaudētā dueļa drīksti pieprasīt tūlītēju revanšu."),
    ("BONUSA MĒĢINĀJUMS", "Vienā nākamajā izaicinājumā tu drīksti pieprasīt vienu papildu mēģinājumu."),
    ("LAIKA MEISTARS", "Vienā nākamajā uzdevumā vari pieprasīt papildu 3 minūtes."),
    ("VETO TIESĪBAS", "Vienu reizi drīksti noraidīt organizatora piedāvātu papildu nosacījumu."),
]
GLOBAL_EVENTS = [
    ("KLUSĀ BALSOŠANA", "Visi vienlaikus norāda uz cilvēku, kurš šovakar būtu labākais komandas kapteinis."),
    ("NEGAIDĪTAIS DUELIS", "Divi brīvprātīgie sacenšas 3 šautriņu metienos. Likmes, ja vēlaties, sarunājiet klātienē."),
    ("DIVAS PATIESĪBAS", "Izvēlētais spēlētājs nosauc divus patiesus faktus un vienu izdomātu. Pārējie min."),
    ("PĀRSTEIGUMA KOMANDA", "Sadalieties divās komandās vienam īsam kolektīvam izaicinājumam. Ja skaits ir nepāra, viens ir tiesnesis."),
    ("NEZINĀMAIS TALANTS", "Katrs nosauc vienu prasmi, ko pārējie par viņu nezina. Balsojiet par negaidītāko."),
    ("REVANŠA STUNDA", "Kāds drīkst pieprasīt revanšu iepriekšējā spēlē. Pārējie izvēlas noteikumus."),
]

# The show is driven by clear, short, funny rule-based cards. Only the single
# "choice" card lets a guest type an activity name; other cards have fixed rules.
CARD_DECK = [
  {"id":"sales_pitch","kind":"pair","title":"PĀRDOD NEPĀRDODAMO","text":"Pārdod otram dalībniekam neredzamu, pilnīgi bezjēdzīgu produktu.","rules":["Tev ir 45 sekundes prezentācijai.","Pretinieks uzdod vienu ļoti nopietnu jautājumu.","Pārējie ar aplausiem nosaka, vai darījums būtu noticis."],"selectMode":"one","durationSeconds":45},
  {"id":"bad_lawyer","kind":"pair","title":"NEIESPĒJAMAIS ADVOKĀTS","text":"Aizstāvi apgalvojumu: 'Pēdējam picas gabalam jābūt valsts īpašumā.'","rules":["Izvēlētais cilvēks ir prokurors un var teikt tikai vienu pretargumentu.","Tev ir 30 sekundes aizstāvībai.","Pārējie nobalso, vai lieta uzvarēta."],"selectMode":"one","durationSeconds":30},
  {"id":"sports_cast","kind":"pair","title":"SPORTA KOMENTĒTĀJS","text":"Komentē otra cilvēka pilnīgi ikdienišķu darbību kā pasaules čempionāta finālu.","rules":["Pretinieks 20 sekundes dara kaut ko ikdienišķu, piemēram, lej ūdeni.","Tev jākomentē ar maksimālu dramatismu.","Ja visi smejas, izaicinājums ir izpildīts."],"selectMode":"one","durationSeconds":20},
  {"id":"truth_lie","kind":"pair","title":"DIVAS PATIESĪBAS UN VIENI MELI","text":"Pastāsti trīs īsus faktus par sevi. Viens ir izdomāts.","rules":["Izvēlētais spēlētājs uzdod tikai vienu precizējošu jautājumu.","Pēc tā viņš min melīgo apgalvojumu.","Atklāj pareizo atbildi visiem."],"selectMode":"one","durationSeconds":90},
  {"id":"mimic","kind":"pair","title":"MĒMĀ REKLĀMA","text":"Bez vārdiem parādi, kādu neeksistējošu ierīci gribi pārdot.","rules":["Nedrīkst runāt vai rakstīt.","Izvēlētajam spēlētājam 30 sekundēs jāatmin, ko pārdod.","Pēc tam atklāj produkta nosaukumu, ko pats biji izdomājis."],"selectMode":"one","durationSeconds":30},
  {"id":"absurd_duet","kind":"pair","title":"NEPAREIZAIS EKSPERTS","text":"Abiem jāizskaidro, kāpēc pirmdiena būtu jāaizliedz ar likumu.","rules":["Katram ir 20 sekundes savai teorijai.","Nedrīkst atkārtot otra argumentu.","Publika ar balsojumu izvēlas smieklīgāko teoriju."],"selectMode":"one","durationSeconds":60},
  {"id":"freeze_frame","kind":"pair","title":"DZĪVĀ SKULPTŪRA","text":"Izveido ar partneri statisku pozu tēmai: 'Pirmais rīts pēc vecpuišu balles'.","rules":["Pozas sagatavošanai ir 15 sekundes.","Abiem jāsastingst uz 10 sekundēm.","Pārējie izdomā skulptūrai nosaukumu."],"selectMode":"one","durationSeconds":45},
  {"id":"dubious_team","kind":"team","title":"SLIKTĀKĀ BIZNESA IDEJA","text":"Kopā izdomājiet biznesu, kurā neviens saprātīgs cilvēks neinvestētu.","rules":["Jums ir 60 sekundes izdomāt nosaukumu un vienu solījumu.","Viens prezentē, pārējie ir investori.","Investori uzdod vienu jautājumu un balso."],"selectMode":"many","minSelections":2,"maxSelections":5,"durationSeconds":90},
  {"id":"committee","kind":"team","title":"ABSURDO LIKUMU KOMITEJA","text":"Izstrādājiet vienu jaunu, smieklīgu garāžas noteikumu.","rules":["Dalībniekiem ir 45 sekundes vienoties.","Noteikumam jābūt nekaitīgam un izpildāmam.","Pārējie balso, vai tas 10 minūtes būs spēkā."],"selectMode":"many","minSelections":2,"maxSelections":4,"durationSeconds":60},
  {"id":"improv_story","kind":"team","title":"STĀSTS PA VIENAM VĀRDAM","text":"Izveidojiet stāstu, katram pamīšus pasakot tikai vienu vārdu.","rules":["Runā viens pēc otra tajā pašā secībā.","Katrs drīkst teikt tikai vienu vārdu vienā gājienā.","Pēc 60 sekundēm kāds nosauc stāstam virsrakstu."],"selectMode":"many","minSelections":2,"maxSelections":8,"durationSeconds":60},
  {"id":"bad_ad","kind":"team","title":"TRĪS CILVĒKU REKLĀMA","text":"Reklamējiet tukšu glāzi kā gada revolucionārāko izgudrojumu.","rules":["Katram reklāmā jāpasaka vismaz viens teikums.","Kopējais reklāmas ilgums nedrīkst pārsniegt 45 sekundes.","Publika izvēlas labāko reklāmas saukli."],"selectMode":"many","minSelections":2,"maxSelections":4,"durationSeconds":45},
  {"id":"three_in_five","kind":"flash","title":"TRĪS PIECU SEKUNŽU LAIKĀ","text":"Nosauc trīs lietas, kuras nekad nevajadzētu teikt darba intervijā.","rules":["Tev ir piecas sekundes no organizatora signāla.","Trīs atbildes nedrīkst atkārtoties.","Ja neizdodas, cits cilvēks drīkst mēģināt."],"selectMode":"none","durationSeconds":5},
  {"id":"reverse_story","kind":"flash","title":"STĀSTS ATPAKAĻGAITĀ","text":"Izstāsti smieklīgu notikumu, sākot ar pēdējo teikumu.","rules":["Pirmais teikums ir notikuma beigas.","Nākamajos 30 sekundēs paskaidro, kā līdz tam nonāca.","Pārējie izvēlas smieklīgāko versiju."],"selectMode":"none","durationSeconds":30},
  {"id":"wrong_answers","kind":"flash","title":"TIKAI NEPAREIZAS ATBILDES","text":"Kas īstenībā ir melnā kaste?","rules":["30 sekunžu laikā dod iespējami smieklīgu, acīmredzami nepareizu atbildi.","Nedrīkst izmantot pareizo skaidrojumu.","Publika nosauc absurdāko versiju."],"selectMode":"none","durationSeconds":30},
  {"id":"gesture","kind":"flash","title":"BEZ VIENA VĀRDA","text":"Ar žestiem parādi, kā tu izskaidrotu internetu cilvēkam no 18. gadsimta.","rules":["Nedrīkst runāt, dziedāt vai rakstīt.","Tev ir 30 sekundes.","Pirmais, kurš atmin, saņem tiesības izvēlēties nākamo dziesmu."],"selectMode":"none","durationSeconds":30},
  {"id":"look","kind":"flash","title":"NENOPIETNĀ RUNA","text":"30 sekundes ļoti nopietnā tonī izskaidro, kāpēc zeķes pazūd veļasmašīnā.","rules":["Nedrīkst pasmieties par savu stāstu.","Citi drīkst skatīties, bet nedrīkst traucēt.","Ja iztur 30 sekundes, publika aplaudē."],"selectMode":"none","durationSeconds":30}
]
CARD_BY_ID = {card["id"]:card for card in CARD_DECK}
CARD_KINDS = ("flash", "pair", "team")

def choose_card(kind):
    previous = state.setdefault("usedCardIds", [])
    available = [c for c in CARD_DECK if c["kind"] == kind and c["id"] not in previous]
    if not available:
        previous[:] = [id for id in previous if CARD_BY_ID.get(id,{}).get("kind") != kind]
        available = [c for c in CARD_DECK if c["kind"] == kind]
    card=random.choice(available)
    previous.append(card["id"])
    return card


def bundled_videos():
    # Source-controlled alternative for zero-cost hosts with temporary disks.
    manifest=ROOT/'static'/'video_manifest.json'
    try:
        items=json.loads(manifest.read_text(encoding='utf-8')).get('videos',[])
    except (FileNotFoundError,ValueError,AttributeError):
        return []
    output=[]
    for it in items:
        if not isinstance(it,dict): continue
        filename=it.get('file','')
        vid=it.get('id','')
        if not isinstance(filename,str) or not isinstance(vid,str): continue
        if Path(filename).name!=filename or not filename.lower().endswith('.mp4') or not vid.startswith('bundle_'):continue
        filepath=ROOT/'static'/'videos'/filename
        if not filepath.resolve().is_relative_to((ROOT/'static'/'videos').resolve()):continue
        output.append({'id':vid,'title':str(it.get('title','Video'))[:100], 'cardId':str(it.get('cardId','any')),
            'url':'/media/video/'+vid, 'sizeBytes':filepath.stat().st_size if filepath.is_file() else 0,
            'createdAt':0,'available':filepath.is_file(),'source':'project','filepath':filepath,'filename':filename})
    return output

def video_records():
    with engine.connect() as c:
        rows=c.execute(text("SELECT id,title,card_id,filename,size_bytes,created_at FROM mk_videos ORDER BY created_at DESC")).mappings().all()
    records=[{"id":r["id"],"title":r["title"],"cardId":r["card_id"],"url":"/media/video/"+r["id"],"sizeBytes":r["size_bytes"],"createdAt":r["created_at"],"available":(VIDEO_DIR/r["filename"]).is_file(),"source":"upload"} for r in rows]
    return records+[{k:v for k,v in r.items() if k!='filepath'} for r in bundled_videos()]

def standby_video_records():
    """Available background videos, in filename order, plus uploads."""
    folder=ROOT/'static'/'videos'
    ordered=sorted((p for p in folder.glob('standby_*.mp4') if STANDBY_NAME.fullmatch(p.name)),key=lambda p:p.name)
    result=[{'id':p.stem,'url':'/media/standby/'+p.name,'name':p.name,'available':True} for p in ordered]
    with engine.connect() as conn:
        rows=conn.execute(text("SELECT id,filename,title FROM mk_videos WHERE card_id='standby' ORDER BY created_at ASC")).mappings().all()
    result += [{'id':r['id'],'url':'/media/video/'+r['id'],'name':r['title'],'available':True} for r in rows if (VIDEO_DIR/r['filename']).is_file()]
    return result

def pick_video(card_id, kind):
    vids=[v for v in video_records() if v["available"]]
    for k in (card_id,kind,'any'):
        matches=[v for v in vids if v["cardId"]==k]
        if matches:
            recent=state.setdefault('usedVideoIds',[])
            eligible=[v for v in matches if v["id"] not in recent] or matches
            v=random.choice(eligible)
            recent.append(v["id"])
            state['usedVideoIds']=recent[-8:]
            return v["id"]
    return None

def show_qr_after_stinger(call):
    if call and call.get('status')=='stinger':
        call['status']='waiting'
        call['expiresAt']=ms()+60_000
        call.pop('stingerDeadline',None)
        persist()
        return True
    return False

DISCIPLINES = ["Šautriņas", "NHL", "Pokers", "Rulete", "Galda izaicinājums", "Brīvā izvēle"]

def note(s):
    state["history"].insert(0, {"at": ms(), "text": s})
    state["history"] = state["history"][:60]

def guest(pid):
    return next((p for p in state["guests"] if p["id"] == pid), None)

def guest_auth(authorization: Optional[str]):
    token = (authorization or "").removeprefix("Bearer ")
    if not token: raise HTTPException(401, "Pievienojies spēlei, ievadot savu vārdu.")
    for p in state["guests"]:
        if secrets.compare_digest(p["token"], token): return p
    raise HTTPException(401, "Dalībnieka sesija nav derīga.")

def admin_auth(pin: Optional[str]):
    if not pin or not secrets.compare_digest(pin, ADMIN_PIN):
        raise HTTPException(401, "Nepareiza organizatora parole.")

def schedule():
    if state["phase"] == "live" and not state["paused"] and state["auto"] and not state["globalEvent"]:
        state["nextAt"] = ms() + random.randint(state["intervalMin"]*60_000, state["intervalMax"]*60_000)
    else: state["nextAt"] = None

def current_public(request: Request):
    call = state["call"]
    duel = state["duel"]
    host = os.environ.get("PUBLIC_URL", "").rstrip("/") or str(request.base_url).rstrip("/")
    return {
        "room": state["room"], "phase": state["phase"], "paused": state["paused"],
        "nextAt": state["nextAt"], "auto": state["auto"], "standbyVideos":standby_video_records(),
        "intervalMin": state["intervalMin"], "intervalMax": state["intervalMax"],
        "minGuests": MIN_GUESTS, "baseUrl": host, "eventCount": state["eventCount"],
        "guests": [{"id":p["id"], "name":p["name"], "calls":p["calls"]} for p in state["guests"]],
        "call": None if not call else {k:call.get(k) for k in ("id","guestId","status","createdAt","expiresAt","videoId")},
        "duel": None if not duel else {k:duel.get(k) for k in ("id","challengerId","opponentId","activity","status","winnerId")},
        "globalEvent": state["globalEvent"],
    }

def admin_view(request):
    out = current_public(request)
    out["history"] = state["history"][:40]
    out["events"] = [{"id":e["id"], "guestId":e["guestId"], "kind":e["kind"],
                       "text":e["text"], "status":e["status"], "createdAt":e["createdAt"]} for e in state["events"][-35:][::-1]]
    out["activeCallKind"] = state["call"]["kind"] if state["call"] else None
    out["activeCardTitle"] = state["call"].get("cardTitle") if state["call"] else None
    out["tvControlKey"] = TV_CONTROL_KEY
    return out

def make_call(guest_id=None, kind=None):
    if state["phase"] != "live" or state["paused"]:
        raise HTTPException(409, "Sāc spēli un izslēdz pauzi.")
    if state["call"] or state["globalEvent"] or (state["duel"] and state["duel"]["status"] == "active"):
        raise HTTPException(409, "Vispirms pabeidz aktuālo izsaukumu, dueli vai kopīgo notikumu.")
    if not state["guests"]:
        raise HTTPException(409, "Vispirms pievieno dalībniekus.")
    if guest_id:
        p=guest(guest_id)
        if not p: raise HTTPException(404, "Dalībnieks nav atrasts.")
    else:
        minimum=min(p["calls"] for p in state["guests"])
        p=random.choice([p for p in state["guests"] if p["calls"]==minimum])
    if kind not in ("mission", "perk", "duel", "choice", "flash", "pair", "team"):
        kind=random.choices(["mission", "perk", "choice", "flash", "pair", "team"],weights=[18,10,9,25,22,16])[0]
    # Choose the card before the video so the actress can name the actual task.
    card=choose_card(kind) if kind in CARD_KINDS else None
    card_id=card["id"] if card else kind
    card_title=card["title"] if card else {"mission":"SLEPENĀ MISIJA","perk":"PRIEKŠROCĪBA","duel":"BRĪVAIS DUELIS","choice":"BRĪVĀ IZVĒLE"}.get(kind,kind)
    video_id=pick_video(card_id,kind)
    nonce=secrets.token_urlsafe(23)
    call={"id":uid("call_"),"guestId":p["id"],"kind":kind,"nonce":nonce,
          "cardId":card_id,"cardTitle":card_title,"videoId":video_id,
          "status":"queued" if standby_video_records() else ("stinger" if video_id else "waiting"),"createdAt":ms(),
          "expiresAt":None if (video_id or standby_video_records()) else ms()+60_000,
          "stingerDeadline":ms()+180_000 if video_id and not standby_video_records() else None}
    state["call"]=call
    state["lastCallGuestId"]=p["id"]
    p["calls"]+=1
    state["eventCount"]+=1
    state["nextAt"]=None
    note(f"Izsaukts: {p['name']}")
    persist()
    return call

def quiet_skip():
    """Advance without publishing an obvious cancellation notice to the TV."""
    if state["call"]:
        old=state["call"]
        old_player=guest(old["guestId"])
        if old_player:
            old_player["calls"]=max(0, old_player["calls"]-1)
        state["call"]=None
        schedule()
        persist()
        return "call"
    for e in reversed(state["events"]):
        if e["status"] in ("active", "pending"):
            e["status"]="skipped"
            schedule()
            persist()
            return "task"
    if state["globalEvent"]:
        state["globalEvent"]=None
        schedule()
        persist()
        return "global"
    return None

def pick_alternative(previous_id: str | None = None):
    options=[p for p in state["guests"] if p["id"]!=previous_id]
    if not options: raise HTTPException(409,"Nepieciešami vismaz divi dalībnieki.")
    minimum=min(p["calls"] for p in options)
    return random.choice([p for p in options if p["calls"]==minimum])

def secret_event(p, call):
    kind=call["kind"]
    rules=[]
    card=None
    if kind in CARD_KINDS:
        card=CARD_BY_ID[call["cardId"]]
        title=card["title"]
        body=card["text"]
        rules=card["rules"]
        desc=("Šī kartīte jau satur aktivitāti un noteikumus. "
              "Izvēlies dalībniekus, ja tas ir prasīts, tad aktivizē notikumu.")
        expiry=ms()+10*60_000
    elif kind=="mission":
        possible=[x for i,x in enumerate(MISSIONS) if i not in state["usedMissionIds"]]
        if not possible: state["usedMissionIds"]=[];possible=MISSIONS
        body=random.choice(possible)
        state["usedMissionIds"].append(MISSIONS.index(body))
        title="SLEPENĀ MISIJA"
        rules=["Nevienam nerādi šo kartīti un neatklāj savas misijas mērķi.",
               "Tev ir 30 minūtes no kartītes atvēršanas.",
               "Panākumu atzīmē pats; organizators pieņem gala lēmumu."]
        desc="Misija norit fonā — pārējie turpina ballīti."
        expiry=ms()+30*60_000
    elif kind=="perk":
        title,body=random.choice(PERKS)
        rules=["Šī priekšrocība ir izmantojama tikai vienu reizi.",
               "Parādi kartīti organizatoram brīdī, kad to vēlies izmantot.",
               "Pēc izmantošanas nospied 'Izmantota'."]
        desc="Priekšrocību var pietaupīt vēlākam vakara brīdim."
        expiry=None
    elif kind=="duel":
        title="BRĪVĀ IZAICINĀJUMA KARTĪTE"
        body="Izvēlies pretinieku un pats ieraksti aktivitāti."
        rules=["Izvēlies tikai vienu reģistrētu pretinieku.",
               "Aktivitāti un tās norisi apraksti īsi un saprotami.",
               "Likmes, ja tādas ir, notiek tikai klātienē."]
        desc="Tava izvēle tiks parādīta uz TV."
        expiry=ms()+5*60_000
    else:
        title="BRĪVĀS IZVĒLES KARTĪTE"
        body="Tikai šajā kartītē vari pats izdomāt un ierakstīt aktivitāti vai dueli."
        rules=["Izvēlies 'Duelis' vai 'Kopīga aktivitāte'.",
               "Ieraksti aktivitātes nosaukumu un izvēlies reģistrētos cilvēkus.",
               "Pārējiem ekrānā parādīsies tikai apstiprinātā izvēle."]
        desc="Šī ir viena no daudzajām kartītēm, nevis obligāta darbība katrā izsaukumā."
        expiry=ms()+5*60_000
    item={"id":uid("secret_"),"nonce":call["nonce"],"guestId":p["id"],"kind":kind,
          "title":title,"text":body,"description":desc,"rules":rules,"status":"active",
          "createdAt":ms(),"expiresAt":expiry}
    if card:
        item.update({"cardId":card["id"],"selectMode":card["selectMode"],
                     "minSelections":card.get("minSelections", 1 if card["selectMode"]!="none" else 0),
                     "maxSelections":card.get("maxSelections", 1 if card["selectMode"]=="one" else 0),
                     "durationSeconds":card["durationSeconds"]})
    state["events"].append(item)
    return item

def resolve_call():
    state["call"]=None
    schedule()
    persist()

async def ticker():
    while True:
        await asyncio.sleep(1.0)
        async with lock:
            if state["paused"]: continue
            changed=False
            call=state["call"]
            if call and call.get("status")=="stinger" and ms()>=call.get("stingerDeadline",0):
                show_qr_after_stinger(call); changed=True
            if call and call["status"]=="waiting" and ms()>=call["expiresAt"]:
                name=guest(call["guestId"])["name"]
                note(f"{name} neizmantoja QR kodu.")
                state["call"]=None; schedule(); changed=True
            for e in state["events"]:
                if e["status"]=="active" and e["expiresAt"] and ms()>=e["expiresAt"]:
                    e["status"]="expired"; changed=True
            if state["phase"]=="live" and state["nextAt"] and ms()>=state["nextAt"] and not state["call"] and not state["globalEvent"] and not (state["duel"] and state["duel"]["status"]=="active"):
                make_call(); changed=True
            if changed: persist()

@asynccontextmanager
async def lifespan(application):
    print("MELNĀ KASTE ready | /tv | /join | /admin",flush=True)
    t=asyncio.create_task(ticker())
    try: yield
    finally:
        t.cancel()
        try: await t
        except asyncio.CancelledError: pass

app=FastAPI(title="MELNĀ KASTE — WEB", version="4.0.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=ROOT/"static"),name="static")

@app.get("/healthz")
async def health(): return {"ok":True,"version":"6.0.0"}

@app.get("/")
@app.get("/join")
@app.get("/tv")
@app.get("/admin")
@app.get("/admin/videos")
@app.get("/mission/{nonce}")
async def spa(nonce: str=""):
    return FileResponse(ROOT/"static"/"index.html",headers={"Cache-Control":"no-store"})

@app.get("/media/standby/{filename}")
async def media_standby(filename:str):
    if not STANDBY_NAME.fullmatch(filename): raise HTTPException(404)
    path=ROOT/'static'/'videos'/filename
    if not path.is_file(): raise HTTPException(404)
    return FileResponse(path,media_type="video/mp4",headers={"Cache-Control":"public, max-age=3600"})

@app.get("/media/video/{video_id}")
async def media_video(video_id:str):
    if not video_id.isascii() or len(video_id)>40: raise HTTPException(404)
    with engine.connect() as c:
        row=c.execute(text("SELECT filename FROM mk_videos WHERE id=:id"),{"id":video_id}).mappings().first()
    if row:
        filepath=VIDEO_DIR/row["filename"]
    else:
        bundle=next((v for v in bundled_videos() if v['id']==video_id),None)
        if not bundle: raise HTTPException(404,"Video nav atrasts.")
        filepath=bundle['filepath']
    if not filepath.is_file(): raise HTTPException(404,"Video fails nav pieejams serverī.")
    return FileResponse(filepath,media_type="video/mp4",headers={"Cache-Control":"public, max-age=3600"})

@app.get("/api/admin/videos")
async def admin_videos(x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    options=[{"id":"any","label":"Visiem izsaukumiem"},{"id":"standby","label":"STANDBY / fona video cilpa"}]
    options += [{"id":k,"label":{"flash":"Ātrie izaicinājumi","pair":"Divu spēlētāju izaicinājumi","team":"Komandu izaicinājumi","mission":"Slepenās misijas","perk":"Priekšrocības","choice":"Brīvā izvēle","duel":"Brīvais duelis"}[k]} for k in ("flash","pair","team","mission","perk","choice","duel")]
    options += [{"id":c["id"],"label":c["title"]} for c in CARD_DECK]
    return {"videos":video_records(),"standbyVideos":standby_video_records(),"options":options,"maxFileMB":40}

@app.post("/api/admin/videos")
async def upload_video(title:str=Form(...),card_id:str=Form(...),file:UploadFile=File(...),x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    title=title.strip()[:100]
    if not 2<=len(title)<=100: raise HTTPException(400,"Nosaukumam jābūt 2–100 rakstzīmes garam.")
    allowed={"any","standby","flash","pair","team","mission","perk","choice","duel"}|set(CARD_BY_ID)
    if card_id not in allowed: raise HTTPException(400,"Nepareizs kartītes piesaistes ID.")
    if not (file.filename or '').lower().endswith('.mp4'): raise HTTPException(400,"Nepieciešams MP4 video fails.")
    video_id=uid("vid_")
    filename=video_id+".mp4"
    dest=VIDEO_DIR/filename
    size=0
    try:
        with open(dest,"xb") as out:
            head=await file.read(12)
            if len(head)<12 or head[4:8]!=b'ftyp':
                raise HTTPException(400,"Fails nav derīgs MP4.")
            out.write(head); size=len(head)
            while chunk:=await file.read(1024*1024):
                size+=len(chunk)
                if size>MAX_VIDEO_BYTES: raise HTTPException(413,"Video pārsniedz 40 MB limitu.")
                out.write(chunk)
        with engine.begin() as c:
            c.execute(text("INSERT INTO mk_videos (id,title,card_id,filename,size_bytes,created_at) VALUES (:id,:title,:card_id,:filename,:size,:created_at)"),
                {"id":video_id,"title":title,"card_id":card_id,"filename":filename,"size":size,"created_at":ms()})
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    finally:
        await file.close()
    return {"id":video_id,"title":title,"cardId":card_id,"url":"/media/video/"+video_id,"sizeBytes":size,"available":True}

@app.delete("/api/admin/videos/{video_id}")
async def delete_video(video_id:str,x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    with engine.begin() as c:
        row=c.execute(text("SELECT filename FROM mk_videos WHERE id=:id"),{"id":video_id}).mappings().first()
        if not row: raise HTTPException(404,"Video nav atrasts.")
        c.execute(text("DELETE FROM mk_videos WHERE id=:id"),{"id":video_id})
    (VIDEO_DIR/row["filename"]).unlink(missing_ok=True)
    return {"ok":True}

class VideoComplete(BaseModel):
    callId: str

@app.post("/api/tv/standby-finished")
async def standby_finished(x_tv_key:Optional[str]=Header(None)):
    """Calls become visible only when the TV reports standby video completion."""
    if not x_tv_key or not secrets.compare_digest(x_tv_key,TV_CONTROL_KEY):
        raise HTTPException(401,"TV nav autorizēts. Atver to no režijas paneļa.")
    async with lock:
        call=state.get('call')
        if state['phase']!='live' or state['paused'] or not call or call.get('status')!='queued':
            return {'action':'continue'}
        if call['videoId']:
            call['status']='stinger'
            call['stingerDeadline']=ms()+180_000
        else:
            call['status']='waiting'
            call['expiresAt']=ms()+60_000
        persist()
        return {'action':'call','callId':call['id'],'status':call['status']}

@app.post("/api/tv/stinger-finished")
async def stinger_finished(body:VideoComplete,x_tv_key:Optional[str]=Header(None)):
    # Only the private organizer-generated TV link can finish video playback.
    if not x_tv_key or not secrets.compare_digest(x_tv_key,TV_CONTROL_KEY):
        raise HTTPException(401,"TV nav autorizēts. Atver to no režijas paneļa.")
    async with lock:
        call=state.get("call")
        if not call or call["id"]!=body.callId: raise HTTPException(409,"Aktīvais izsaukums ir mainījies.")
        return {"ok":show_qr_after_stinger(call)}

@app.post("/api/admin/skip-video")
async def skip_video(x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    async with lock:
        if not show_qr_after_stinger(state.get("call")): raise HTTPException(409,"Nav aktīva video izsaukuma.")
        return {"ok":True}

@app.get("/api/state")
async def get_state(request:Request):
    async with lock: return current_public(request)

@app.get("/api/guest")
async def get_guest(authorization:Optional[str]=Header(None)):
    async with lock:
        p=guest_auth(authorization)
        return {"id":p["id"],"name":p["name"],"room":state["room"], "activeEvents":len([e for e in state["events"] if e["guestId"]==p["id"] and e["status"]=="active"])}

class JoinData(BaseModel):
    room: str
    name: str=Field(min_length=2,max_length=24)

@app.post("/api/join")
async def join(body:JoinData):
    async with lock:
        if body.room.strip().upper()!=state["room"]: raise HTTPException(404,"Nepareizs istabas kods.")
        if state["phase"]!="lobby": raise HTTPException(409,"Pievienošanās ir slēgta.")
        name=" ".join(body.name.split())
        if len(name)<2 or len(name)>24: raise HTTPException(400,"Ievadi vārdu (2–24 rakstzīmes).")
        if any(p["name"].casefold()==name.casefold() for p in state["guests"]): raise HTTPException(409,"Šāds vārds jau ir pievienots.")
        p={"id":uid("guest_"),"name":name,"token":secrets.token_urlsafe(32),"joinedAt":ms(),"calls":0}
        state["guests"].append(p)
        note(f"{name} pievienojās.")
        persist()
        return {"token":p["token"],"name":p["name"],"room":state["room"]}

@app.get("/api/qr/{kind}")
async def qr(kind:str,request:Request):
    async with lock:
        base=os.environ.get("PUBLIC_URL","").rstrip("/") or str(request.base_url).rstrip("/")
        if kind=="join": url=f"{base}/join?room={quote(state['room'])}"
        elif kind=="call" and state["call"] and state["call"]["status"]=="waiting":
            url=f"{base}/mission/{quote(state['call']['nonce'])}"
        else: raise HTTPException(404,"QR kods nav pieejams.")
        img=qrcode.make(url,image_factory=qrcode.image.svg.SvgPathImage,box_size=10,border=2)
        b=io.BytesIO();img.save(b)
        return Response(b.getvalue(),media_type="image/svg+xml",headers={"Cache-Control":"no-store"})

class ClaimData(BaseModel):
    nonce: str

@app.post("/api/claim")
async def claim(body:ClaimData,authorization:Optional[str]=Header(None)):
    async with lock:
        p=guest_auth(authorization)
        existing=next((e for e in state["events"] if e["nonce"]==body.nonce and e["guestId"]==p["id"]),None)
        if existing: return existing
        call=state["call"]
        if not call or not secrets.compare_digest(call["nonce"],body.nonce): raise HTTPException(410,"Šis QR kods vairs nav aktīvs.")
        if call["guestId"]!=p["id"]: raise HTTPException(403,"Šis QR paredzēts citam dalībniekam.")
        if call["status"]!="waiting" or ms()>call["expiresAt"]: raise HTTPException(410,"QR laiks ir beidzies.")
        item=secret_event(p,call)
        note(f"{p['name']} atvēra slepenu notikumu.")
        resolve_call()
        return item

@app.get("/api/mission/{nonce}")
async def get_secret(nonce:str,authorization:Optional[str]=Header(None)):
    async with lock:
        p=guest_auth(authorization)
        e=next((e for e in state["events"] if e["nonce"]==nonce and e["guestId"]==p["id"]),None)
        if not e: raise HTTPException(404,"Uzdevums nav atvērts vai nav tavs.")
        return e

class MissionAct(BaseModel):
    nonce: str
    action: str

@app.post("/api/mission/action")
async def secret_action(body:MissionAct,authorization:Optional[str]=Header(None)):
    async with lock:
        p=guest_auth(authorization)
        e=next((e for e in state["events"] if e["nonce"]==body.nonce and e["guestId"]==p["id"]),None)
        if not e: raise HTTPException(404,"Uzdevums nav atrasts.")
        if e["status"]!="active": raise HTTPException(409,"Notikums vairs nav aktīvs.")
        if e["expiresAt"] and ms()>e["expiresAt"]: raise HTTPException(410,"Notikuma laiks ir beidzies.")
        if e["kind"]=="mission" and body.action=="done": e["status"]="pending"; note("Kāda misija gaida apstiprināšanu.")
        elif e["kind"]=="perk" and body.action=="used": e["status"]="done"; note("Kāda priekšrocība ir izmantota.")
        else: raise HTTPException(400,"Šī darbība nav atļauta.")
        persist()
        return {"ok":True,"status":e["status"]}

class FixedCardData(BaseModel):
    nonce: str
    participantIds: list[str]=Field(default_factory=list)

@app.post("/api/card/activate")
async def activate_fixed_card(body:FixedCardData, authorization:Optional[str]=Header(None)):
    async with lock:
        p=guest_auth(authorization)
        e=next((e for e in state["events"] if e["nonce"]==body.nonce and e["guestId"]==p["id"]),None)
        if not e or e["kind"] not in CARD_KINDS or e["status"]!="active":
            raise HTTPException(409,"Tev nav aktīvas noteikumu kartītes.")
        if e["expiresAt"] and ms()>e["expiresAt"]:
            raise HTTPException(410,"Kartītes izvēles laiks ir beidzies.")
        ids=body.participantIds
        if len(ids)!=len(set(ids)) or p["id"] in ids or any(not guest(pid) for pid in ids):
            raise HTTPException(400,"Izvēlēti neatļauti vai atkārtoti dalībnieki.")
        mode=e["selectMode"]
        if mode=="none" and ids:
            raise HTTPException(400,"Šai kartītei citi dalībnieki nav jāizvēlas.")
        if mode=="one" and len(ids)!=1:
            raise HTTPException(400,"Izvēlies vienu citu dalībnieku.")
        if mode=="many" and not min(e["minSelections"],len(state["guests"])-1)<=len(ids)<=min(e["maxSelections"],len(state["guests"])-1):
            raise HTTPException(400,f"Izvēlies {e['minSelections']}–{e['maxSelections']} dalībniekus.")
        if state["globalEvent"]:
            raise HTTPException(409,"Vispirms jāpabeidz esošais kopīgais notikums.")
        if state["duel"] and state["duel"]["status"]=="active":
            raise HTTPException(409,"Vispirms jāpabeidz duelis.")
        state["globalEvent"]={"id":uid("global_"),"title":e["title"],
            "text":e["text"],"rules":e["rules"],"participantIds":[p["id"]]+ids,
            "durationSeconds":e["durationSeconds"]}
        e["status"]="done"
        note(f"Aktivizēta noteikumu kartīte: {e['title']}.")
        persist()
        return {"ok":True,"eventId":state["globalEvent"]["id"]}

class DuelData(BaseModel):
    nonce: str
    opponentId: str
    activity: str = Field(min_length=2, max_length=100)

@app.post("/api/duel")
async def create_duel(body:DuelData, authorization:Optional[str]=Header(None)):
    async with lock:
        p=guest_auth(authorization)
        e=next((e for e in state["events"] if e["nonce"]==body.nonce and e["guestId"]==p["id"]),None)
        if not e or e["kind"] not in ("duel", "choice") or e["status"]!="active":
            raise HTTPException(409,"Tev nav aktīvas dueļa izvēles tiesības.")
        if e["expiresAt"] and ms()>e["expiresAt"]: raise HTTPException(410,"Dueļa izvēles laiks beidzies.")
        if not guest(body.opponentId) or body.opponentId==p["id"]:
            raise HTTPException(400,"Izvēlies citu reģistrētu dalībnieku.")
        activity=" ".join(body.activity.split())
        if len(activity)<2 or len(activity)>100: raise HTTPException(400,"Ieraksti aktivitāti (2–100 rakstzīmes).")
        if state["duel"] and state["duel"]["status"]=="active":
            raise HTTPException(409,"Cits duelis jau notiek.")
        state["duel"]={"id":uid("duel_"),"challengerId":p["id"],"opponentId":body.opponentId,
                       "activity":activity,"status":"active","winnerId":None}
        e["status"]="done"
        note(f"{p['name']} izaicina {guest(body.opponentId)['name']} — {activity}.")
        persist()
        return {"ok":True,"duelId":state["duel"]["id"]}

class ActivityData(BaseModel):
    nonce: str
    activity: str = Field(min_length=2, max_length=100)
    participantIds: list[str] = Field(min_length=1)

@app.post("/api/activity")
async def create_activity(body:ActivityData, authorization:Optional[str]=Header(None)):
    async with lock:
        p=guest_auth(authorization)
        e=next((e for e in state["events"] if e["nonce"]==body.nonce and e["guestId"]==p["id"]),None)
        if not e or e["kind"]!="choice" or e["status"]!="active":
            raise HTTPException(409,"Tev nav aktīvas aktivitātes izvēles tiesības.")
        if e["expiresAt"] and ms()>e["expiresAt"]: raise HTTPException(410,"Izvēles laiks beidzies.")
        activity=" ".join(body.activity.split())
        if len(activity)<2 or len(activity)>100: raise HTTPException(400,"Ieraksti aktivitāti (2–100 rakstzīmes).")
        ids=list(dict.fromkeys(body.participantIds))
        if len(ids)!=len(body.participantIds): raise HTTPException(400,"Dalībnieki nedrīkst atkārtoties.")
        if p["id"] in ids: raise HTTPException(400,"Izvēlies citus dalībniekus; sevi pievienot nevar.")
        if any(not guest(pid) for pid in ids): raise HTTPException(400,"Izvēlēts nereģistrēts dalībnieks.")
        if state["globalEvent"]: raise HTTPException(409,"Vispirms pabeidz iepriekšējo globālo notikumu.")
        state["globalEvent"]={"id":uid("global_"),"title":"IZVĒLĒTA AKTIVITĀTE",
                              "text":activity, "participantIds":ids}
        e["status"]="done"
        note(f"Slepena izvēle aktivizēja aktivitāti: {activity}.")
        persist()
        return {"ok":True,"eventId":state["globalEvent"]["id"]}

@app.get("/api/admin/state")
async def admin_state(request:Request,x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    async with lock: return admin_view(request)

@app.post("/api/admin/start")
async def admin_start(x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    async with lock:
        if state["phase"]!="lobby" or len(state["guests"])<MIN_GUESTS: raise HTTPException(409,"Spēles sākšanai jāpievienojas vismaz diviem dalībniekiem.")
        state["phase"]="live";note("MELNĀ KASTE ir aktivizēta."); schedule();persist()
        return {"ok":True}

@app.post("/api/admin/pause")
async def admin_pause(x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    async with lock:
        if state["phase"]!="live": raise HTTPException(409,"Spēle nav sākusies.")
        state["paused"]=not state["paused"]
        # Pausing cancels pending invitation; already claimed secrets remain readable.
        if state["paused"]:
            state["call"]=None;state["nextAt"]=None
        else: schedule()
        persist();return {"paused":state["paused"]}

class AdminCallData(BaseModel):
    guestId:Optional[str]=None
    kind:Optional[str]=None

@app.post("/api/admin/call")
async def admin_call(body:AdminCallData,x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    async with lock: return make_call(body.guestId,body.kind)

@app.post("/api/admin/rush")
async def admin_rush(x_admin_key:Optional[str]=Header(None)):
    """Quiet quick next / shorten an unanswered QR to five seconds."""
    admin_auth(x_admin_key)
    async with lock:
        if state["phase"]!="live" or state["paused"]:
            raise HTTPException(409,"Spēlei jābūt aktīvai.")
        if state["call"]:
            if state["call"].get("status") in ("queued", "stinger"):
                return {"ok":True,"mode":"queued_until_video_ends"}
            state["call"]["expiresAt"]=min(state["call"]["expiresAt"], ms()+5_000)
            persist()
            return {"ok":True,"mode":"shortened"}
        if state["duel"] and state["duel"]["status"]=="active":
            raise HTTPException(409,"Vispirms pabeidz aktīvo dueli.")
        if state["globalEvent"]: raise HTTPException(409,"Vispirms pabeidz kopīgo notikumu.")
        make_call()
        return {"ok":True,"mode":"new_call"}

@app.post("/api/admin/skip")
async def admin_skip(x_admin_key:Optional[str]=Header(None)):
    """Backstage skip. No prominent public cancellation message."""
    admin_auth(x_admin_key)
    async with lock:
        kind=quiet_skip()
        if not kind:
            raise HTTPException(409,"Nav aktīva izsaukuma vai uzdevuma.")
        return {"ok":True,"skipped":kind}

@app.post("/api/admin/replace")
async def admin_replace(x_admin_key:Optional[str]=Header(None)):
    """Backstage redraw player while retaining current secret-event type."""
    admin_auth(x_admin_key)
    async with lock:
        if state["phase"]!="live" or state["paused"]:
            raise HTTPException(409,"Spēlei jābūt aktīvai.")
        if state["duel"] and state["duel"]["status"]=="active":
            raise HTTPException(409,"Vispirms pabeidz aktīvo dueli.")
        previous=None
        kind=None
        if state["call"]:
            old=state["call"]
            previous=old["guestId"]
            kind=old["kind"]
            previous_guest=guest(previous)
            if previous_guest: previous_guest["calls"]=max(0,previous_guest["calls"]-1)
            state["call"]=None
        else:
            previous=state.get("lastCallGuestId")
            for event in reversed(state["events"]):
                if event["status"]=="active":
                    previous=event["guestId"]
                    kind=event["kind"]
                    event["status"]="skipped"
                    break
        selected=pick_alternative(previous)
        call=make_call(selected["id"],kind)
        return {"ok":True,"guestId":selected["id"],"callId":call["id"]}

class AdminSettingsData(BaseModel):
    auto: bool=True
    intervalMin: int=Field(ge=2,le=90)
    intervalMax: int=Field(ge=2,le=120)

@app.post("/api/admin/settings")
async def admin_settings(body:AdminSettingsData,x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    if body.intervalMin>body.intervalMax: raise HTTPException(400,"Minimums nedrīkst pārsniegt maksimumu.")
    async with lock:
        state["auto"]=body.auto;state["intervalMin"]=body.intervalMin;state["intervalMax"]=body.intervalMax
        schedule();persist();return {"ok":True}

@app.post("/api/admin/cancel-call")
async def cancel_call(x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    async with lock:
        state["call"]=None;schedule();persist();return {"ok":True}

class AdminEventData(BaseModel):
    eventId:str
    status:str

@app.post("/api/admin/mission")
async def admin_mission(body:AdminEventData,x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    async with lock:
        e=next((e for e in state["events"] if e["id"]==body.eventId),None)
        if not e or e["kind"]!="mission" or e["status"]!="pending": raise HTTPException(409,"Nav apstiprināmas misijas.")
        if body.status not in ("done","failed"): raise HTTPException(400,"Nepareizs statuss.")
        e["status"]=body.status;note(f"Misija ir {'apstiprināta' if body.status=='done' else 'noraidīta'}.")
        persist();return {"ok":True}

@app.post("/api/admin/clear-global")
async def admin_clear_global(x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    async with lock:
        if not state["globalEvent"]: raise HTTPException(409,"Nav aktīva kopīgā notikuma.")
        state["globalEvent"]=None
        note("Kopīgais notikums pabeigts.")
        schedule();persist()
        return {"ok":True}

class AdminResultData(BaseModel):
    winnerId:Optional[str]=None

@app.post("/api/admin/duel-result")
async def admin_duel_result(body:AdminResultData,x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    async with lock:
        d=state["duel"]
        if not d or d["status"]!="active": raise HTTPException(409,"Nav aktīva dueļa.")
        if body.winnerId and body.winnerId not in (d["challengerId"],d["opponentId"]): raise HTTPException(400,"Uzvarētājs nav šajā duelī.")
        d["status"]="finished";d["winnerId"]=body.winnerId
        note("Duelis pabeigts"+(f": uzvar {guest(body.winnerId)['name']}." if body.winnerId else " bez uzvarētāja."))
        schedule();persist();return {"ok":True}

@app.post("/api/admin/global")
async def admin_global(x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    async with lock:
        title,detail=random.choice(GLOBAL_EVENTS)
        state["globalEvent"]={"id":uid("global_"),"title":title,"text":detail,"rules":["Izpildiet uz TV redzamo norādi.","Organizators pabeidz notikumu, kad visi ir gatavi."]}
        note("Aktivizēts kopīgais notikums.");persist()
        return {"ok":True}

@app.post("/api/admin/finish")
async def finish(x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    async with lock:
        state["phase"]="finished";state["call"]=None;state["nextAt"]=None
        note("Spēle pabeigta. Slepenie notikumi atklāti!");persist();return {"ok":True}

class ResetData(BaseModel):
    confirm: str

@app.post("/api/admin/reset")
async def reset(body:ResetData,x_admin_key:Optional[str]=Header(None)):
    admin_auth(x_admin_key)
    if body.confirm!="RESET":raise HTTPException(400,"Apstiprini ar RESET.")
    async with lock:
        state.clear();state.update(new_game());persist();return {"ok":True}