/* MELNĀ KASTE — online party game for any group size (2+). No accounts required. */
'use strict';
const app=document.querySelector('#app');
const TOKEN_KEY='mk_guest_ticket_v2';
const ADMIN_KEY='mk_admin_pin_v2';
const token=()=>localStorage.getItem(TOKEN_KEY)||'';
const adminPin=()=>sessionStorage.getItem(ADMIN_KEY)||'';
const TV_KEY='mk_tv_control_v5';
if(location.pathname==='/tv' && location.hash.startsWith('#key=')){
  const key=decodeURIComponent(location.hash.substring(5));
  sessionStorage.setItem(TV_KEY,key);history.replaceState(null,'','/tv');
}
const tvKey=()=>sessionStorage.getItem(TV_KEY)||'';
let current=null, adminData=null, guestData=null, refresh=null, lastId='';
const clean=(v)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
const urlPath=location.pathname;
const pathView=()=>urlPath.startsWith('/mission/')?'mission':urlPath==='/admin'?'admin':urlPath==='/admin/videos'?'videos':urlPath==='/tv'?'tv':urlPath==='/join'?'join':'home';
const name=(pid)=>current?.guests?.find(g=>g.id===pid)?.name||'Dalībnieks';
const countdown=(until)=>Math.max(0,Math.ceil((until-Date.now())/1000));
const mins=(secs)=>`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`;
const toast=(msg)=>{let t=document.querySelector('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500)};
async function req(endpoint,{method='GET',body=null,auth=''}={}){
  const h={'Accept':'application/json'};
  if(body!==null)h['Content-Type']='application/json';
  if(auth==='guest'&&token())h.Authorization='Bearer '+token();
  if(auth==='admin'&&adminPin())h['X-Admin-Key']=adminPin();
  let response;
  try{response=await fetch('/api/'+endpoint,{method,headers:h,body:body===null?null:JSON.stringify(body),cache:'no-store'});}catch(e){throw new Error('Nav savienojuma ar serveri.');}
  let data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(typeof data.detail==='string'?data.detail:'Pieprasījums neizdevās.');
  return data;
}
const brand=`<div class="brand"><span class="brandicon">✳</span><span>MELNĀ KASTE <span class="gold">// LIVE</span></span></div>`;
const header=(right='')=>`<header class="pagehead">${brand}${right}</header>`;
const qr=(type,id='')=>`<div class="qr ${type==='join'?'tvqr':''}"><img alt="${type==='join'?'Pievienošanās QR kods':'Slepenā uzdevuma QR kods'}" src="/api/qr/${type}?v=${encodeURIComponent(id)}"/></div>`;
const guestNames=(data)=>data.guests.map((g,i)=>`<div class="name"><span class="gold">${String(i+1).padStart(2,'0')}</span> &nbsp; ${clean(g.name)}</div>`).join('');
async function finishStinger(callId){
  try {
    await fetch('/api/tv/stinger-finished',{method:'POST',headers:{'Content-Type':'application/json','X-TV-Key':tvKey()},body:JSON.stringify({callId})});
  }catch(e){/* Fallback server timer will reveal QR. */}
}
function renderTv(){
  // Keep media playback stable across every state refresh.
  window.MKTV.render(current);
}

function home(){
 app.innerHTML=`<div class="shell">${header()}<div class="panel" style="max-width:850px;margin:12vh auto;padding:clamp(25px,6vw,65px)"><div class="kicker">GENTLEMEN'S NIGHT / ONLINE SPĒLE</div><h1 class="spaced">VISS SĀKAS<br><span class="gold">AR VIENU KODU.</span></h1><p class="muted big spaced">Viens kopīgs TV. Jebkurš dalībnieku skaits no diviem. Nezināmi uzdevumi. Reāli dueļi. Bez kontiem un instalēšanas.</p><div class="stack spaced"><a class="btn gold" href="/join">PIEVIENOTIES</a><a class="btn" href="/tv">TV EKRĀNS</a><a class="btn" href="/admin">ORGANIZATORAM</a></div></div></div>`;
}
function renderGuest(){
 const s=current;
 const room=(new URLSearchParams(location.search)).get('room')||s?.room||'';
 const joined=guestData&&guestData.room===s.room;
 app.innerHTML=`<div class="join-wrap">${header(`<a class="chip" href="/">SĀKUMS</a>`)}<section class="panel guesthead"><div class="kicker">KAHOOT TIPA PIEVIENOŠANĀS</div><h1>${joined?'TU ESI IEKŠĀ.':'IEŅEM SAVU VIETU.'}</h1><p class="muted spaced">Ne kontu, ne paroles. Tikai vārds šim vakaram.</p><div class="line"></div>${joined?`<h2 class="gold">${clean(guestData.name)}</h2><p class="muted spaced">${s.phase==='lobby'?'Gaidi, kad organizators sāks spēli.':'Kad TV parādās tavs vārds, noskenē QR kodu — tas atvērs atsevišķu uzdevuma lapu.'}</p><div class="spaced banner">TV rāda notikumus. Telefons vajadzīgs tikai slepenajiem uzdevumiem.</div>`:`<form id="joinForm"><label for="room">ISTABAS KODS</label><input class="field mono" id="room" name="room" maxlength="6" required autocomplete="off" value="${clean(room)}" placeholder="ABC123"><label for="nickname">TAVS VĀRDS</label><input class="field" id="nickname" name="nickname" maxlength="24" minlength="2" required autocomplete="nickname" placeholder="Piemēram, Mārcis"><button class="btn gold full spaced fullwidth" type="submit">PIEVIENOTIES SPĒLEI</button></form>`}</section><div class="footer">Pēc pievienošanās šis pārlūks atceras tavu dalību. Nekāds personīgais konts netiek veidots.</div></div>`;
 if(!joined)document.querySelector('#joinForm')?.addEventListener('submit',async(ev)=>{
   ev.preventDefault();const el=ev.currentTarget;
   try{let d=await req('join',{method:'POST',body:{room:el.room.value,name:el.nickname.value}});localStorage.setItem(TOKEN_KEY,d.token);guestData=await req('guest',{auth:'guest'});renderGuest();}catch(e){toast(e.message)}
 });
}
function renderAdmin(){
 if(!adminPin()){
   app.innerHTML=`<div class="join-wrap">${header()}<section class="panel"><div class="kicker">ORGANIZATORA VADĪBA</div><h1 class="spaced">PIEKĻUVE.</h1><p class="muted spaced">Ievadi servera <code>ADMIN_PIN</code>.</p><form id="adminLogin"><label>ORGANIZATORA PAROLE</label><input class="field" name="pin" type="password" required autocomplete="off"><button class="btn gold full spaced" type="submit">ATVĒRT VADĪBU</button></form></section></div>`;
   document.querySelector('#adminLogin')?.addEventListener('submit',async ev=>{ev.preventDefault();sessionStorage.setItem(ADMIN_KEY,ev.currentTarget.pin.value);try{adminData=await req('admin/state',{auth:'admin'});renderAdmin()}catch(e){sessionStorage.removeItem(ADMIN_KEY);toast(e.message)}});
   return;
 }
 if(!adminData)return;
 const s=adminData;
 let players=s.guests.map(p=>`<option value="${clean(p.id)}">${clean(p.name)}</option>`).join('');
 let adminEvents=s.events.filter(e=>e.kind==='mission').slice(0,12).map(e=>`<div class="admin-item"><span class="admin-label">${clean(e.status.toUpperCase())}</span><b>${clean(name(e.guestId))}</b> — ${clean(e.text)}${e.status==='pending'?`<div class="stack spaced"><button class="btn" data-act="mission" data-id="${clean(e.id)}" data-status="done">Apstiprināt</button><button class="btn danger" data-act="mission" data-id="${clean(e.id)}" data-status="failed">Noraidīt</button></div>`:''}</div>`).join('')||'<p class="muted">Pagaidām misiju nav.</p>';
 app.innerHTML=`<div class="shell">${header(`<div class="row"><span class="chip live">ORGANIZATORS</span><a class="btn ghost" href="/admin/videos">VIDEO BIBLIOTĒKA</a><a class="btn ghost" href="/tv#key=${encodeURIComponent(s.tvControlKey)}" target="_blank" rel="noopener">ATVĒRT TV ↗</a></div>`)}<div class="admin-main"><div class="col"><section class="panel"><div class="row between"><div><div class="kicker">SPĒLES VADĪBA</div><h2>ISTABA <span class="gold">${s.room}</span></h2></div><span class="chip">${s.guests.length} DALĪBNIEKI</span></div><p class="muted spaced">Statuss: ${s.phase==='lobby'?'Pievienošanās':s.phase==='live'?'Spēle aktīva':'Pabeigta'}${s.paused?' / Pauze':''}</p>${s.call?.status==='queued'?'<p class="banner spaced">Izsaukums sagatavots — TV to sāks tikai pēc standby video beigām.</p>':''}<div class="admin-actions spaced"><button class="btn gold" data-act="start" ${s.phase!=='lobby'?'disabled':''}>SĀKT SPĒLI</button><button class="btn" data-act="pause" ${s.phase!=='live'?'disabled':''}>${s.paused?'TURPINĀT':'PAUZE'}</button><button class="btn" data-act="global" ${s.phase!=='live'?'disabled':''}>KOPĪGS NOTIKUMS</button><button class="btn" data-act="clear-global" ${!s.globalEvent?'disabled':''}>AIZVĒRT NOTIKUMU</button></div></section><section class="panel"><div class="kicker">IZSAUKUMI</div><h2>UZ TV / QR</h2><p class="muted small spaced">Izsauc vienu dalībnieku. Uz TV 60 sekundes būs viņa vārds un QR.</p><div class="grid two"><div><label>DALĪBNIEKS</label><select id="callGuest" class="field"><option value="">Nejaušs</option>${players}</select></div><div><label>NOTIKUMA TIPS</label><select id="callType" class="field"><option value="">Nejaušs</option><option value="flash">Ātrais joks (bez ievades)</option><option value="pair">Divu spēlētāju izaicinājums</option><option value="team">Komandas izaicinājums</option><option value="mission">Slepenā misija</option><option value="perk">Priekšrocība</option><option value="choice">Brīvā izvēle (aktivitātes ievade)</option><option value="duel">Brīvs duelis (aktivitātes ievade)</option></select></div></div><button class="btn gold full spaced" data-act="call" ${s.phase!=='live'||s.paused?'disabled':''}>SAGATAVOT IZSAUKUMU</button><button class="btn ghost full spaced" data-act="skip-video" ${s.call?.status!=='stinger'?'disabled':''}>IZLAIST VIDEO UN RĀDĪT QR</button><button class="btn ghost full spaced" data-act="cancel-call" ${!s.call?'disabled':''}>ATCELT AKTĪVO QR</button><div class="quiet-tools spaced" aria-label="Ātrā režija"><span class="muted tiny">ĀTRĀ REŽIJA</span><div class="quickbuttons"><button class="quiet" data-act="rush" title="Uzreiz nākamais izsaukums; aktīvam QR saīsina gaidīšanu" aria-label="Paātrināt">⏩</button><button class="quiet" data-act="skip" title="Klusām izlaist aktīvo izsaukumu vai uzdevumu" aria-label="Izlaist uzdevumu">↷</button><button class="quiet" data-act="replace" title="Klusām nomainīt izvēlēto dalībnieku" aria-label="Nomainīt spēlētāju">⇄</button></div></div><p class="muted tiny">Taustiņi vadības ekrānā: N — paātrināt, S — izlaist, R — nomainīt.</p><div class="line"></div><form id="settings"><div class="row between"><label style="margin:0">AUTOMĀTISKIE IZSAUKUMI</label><input id="auto" type="checkbox" ${s.auto?'checked':''}></div><div class="grid two"><div><label>MINŪTES NO</label><input id="minInterval" class="field" type="number" min="2" max="90" value="${s.intervalMin}"></div><div><label>LĪDZ</label><input id="maxInterval" class="field" type="number" min="2" max="120" value="${s.intervalMax}"></div></div><button class="btn full spaced" type="submit">SAGLABĀT INTERVĀLU</button></form></section><section class="panel"><div class="kicker">SPĒLES DALĪBNIEKI</div><div class="tv-names">${guestNames(s)}</div></section></div><div class="col"><section class="panel"><div class="kicker">KOPĪGAIS NOTIKUMS</div>${s.globalEvent?`<h2 class="spaced">${clean(s.globalEvent.text)}</h2><p class="muted spaced">${s.globalEvent.participantIds?.length?s.globalEvent.participantIds.map(id=>clean(name(id))).join(', '):'Visi dalībnieki'}</p><button class="btn ghost spaced" data-act="clear-global">PABEIGT NOTIKUMU</button>`:'<p class="muted spaced">Nav aktīva kopīgā notikuma.</p>'}</section><section class="panel"><div class="kicker">AKTĪVAIS DUELIS</div>${s.duel?.status==='active'?`<h2 class="spaced">${clean(name(s.duel.challengerId))} <span class="gold">VS</span> ${clean(name(s.duel.opponentId))}</h2><p class="muted spaced">${clean(s.duel.activity||'Aktivitāte')} · Likmes tikai klātienē</p><div class="stack spaced"><button class="btn" data-act="duel-result" data-winner="${s.duel.challengerId}">UZVAR ${clean(name(s.duel.challengerId))}</button><button class="btn" data-act="duel-result" data-winner="${s.duel.opponentId}">UZVAR ${clean(name(s.duel.opponentId))}</button><button class="btn ghost" data-act="duel-result" data-winner="">NEIZŠĶIRTS</button></div>`:`<p class="muted spaced">Nav aktīva dueļa.</p>`}</section><section class="panel"><div class="kicker">MISIJU APSTIPRINĀŠANA</div><div class="spaced">${adminEvents}</div></section><section class="panel"><div class="kicker">NOTIKUMU ŽURNĀLS</div>${s.history.slice(0,16).map(e=>`<div class="admin-item"><span class="muted tiny">${new Date(e.at).toLocaleTimeString('lv-LV',{hour:'2-digit',minute:'2-digit'})}</span> &nbsp;${clean(e.text)}</div>`).join('')}</section><section class="panel"><div class="kicker">VAKARA BEIGAS</div><div class="stack spaced"><button class="btn" data-act="finish">PABEIGT SPĒLI</button><button class="btn danger" data-act="reset">JAUNA ISTABA / ATIESTATĪT</button></div></section></div></div></div>`;
 document.querySelector('#settings')?.addEventListener('submit',async e=>{e.preventDefault();await action('settings')});
 document.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.act,b.dataset)));
}
async function renderVideos(){
  if(!adminPin()){
    app.innerHTML=`<div class="join-wrap">${header()}<section class="panel"><div class="kicker">PRIVĀTA VIDEO BIBLIOTĒKA</div><h2>Piekļuve organizatoram</h2><form id="videoLogin"><label>ADMIN PAROLE</label><input class="field" type="password" name="pin" required autocomplete="off"><button class="btn gold full spaced">ATVĒRT</button></form></section></div>`;
    document.querySelector('#videoLogin').onsubmit=async e=>{e.preventDefault();sessionStorage.setItem(ADMIN_KEY,e.target.pin.value);await renderVideos()};
    return;
  }
  let data;
  try{data=await req('admin/videos',{auth:'admin'});}catch(e){sessionStorage.removeItem(ADMIN_KEY);toast(e.message);renderVideos();return}
  const options=data.options.map(o=>`<option value="${clean(o.id)}">${clean(o.label)}</option>`).join('');
  const standbyList=data.standbyVideos?.length?data.standbyVideos.map(v=>`<div class="admin-item"><b>${clean(v.name)}</b> · pieejams TV</div>`).join(''):'<p class="muted">Ievieto standby_01.mp4, standby_02.mp4 utt. mapē static/videos/</p>';
  const rows=data.videos.length?data.videos.map(v=>`<div class="video-item">${v.available?`<video preload="metadata" controls src="${clean(v.url)}" class="video-preview"></video>`:`<div class="video-preview" style="display:grid;place-items:center;background:#101114;color:#bba077;min-height:130px;text-align:center;padding:10px">GAIDA MP4 FAILU</div>`}<div class="video-info"><b>${clean(v.title)}</b><div class="muted small">${clean(data.options.find(o=>o.id===v.cardId)?.label||v.cardId)} · ${(v.sizeBytes/1024/1024).toFixed(1)} MB</div><div class="muted tiny">${v.available?'Pieejams TV':'Video vēl nav ievietots'} · ${v.source==='project'?`Ieliec GitHub: static/videos/${clean(v.filename)}`:'Augšupielādēts serverī'}</div>${v.source!=='project'?`<button class="btn danger" data-delete-video="${clean(v.id)}">DZĒST VIDEO</button>`:''}</div></div>`).join(''):'<p class="muted spaced">Video vēl nav. Pievieno savu pirmo AI izsaukuma klipu.</p>';
  app.innerHTML=`<div class="shell">${header('<a class="btn ghost" href="/admin">← REŽIJA</a>')}<section class="panel" style="max-width:1050px;margin:auto"><div class="kicker">MELNĀ KASTE / MEDIA</div><h1 class="video-title">VIDEO BIBLIOTĒKA</h1><p class="muted spaced">Augšupielādē īsus AI izsaukuma video, kuros sieviete nosauc kartītes nosaukumu. Tikai izsaukuma signāls — noteikumus rāda privātajā QR kartītē.</p><div class="video-layout spaced"><form id="uploadVideo" class="video-upload"><h3>PIEVIENOT VIDEO</h3><label>VIDEO NOSAUKUMS</label><input class="field" name="title" placeholder="Piemēram, Nepareizais eksperts" maxlength="100" required minlength="2"><label>PIESAISTĪT KARTĪTEI</label><select class="field" name="card_id">${options}</select><label>MP4 FAILS</label><input class="field" name="file" type="file" accept="video/mp4,.mp4" required><p class="muted tiny spaced">Ieteicams 1920×1080, 16:9, 5–15 sekundes, H.264 video + AAC audio. Faila limits: ${data.maxFileMB} MB.</p><button class="btn gold full spaced" type="submit">AUGŠUPIELĀDĒT UN SAGLABĀT</button><p id="uploadProgress" class="muted small spaced"></p></form><div><h3>MANI VIDEO <span class="gold">(${data.videos.length})</span></h3><div class="video-list spaced">${rows}</div></div></div><div class="line"></div><section class="panel"><h3>STANDBY / NEPĀRTRAUKTĀ VIDEO CILPA</h3><p class="muted">Klipi var būt dažādos garumos. Izsaukumi sākas tikai pēc VISA standby apļa, pirms atgriešanās pie standby_01.mp4. GitHub mapē pievieno standby_01.mp4, standby_02.mp4 utt.</p>${standbyList}</section><div class="line"></div><div class="banner"><b>KUR FAILI GLABĀJAS?</b><p>Servera mapē <code>static/videos/</code> (vai <code>VIDEO_DIR</code>, ja ir norādīts pastāvīgs disks). Bezmaksas servera lokālā krātuve var pazust restartējot. Pastāvīgai lietošanai saglabā arī oriģinālu sev un izvieto video uz noturīgas glabātuves.</p></div></section></div>`;
  document.querySelector('#uploadVideo').addEventListener('submit',async e=>{
    e.preventDefault();
    const el=e.currentTarget;
    const file=el.querySelector('[type=file]').files[0];
    if(!file){toast('Izvēlies MP4 failu');return}
    if(file.size>40*1024*1024){toast('Fails lielāks par 40 MB');return}
    const status=document.querySelector('#uploadProgress');status.textContent='Augšupielādē...';
    const b=el.querySelector('[type=submit]');b.disabled=true;
    try{
      const response=await fetch('/api/admin/videos',{method:'POST',headers:{'X-Admin-Key':adminPin()},body:new FormData(el)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.detail||'Neizdevās saglabāt');
      toast('Video saglabāts un piesaistīts!');await renderVideos();
    }catch(err){status.textContent=err.message;b.disabled=false}
  });
  document.querySelectorAll('[data-delete-video]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('Dzēst šo video no servera?'))return;
    try{const resp=await fetch('/api/admin/videos/'+encodeURIComponent(b.dataset.deleteVideo),{method:'DELETE',headers:{'X-Admin-Key':adminPin()}});if(!resp.ok)throw new Error('Dzēšana neizdevās');await renderVideos()}catch(e){toast(e.message)}
  }));
}

