/* MELNĀ KASTE V6 — uninterrupted standby reel, frame-boundary call handoff. */
'use strict';
window.MKTV=(function(){
  let host,screen,video,unlock,mode='none',mediaPath='',playlistIndex=0,busy=false;
  let lastCallId='',lastCallStatus='',audioEnabled=false;
  let playlist=[],nextPreload=null,stingerPreload=null;
  const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  function setup(){
    if(host&&host.isConnected)return;
    host=document.querySelector('#app');
    host.innerHTML='<main class="tv-full mk-show"><video id="mkShowVideo" class="mk-show-video" playsinline preload="auto" muted></video><div id="mkShowScreen" class="mk-show-screen"></div><button id="mkSound" class="mk-sound" type="button">IESLĒGT TV SKAŅU</button></main>';
    screen=host.querySelector('#mkShowScreen');video=host.querySelector('#mkShowVideo');unlock=host.querySelector('#mkSound');
    unlock.addEventListener('click',()=>{audioEnabled=true;video.muted=false;video.volume=1;video.play().then(()=>{unlock.hidden=true}).catch(()=>{audioEnabled=false;unlock.hidden=false})});
    video.addEventListener('ended',()=>{if(mode==='standby')onStandbyEnd();else if(mode==='stinger')onStingerEnd();});
    video.addEventListener('error',()=>{if(mode==='standby')onStandbyEnd();else if(mode==='stinger')onStingerEnd();});
  }
  function presentText(html,helpers){
    video.style.display='none';screen.style.display='flex';screen.innerHTML=`<div class="tv-scene"><div class="tv-composition">${html}</div></div>`;
    requestAnimationFrame(()=>{const scene=screen.querySelector('.tv-scene'),box=screen.querySelector('.tv-composition');if(!scene||!box)return;const f=Math.min(1,(scene.clientHeight-20)/Math.max(box.scrollHeight,1),(scene.clientWidth-20)/Math.max(box.scrollWidth,1));box.style.transform=`scale(${Math.max(.25,f)})`});
  }
  function enterMedia(which,path){
    if(!path)return;
    if(mode===which&&mediaPath===path&&video.style.display!=='none')return;
    mode=which;mediaPath=path;
    screen.style.display='none';video.style.display='block';
    // Reuse one video DOM element for the complete performance. No polling-driven video restarts.
    video.muted=which==='standby'?!audioEnabled:!audioEnabled;
    video.src=path;video.load();
    video.play().then(()=>{if(audioEnabled)unlock.hidden=true}).catch(()=>{if(audioEnabled){unlock.hidden=false;video.muted=true;video.play().catch(()=>{})}});
    preloadNext();
  }
  function preloadNext(){
    if(!playlist.length||mode!=='standby')return;
    if(!nextPreload)nextPreload=document.createElement('video');
    nextPreload.preload='auto';nextPreload.muted=true;
    const path=playlist[(playlistIndex+1)%playlist.length].url;
    if(nextPreload.getAttribute('src')!==path){nextPreload.src=path;nextPreload.load()}
  }
  async function onStandbyEnd(){
    if(busy)return;busy=true;
    try{
      const key=sessionStorage.getItem('mk_tv_control_v5')||'';
      if(key){
        const response=await fetch('/api/tv/standby-finished',{method:'POST',headers:{'X-TV-Key':key}});
        if(response.ok){const result=await response.json();if(result.action==='call'){
          const r=await fetch('/api/state',{cache:'no-store'});if(r.ok){const fresh=await r.json();window.MKTV.render(fresh);busy=false;return;}
        }}
      }
    }catch(e){/* Network outages never reveal a call mid-video. */}
    playlistIndex=(playlistIndex+1)%Math.max(1,playlist.length);
    if(playlist.length){mediaPath='';enterMedia('standby',playlist[playlistIndex].url)}
    busy=false;
  }
  async function onStingerEnd(){
    if(busy)return;busy=true;
    const id=lastCallId;
    try{
      const key=sessionStorage.getItem('mk_tv_control_v5')||'';
      if(key){await fetch('/api/tv/stinger-finished',{method:'POST',headers:{'Content-Type':'application/json','X-TV-Key':key},body:JSON.stringify({callId:id})})}
      const r=await fetch('/api/state',{cache:'no-store'});
      if(r.ok)window.MKTV.render(await r.json());
    }catch(e){/* Backend timeout handles an offline TV. */}
    busy=false;
  }
  function show(s){
    let html='';const n=id=>s.guests.find(p=>p.id===id)?.name||'Dalībnieks';
    const qr=(type,id)=>`<div class="qr ${type==='join'?'tvqr':''}"><img alt="QR" src="/api/qr/${type}?v=${encodeURIComponent(id)}"></div>`;
    const timer=until=>Math.max(0,Math.ceil((until-Date.now())/1000));
    if(s.phase==='lobby')html=`<div class="tv-label">PIEVIENOJIES SPĒLEI</div><div class="tv-title">MELNĀ KASTE</div>${qr('join',s.room)}<div class="tv-code">${safe(s.room)}</div><div class="tv-help">Noskenē kodu un ievadi savu vārdu</div><div class="tv-meta">${s.guests.length} DALĪBNIEKI</div>`;
    else if(s.phase==='finished')html='<div class="tv-label">SPĒLE NOSLĒGTA</div><div class="tv-title">MELNĀ KASTE IR AIZVĒRTA</div>';
    else if(s.paused)html='<div class="tv-label">PAUZE</div><div class="tv-title">TURPINĀJUMS SEKOS</div>';
    else if(s.call?.status==='waiting')html=`<div class="tv-label">TAVS IZSAUKUMS</div><div class="tv-person">${safe(n(s.call.guestId))}</div>${qr('call',s.call.id)}<div class="tv-timer" id="callClock">${timer(s.call.expiresAt)}</div><div class="tv-help">Noskenē kodu, lai saņemtu slepeno kartīti</div>`;
    else if(s.duel?.status==='active')html=`<div class="tv-label">DUELIS</div><div class="tv-title">${safe(s.duel.activity||'IZAICINĀJUMS')}</div><div class="tv-duel">${safe(n(s.duel.challengerId))} <span class="tv-gold">PRET</span> ${safe(n(s.duel.opponentId))}</div>`;
    else if(s.globalEvent){const e=s.globalEvent;html=`<div class="tv-label">${e.participantIds?.length?'AKTIVIZĒTS IZAICINĀJUMS':'KOPĪGS NOTIKUMS'}</div><div class="tv-title">${safe(e.title)}</div><div class="tv-description">${safe(e.text)}</div>${e.participantIds?.length?`<div class="tv-people">${e.participantIds.map(id=>safe(n(id))).join(' · ')}</div>`:''}${e.rules?.length?`<div class="tv-rules">${e.rules.map((r,i)=>`<div><strong>${i+1}.</strong> ${safe(r)}</div>`).join('')}</div>`:''}`}
    else html='<div class="tv-symbol">◈</div><div class="tv-label">SISTĒMA AKTĪVA</div><div class="tv-title">NEKAS NAV<br>NEJAUŠS.</div>';
    mode='none';mediaPath='';video.pause();presentText(html);
  }
  function render(s){
    setup();
    playlist=Array.isArray(s.standbyVideos)?s.standbyVideos.filter(x=>x.available&&typeof x.url==='string'):[];
    if(s.call?.status==='queued'&&s.call.videoId){
      if(!stingerPreload)stingerPreload=document.createElement('video');
      const next='/media/video/'+encodeURIComponent(s.call.videoId);
      if(stingerPreload.getAttribute('src')!==next){stingerPreload.preload='auto';stingerPreload.src=next;stingerPreload.load()}
    }
    const live=s.phase==='live'&&!s.paused;
    if(!live){show(s);return}
    if(s.call?.status==='stinger'&&s.call.videoId){
      lastCallId=s.call.id;
      enterMedia('stinger','/media/video/'+encodeURIComponent(s.call.videoId));return;
    }
    if(!s.call||s.call.status==='queued'){
      if(!s.duel?.status||s.duel.status!=='active'){
        if(!s.globalEvent&&playlist.length){
          if(mode!=='standby'){
            playlistIndex%=playlist.length;enterMedia('standby',playlist[playlistIndex].url)}
          return;
        }
      }
    }
    show(s);
  }
  return {render};
})();
