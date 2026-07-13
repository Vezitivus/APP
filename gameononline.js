(() => {
  'use strict';

  const CONFIG = Object.freeze({
    appUrl: 'https://script.google.com/macros/s/AKfycbwKXz5unPWnG4ToVpYF7hSAh-Kh0526qUaWyuNMI6plQTNUZyoJh_tZy9mydxqZrx-x/exec',
    appId: 'gameononline-v2',
    childStorageKey: 'tournament_state_series_scroll_v3',
    clientKey: 'gameononline_client_id_v2',
    childPage: './gameon2.html',
    localWatchMs: 450,
    remotePollMs: 3500,
    saveDebounceMs: 650,
    confirmTimeoutMs: 12000,
    jsonpTimeoutMs: 12000
  });

  const $ = selector => document.querySelector(selector);
  const frame = $('#appFrame');
  const lobby = $('#lobby');
  const pinInput = $('#pinInput');
  const pinLabel = $('#pinLabel');
  const enterBtn = $('#enterBtn');
  const lobbyStatus = $('#lobbyStatus');
  const createChoice = $('#createChoice');
  const joinChoice = $('#joinChoice');
  const sessionBar = $('#sessionBar');
  const sessionPin = $('#sessionPin');
  const leaveBtn = $('#leaveBtn');
  const syncPill = $('#syncPill');
  const syncText = $('#syncText');
  const syncDetail = $('#syncDetail');

  let mode = 'create';
  let activePin = '';
  let appLoaded = false;
  let observedRaw = null;
  let pendingHash = null;
  let pendingSince = 0;
  let saveTimer = 0;
  let pollTimer = 0;
  let watchTimer = 0;
  let polling = false;
  let syncMeta = {};

  let clientId = localStorage.getItem(CONFIG.clientKey);
  if (!clientId) {
    clientId = `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
    localStorage.setItem(CONFIG.clientKey, clientId);
  }

  function gameBackupKey(pin) { return `gameononline_game_${pin}_snapshot_v2`; }
  function gameMetaKey(pin) { return `gameononline_game_${pin}_meta_v2`; }

  function setMode(nextMode) {
    mode = nextMode;
    const creating = mode === 'create';
    createChoice.classList.toggle('active', creating);
    joinChoice.classList.toggle('active', !creating);
    pinLabel.textContent = creating ? 'Jaunās spēles PIN' : 'Spēles PIN';
    enterBtn.textContent = creating ? 'Izveidot' : 'Pievienoties';
    lobbyStatus.textContent = '';
    lobbyStatus.className = 'lobby-status';
    pinInput.focus();
  }

  function setLobbyStatus(state, text) {
    lobbyStatus.className = `lobby-status ${state || ''}`;
    lobbyStatus.textContent = text || '';
  }

  function setSyncStatus(state, text, detail = '') {
    syncPill.dataset.state = state;
    syncText.textContent = text;
    syncDetail.textContent = detail;
  }

  function cleanPin(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 8);
  }

  function validatePin(pin) {
    return /^\d{4,8}$/.test(pin);
  }

  function readRaw() {
    return localStorage.getItem(CONFIG.childStorageKey);
  }

  function writeRaw(raw) {
    if (raw === null) localStorage.removeItem(CONFIG.childStorageKey);
    else localStorage.setItem(CONFIG.childStorageKey, raw);
  }

  function payloadFromRaw(raw) {
    return raw === null ? 'null' : raw;
  }

  function rawFromPayload(payload) {
    return payload === 'null' ? null : payload;
  }

  function readGameMeta(pin) {
    try { return JSON.parse(localStorage.getItem(gameMetaKey(pin)) || '{}') || {}; }
    catch { return {}; }
  }

  function writeGameMeta(patch = {}) {
    syncMeta = {...syncMeta, ...patch};
    localStorage.setItem(gameMetaKey(activePin), JSON.stringify(syncMeta));
  }

  function rememberLocal(raw) {
    if (!activePin) return;
    if (raw === null) localStorage.removeItem(gameBackupKey(activePin));
    else localStorage.setItem(gameBackupKey(activePin), raw);
  }

  function hashText(text) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
  }

  function validatePayload(payload) {
    if (typeof payload !== 'string') return false;
    try { JSON.parse(payload); return true; }
    catch { return false; }
  }

  function formatTime(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('lv-LV', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  }

  function jsonp(action, extra = {}) {
    return new Promise((resolve, reject) => {
      const callbackName = `__gameonCb_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      let completed = false;
      const timer = setTimeout(() => finish(new Error('timeout')), CONFIG.jsonpTimeoutMs);

      function finish(error, value) {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        try { delete window[callbackName]; } catch { window[callbackName] = undefined; }
        script.remove();
        if (error) reject(error); else resolve(value);
      }

      window[callbackName] = data => finish(null, data);
      script.onerror = () => finish(new Error('network'));

      const url = new URL(CONFIG.appUrl);
      url.searchParams.set('action', action);
      url.searchParams.set('appId', CONFIG.appId);
      url.searchParams.set('prefix', callbackName);
      url.searchParams.set('_', Date.now().toString());
      for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, String(value));
      script.src = url.toString();
      script.async = true;
      document.head.appendChild(script);
    });
  }

  async function createGame(pin) {
    const result = await jsonp('create', {pin});
    if (!result || result.ok !== true) throw new Error(result?.error || 'create_failed');
    return result;
  }

  async function getRemoteMeta() {
    const result = await jsonp('meta', {pin: activePin});
    if (!result || result.ok !== true) throw new Error(result?.error || 'bad_response');
    return result;
  }

  async function getRemoteSnapshot() {
    const result = await jsonp('load', {pin: activePin});
    if (!result || result.ok !== true) throw new Error(result?.error || 'bad_response');
    if (result.hasData && !validatePayload(result.payload)) throw new Error('invalid_payload');
    return result;
  }

  async function postSnapshot(payload) {
    const payloadHash = hashText(payload);
    const body = JSON.stringify({
      action: 'save',
      appId: CONFIG.appId,
      pin: activePin,
      clientId,
      payload,
      payloadHash,
      sentAt: new Date().toISOString()
    });

    await fetch(CONFIG.appUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      keepalive: body.length < 60000,
      headers: {'Content-Type':'text/plain;charset=utf-8'},
      body
    });
    return payloadHash;
  }

  async function enterGame(pin, creating) {
    enterBtn.disabled = true;
    setLobbyStatus('busy', creating ? 'Veido spēli Google Sheets…' : 'Meklē spēli…');

    try {
      if (creating) {
        const created = await createGame(pin);
        if (created.exists && !created.created) {
          throw new Error('Šāds PIN jau tiek izmantots. Izvēlies citu PIN.');
        }
      } else {
        activePin = pin;
        const remote = await getRemoteMeta();
        if (!remote.exists) throw new Error('Spēle ar šādu PIN nav atrasta.');
      }

      activePin = pin;
      syncMeta = readGameMeta(activePin);
      pendingHash = null;
      pendingSince = 0;
      appLoaded = false;

      const remote = await getRemoteMeta();
      if (!remote.exists) throw new Error('Spēle netika atrasta Google Sheets.');

      if (remote.hasData) {
        setLobbyStatus('busy', 'Ielādē spēles datus…');
        const snapshot = await getRemoteSnapshot();
        writeRaw(rawFromPayload(snapshot.payload));
        rememberLocal(rawFromPayload(snapshot.payload));
        writeGameMeta({
          lastSyncedHash: snapshot.payloadHash,
          lastRemoteRevision: Number(snapshot.revision || 0),
          lastRemoteUpdatedAt: snapshot.updatedAt || '',
          lastSyncAt: Date.now()
        });
      } else {
        writeRaw(null);
        rememberLocal(null);
        writeGameMeta({
          lastSyncedHash: hashText('null'),
          lastRemoteRevision: Number(remote.revision || 0),
          lastRemoteUpdatedAt: remote.updatedAt || '',
          lastSyncAt: Date.now()
        });
      }

      openGame();
    } catch (error) {
      console.error('Game entry failed:', error);
      activePin = '';
      const message = String(error?.message || error || 'Savienojuma kļūda.');
      setLobbyStatus('bad', message.includes('timeout') || message.includes('network')
        ? 'Google Sheets serveris nav sasniedzams. Pārbaudi Apps Script deployment piekļuvi.'
        : message);
    } finally {
      enterBtn.disabled = false;
    }
  }

  function openGame() {
    lobby.hidden = true;
    frame.hidden = false;
    sessionBar.hidden = false;
    syncPill.hidden = false;
    sessionPin.textContent = activePin;
    setSyncStatus('busy', 'Atver spēli');

    observedRaw = readRaw();
    frame.src = `${CONFIG.childPage}?game=${encodeURIComponent(activePin)}&v=2`;
    frame.addEventListener('load', () => {
      appLoaded = true;
      setSyncStatus('ok', 'Sinhronizēts', syncMeta.lastRemoteUpdatedAt ? formatTime(syncMeta.lastRemoteUpdatedAt) : '');
      startLoops();
    }, {once:true});
  }

  function stopLoops() {
    clearTimeout(saveTimer);
    clearTimeout(pollTimer);
    clearTimeout(watchTimer);
    saveTimer = pollTimer = watchTimer = 0;
    polling = false;
  }

  function startLoops() {
    stopLoops();
    watchLocalStorage();
    pollTimer = setTimeout(pollRemote, 900);
  }

  function scheduleSave(delay = CONFIG.saveDebounceMs) {
    if (!activePin) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveLocalNow, delay);
    setSyncStatus('busy', 'Gaida saglabāšanu');
  }

  async function saveLocalNow() {
    clearTimeout(saveTimer);
    if (!activePin) return;
    const payload = payloadFromRaw(readRaw());
    if (!validatePayload(payload)) {
      setSyncStatus('bad', 'Lokālie dati nav derīgi');
      return;
    }

    const localHash = hashText(payload);
    if (syncMeta.lastSyncedHash === localHash && !pendingHash) {
      setSyncStatus('ok', 'Sinhronizēts', syncMeta.lastRemoteUpdatedAt ? formatTime(syncMeta.lastRemoteUpdatedAt) : '');
      return;
    }

    pendingHash = localHash;
    pendingSince = Date.now();
    rememberLocal(readRaw());
    writeGameMeta({lastLocalChangeAt:Date.now(),pendingHash:localHash});
    setSyncStatus('busy', 'Sūta uz Google Sheets');

    try {
      await postSnapshot(payload);
      setSyncStatus('busy', 'Pārbauda saglabāšanu');
      setTimeout(() => pollRemote(true), 850);
    } catch (error) {
      console.error('GameOn sync save failed:', error);
      setSyncStatus('bad', 'Nav interneta — dati paliek ierīcē');
      setTimeout(() => scheduleSave(1200), 3200);
    }
  }

  function localChangedSinceSync(localHash) {
    return Boolean(syncMeta.lastSyncedHash) && syncMeta.lastSyncedHash !== localHash;
  }

  function applyRemotePayload(payload, remote) {
    const raw = rawFromPayload(payload);
    writeRaw(raw);
    rememberLocal(raw);
    observedRaw = raw;
    pendingHash = null;
    pendingSince = 0;
    writeGameMeta({
      lastSyncedHash: remote.payloadHash || hashText(payload),
      pendingHash: '',
      lastRemoteRevision: Number(remote.revision || 0),
      lastRemoteUpdatedAt: remote.updatedAt || '',
      lastSyncAt: Date.now()
    });
    setSyncStatus('ok', 'Sinhronizēts', remote.updatedAt ? formatTime(remote.updatedAt) : '');
    if (appLoaded) {
      setTimeout(() => {
        try { frame.contentWindow.location.reload(); }
        catch { frame.src = `${CONFIG.childPage}?game=${encodeURIComponent(activePin)}&v=2`; }
      }, 80);
    }
  }

  async function handleRemoteMeta(remote, forceLoad = false) {
    if (!remote.exists) {
      setSyncStatus('bad', 'Spēles lapa Google Sheets vairs nepastāv');
      return;
    }

    const localPayload = payloadFromRaw(readRaw());
    const localHash = hashText(localPayload);
    const remoteHash = remote.payloadHash || '';

    if (!remote.hasData) {
      if (localPayload !== 'null') {
        if (!pendingHash) scheduleSave(100);
      } else {
        writeGameMeta({
          lastSyncedHash:localHash,
          lastRemoteRevision:Number(remote.revision || 0),
          lastRemoteUpdatedAt:remote.updatedAt || '',
          lastSyncAt:Date.now()
        });
        setSyncStatus('ok', 'Sinhronizēts');
      }
      return;
    }

    if (remoteHash && remoteHash === localHash) {
      pendingHash = null;
      pendingSince = 0;
      writeGameMeta({
        lastSyncedHash:localHash,
        pendingHash:'',
        lastRemoteRevision:Number(remote.revision || 0),
        lastRemoteUpdatedAt:remote.updatedAt || '',
        lastSyncAt:Date.now()
      });
      setSyncStatus('ok', 'Sinhronizēts', remote.updatedAt ? formatTime(remote.updatedAt) : '');
      return;
    }

    if (pendingHash || localChangedSinceSync(localHash)) {
      const pendingAge = pendingSince ? Date.now() - pendingSince : 0;
      if (pendingAge > CONFIG.confirmTimeoutMs) {
        setSyncStatus('bad', 'Sinhronizācija kavējas — mēģina vēlreiz');
        pendingSince = Date.now();
        scheduleSave(120);
      } else {
        setSyncStatus('busy', 'Gaida Google Sheets apstiprinājumu');
      }
      return;
    }

    const remoteRevision = Number(remote.revision || 0);
    const knownRevision = Number(syncMeta.lastRemoteRevision || 0);
    if (!forceLoad && remoteRevision <= knownRevision) return;

    setSyncStatus('busy', 'Saņem jaunākos datus');
    const snapshot = await getRemoteSnapshot();
    const currentHash = hashText(payloadFromRaw(readRaw()));
    if (pendingHash || localChangedSinceSync(currentHash)) return;
    if (snapshot.hasData) applyRemotePayload(snapshot.payload, snapshot);
  }

  async function pollRemote(immediate = false) {
    if (!activePin || polling) return;
    polling = true;
    clearTimeout(pollTimer);
    try {
      const remote = await getRemoteMeta();
      await handleRemoteMeta(remote, immediate);
    } catch (error) {
      console.error('GameOn sync poll failed:', error);
      if (!pendingHash) setSyncStatus('bad', 'Google Sheets nav sasniedzams — strādā lokāli');
    } finally {
      polling = false;
      if (activePin) pollTimer = setTimeout(pollRemote, CONFIG.remotePollMs);
    }
  }

  function watchLocalStorage() {
    if (!activePin) return;
    const raw = readRaw();
    if (raw !== observedRaw) {
      observedRaw = raw;
      rememberLocal(raw);
      pendingHash = hashText(payloadFromRaw(raw));
      pendingSince = Date.now();
      scheduleSave();
    }
    watchTimer = setTimeout(watchLocalStorage, CONFIG.localWatchMs);
  }

  function leaveGame() {
    stopLoops();
    rememberLocal(readRaw());
    activePin = '';
    syncMeta = {};
    pendingHash = null;
    pendingSince = 0;
    appLoaded = false;
    frame.src = 'about:blank';
    frame.hidden = true;
    sessionBar.hidden = true;
    syncPill.hidden = true;
    lobby.hidden = false;
    pinInput.value = '';
    setLobbyStatus('', '');
    pinInput.focus();
  }

  createChoice.addEventListener('click', () => setMode('create'));
  joinChoice.addEventListener('click', () => setMode('join'));
  pinInput.addEventListener('input', () => { pinInput.value = cleanPin(pinInput.value); });
  pinInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') enterBtn.click();
  });
  enterBtn.addEventListener('click', () => {
    const pin = cleanPin(pinInput.value);
    if (!validatePin(pin)) {
      setLobbyStatus('bad', 'PIN jābūt 4–8 cipariem.');
      pinInput.focus();
      return;
    }
    enterGame(pin, mode === 'create');
  });
  leaveBtn.addEventListener('click', leaveGame);

  window.addEventListener('storage', event => {
    if (activePin && event.key === CONFIG.childStorageKey) {
      observedRaw = event.newValue;
      rememberLocal(event.newValue);
      pendingHash = hashText(payloadFromRaw(event.newValue));
      pendingSince = Date.now();
      scheduleSave();
    }
  });
  window.addEventListener('online', () => {
    if (!activePin) return;
    setSyncStatus('busy', 'Atjauno savienojumu');
    pollRemote(true);
  });
  window.addEventListener('offline', () => {
    if (activePin) setSyncStatus('bad', 'Bezsaistē — dati paliek ierīcē');
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && activePin) pollRemote(true);
  });

  setMode('create');
})();