async function action(which,el={}){
 let body=null,endpoint='admin/'+which;
 if(which==='call')body={guestId:document.querySelector('#callGuest')?.value||null,kind:document.querySelector('#callType')?.value||null};
 if(which==='settings')body={auto:document.querySelector('#auto').checked,intervalMin:Number(document.querySelector('#minInterval').value),intervalMax:Number(document.querySelector('#maxInterval').value)};
 if(which==='mission')body={eventId:el.id,status:el.status};
 if(which==='duel-result')body={winnerId:el.winner||null};
 if(which==='reset'){
   if(!confirm('Visi dalībnieki un misijas tiks izdzēsti. Vai tiešām izveidot jaunu spēli?'))return;
   body={confirm:'RESET'};
 }
 if(which==='finish'&&!confirm('Vai pabeigt spēli?'))return;
 try{await req(endpoint,{method:'POST',body:body||{},auth:'admin'});current=await req('state');adminData=await req('admin/state',{auth:'admin'});renderAdmin();toast('Saglabāts.')}catch(e){toast(e.message)}
}
function renderSecret(event=null,error=''){
 const code=decodeURIComponent(urlPath.split('/').pop());
 const status=event?.status||'';
 const content=error?`<div class="alert">${clean(error)}</div><p class="muted spaced">Atver šo saiti tajā pašā tālruņa pārlūkā, kurā pievienojies spēlei. Ja izmanto citu pārlūku, atver reģistrācijas lapu un tad vēlreiz QR.</p>`:
 !event?`<div class="guest-status"><div class="bars"><span></span><span></span><span></span><span></span></div><p class="spaced">Pārbauda slepeno izsaukumu...</p></div>`:
 `<div class="kicker">PERSONĪGS NOTIKUMS / TIKAI TEV</div><div class="title spaced">${clean(event.title)}</div><div class="line"></div><p class="statement">${clean(event.text)}</p>${event.rules?.length?`<div class="card-rules"><div class="kicker">NOTEIKUMI</div><ol>${event.rules.map(r=>`<li>${clean(r)}</li>`).join('')}</ol></div>`:''}<p class="muted spaced">${clean(event.description)}</p><div class="line"></div>${status==='active'?secretForm(event):`<div class="banner">Statuss: ${status==='pending'?'Gaida organizatora apstiprinājumu':status==='done'?'Pabeigts':status==='failed'?'Neizdevās':'Laiks beidzies'}</div>`}`;
 app.innerHTML=`<div class="secret">${header(`<span class="chip">PRIVATE / QR</span>`)}<section class="panel">${content}</section><p class="footer">Šī ir atsevišķa uzdevuma lapa (jaunā pārlūka cilnē pēc QR skenēšanas). Pārējie ekrānā tās saturu neredz.</p></div>`;
 if(event&&status==='active')bindSecret(event);
}
function selectablePlayers(multi=false,excludeSelf=true){
 const players=(current?.guests||[]).filter(p=>!excludeSelf||p.id!==guestData?.id);
 if(multi){
   return `<div class="participant-list">${players.map(p=>`<label class="participant-row"><input type="checkbox" name="participantIds" value="${clean(p.id)}"><span>${clean(p.name)}</span></label>`).join('')}</div>`;
 }
 return `<select name="opponentId" class="field" required><option value="">Izvēlies spēlētāju</option>${players.map(p=>`<option value="${clean(p.id)}">${clean(p.name)}</option>`).join('')}</select>`;
}
function duelForm(){
 return `<form id="duelForm"><label>IZVĒLIES PRETINIEKU</label>${selectablePlayers(false)}<label>IERAKSTI AKTIVITĀTI</label><input name="activity" class="field" maxlength="100" minlength="2" placeholder="Piem., NHL 26, šautriņas 301..." required><button class="btn gold full spaced" type="submit">APSTIPRINĀT DUELI</button></form>`;
}
function activityForm(){
 return `<form id="activityForm"><label>IERAKSTI AKTIVITĀTI</label><input name="activity" class="field" maxlength="100" minlength="2" placeholder="Piem., mini golfs, šautriņu turnīrs..." required><label>IZVĒLIES DALĪBNIEKUS (1 VAI VAIRĀKUS)</label>${selectablePlayers(true)}<button class="btn gold full spaced" type="submit">NOSŪTĪT AKTIVITĀTI UZ TV</button></form>`;
}
function fixedCardForm(e){
  const others=(current?.guests||[]).filter(p=>p.id!==guestData?.id);
  const mode=e.selectMode||'none';
  const min=Math.min(e.minSelections||0,others.length);
  const max=Math.min(e.maxSelections||0,others.length);
  let select='';
  if(mode==='one')select=`<label>IZVĒLIES VIENU DALĪBNIEKU</label><select class="field" name="participantId" required><option value="">Izvēlies...</option>${others.map(p=>`<option value="${clean(p.id)}">${clean(p.name)}</option>`).join('')}</select>`;
  else if(mode==='many')select=`<label>IZVĒLIES ${min}–${max} CITUS DALĪBNIEKUS</label><div class="participant-list">${others.map(p=>`<label class="participant-row"><input type="checkbox" name="participantIds" value="${clean(p.id)}"><span>${clean(p.name)}</span></label>`).join('')}</div>`;
  return `<form id="fixedCardForm">${select}<button class="btn gold full spaced" type="submit">${mode==='none'?'ATKLĀT IZAICINĀJUMU UZ TV':'AKTIVIZĒT IZAICINĀJUMU'}</button></form>`;
}
function secretForm(e){
 if(['flash','pair','team'].includes(e.kind))return fixedCardForm(e);
 if(e.kind==='mission')return `<button class="btn gold full spaced" data-mission-action="done">MISIJU ESMU IZPILDĪJIS</button>`;
 if(e.kind==='perk')return `<div class="banner spaced">Saglabā šo lapu, kamēr izmanto priekšrocību.</div><button class="btn full spaced" data-mission-action="used">PRIEKŠROCĪBA IZMANTOTA</button>`;
 if(e.kind==='choice')return `<div class="kicker spaced">KO TU VĒLIES IZVEIDOT?</div><div class="grid two spaced"><button class="btn gold" data-choice-mode="duel">DUELIS</button><button class="btn" data-choice-mode="activity">AKTIVITĀTE</button></div><div id="choiceEditor" class="spaced">${duelForm()}</div>`;
 if(e.kind==='duel')return duelForm();
 return '';
}
function bindSecret(e){
 const nonce=decodeURIComponent(urlPath.split('/').pop());
 document.querySelector('#fixedCardForm')?.addEventListener('submit',async ev=>{
    ev.preventDefault();
    const fd=new FormData(ev.currentTarget);
    const ids=e.selectMode==='one'?[fd.get('participantId')].filter(Boolean):e.selectMode==='many'?fd.getAll('participantIds'):[];
    if(e.selectMode==='one'&&ids.length!==1){toast('Izvēlies vienu dalībnieku.');return}
    const max=Math.min(e.maxSelections||0,(current?.guests?.length||1)-1);
    const min=Math.min(e.minSelections||0,(current?.guests?.length||1)-1);
    if(e.selectMode==='many'&&(ids.length<min||ids.length>max)){toast(`Izvēlies ${min}–${max} dalībniekus.`);return}
    try{await req('card/activate',{method:'POST',auth:'guest',body:{nonce,participantIds:ids}});await loadSecret();toast('Izaicinājums redzams TV.')}catch(err){toast(err.message)}
 });
 document.querySelectorAll('[data-mission-action]').forEach(b=>b.addEventListener('click',async()=>{try{await req('mission/action',{method:'POST',auth:'guest',body:{nonce,action:b.dataset.missionAction}});await loadSecret();toast('Lēmums nosūtīts.')}catch(err){toast(err.message)}}));
 document.querySelectorAll('[data-choice-mode]').forEach(b=>b.addEventListener('click',()=>{
    const choice=b.dataset.choiceMode;
    const editor=document.querySelector('#choiceEditor');
    editor.innerHTML=choice==='duel'?duelForm():activityForm();
    document.querySelectorAll('[data-choice-mode]').forEach(item=>item.classList.toggle('gold',item===b));
    bindChoiceForms(nonce);
 }));
 bindChoiceForms(nonce);
}
function bindChoiceForms(nonce){
 const df=document.querySelector('#duelForm');
 if(df)df.addEventListener('submit',async ev=>{
  ev.preventDefault();
  const form=ev.currentTarget;
  const fd=new FormData(form);
  try{
   await req('duel',{method:'POST',auth:'guest',body:{nonce,opponentId:fd.get('opponentId'),activity:fd.get('activity')}});
   await loadSecret();toast('Duelis redzams TV.');
  }catch(err){toast(err.message)}
 });
 const af=document.querySelector('#activityForm');
 if(af)af.addEventListener('submit',async ev=>{
  ev.preventDefault();
  const fd=new FormData(ev.currentTarget);
  const participantIds=fd.getAll('participantIds');
  if(!participantIds.length){toast('Izvēlies vismaz vienu dalībnieku.');return}
  try{
   await req('activity',{method:'POST',auth:'guest',body:{nonce,activity:fd.get('activity'),participantIds}});
   await loadSecret();toast('Aktivitāte redzama TV.');
  }catch(err){toast(err.message)}
 });
}
async function loadSecret(){
 let nonce=decodeURIComponent(urlPath.split('/').pop());
 try{
  if(!token()){renderSecret(null,'Šajā pārlūkā nav atrasta tava dalībnieka sesija.');return;}
  let event;
  try{event=await req('mission/'+encodeURIComponent(nonce),{auth:'guest'});}catch(e){
    if(e.message.includes('nav atvērts')||e.message.includes('nav tavs'))event=await req('claim',{method:'POST',auth:'guest',body:{nonce}});
    else throw e;
  }
  renderSecret(event);
 }catch(e){renderSecret(null,e.message)}
}
async function refreshData(){
 try{
  current=await req('state');
  const view=pathView();
  if(view==='tv'){
    const signature=JSON.stringify([current.phase,current.paused,current.guests,current.call,current.duel,current.globalEvent,current.eventCount]);
    if(signature!==lastId){lastId=signature;renderTv();}
    if(document.querySelector('#callClock'))document.querySelector('#callClock').textContent=countdown(current.call.expiresAt);
  }
  else if(view==='join'){
    let fresh=null;
    if(token())fresh=await req('guest',{auth:'guest'}).catch(()=>null);
    if(JSON.stringify(fresh)!==JSON.stringify(guestData)||lastId!==current.phase){guestData=fresh;lastId=current.phase;renderGuest();}
  }
  else if(view==='admin'&&adminPin()){
    adminData=await req('admin/state',{auth:'admin'});
    let signature=JSON.stringify([adminData.phase,adminData.paused,adminData.guests,adminData.events,adminData.duel,adminData.call,adminData.globalEvent,adminData.history,adminData.auto,adminData.intervalMin,adminData.intervalMax]);
    if(signature!==lastId){lastId=signature;renderAdmin();}
  }
 }catch(e){if(!lastId){toast(e.message)} }
}
async function start(){
 const view=pathView();
 if(view==='home'){home();return;}
 if(view==='videos'){await renderVideos();return;}
 if(view==='mission'){
   current=await req('state').catch(()=>null);
   guestData=await req('guest',{auth:'guest'}).catch(()=>null);
   await loadSecret();return;
 }
 if(view==='join'){app.innerHTML=`<div class="join-wrap">${header()}<div class="panel guest-status">Savienojas ar spēli...</div></div>`;}
 if(view==='tv'){app.innerHTML=`<div class="shell">${header()}<div class="panel guest-status">Notiek pieslēgšanās...</div></div>`;}
 if(view==='admin'){renderAdmin();}
 await refreshData();
 if(view==='join'&&!document.querySelector('#joinForm')&&!guestData)renderGuest();
 refresh=setInterval(refreshData,2500);
}
document.addEventListener('keydown', e=>{
  if(pathView()!=='admin'||!adminPin()||e.altKey||e.ctrlKey||e.metaKey||e.repeat)return;
  if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  const key=e.key.toLowerCase();
  const map={n:'rush',s:'skip',r:'replace'};
  if(map[key]){e.preventDefault();action(map[key]);}
});
start().catch(e=>{app.textContent=e.message});