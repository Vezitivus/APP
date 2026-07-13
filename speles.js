'use strict';

const API_URL = 'https://script.google.com/macros/s/AKfycbyRBTTPwse_9PxDoeA9EzwoVfcBlGh4vS1hirZXR4s4z6GM8PjpqGb6MhEeMiNeO7yU/exec';

const state = {
  games: [],
  players: [],
  officialTeams: [],
  selectedGameColumn: '',
  mode: 'players',
  minTeams: 2,
  maxTeams: 15,
  teamCount: 2,
  slots: [],
  activeSlotIndex: -1,
  loading: false
};

const els = {
  connection: document.getElementById('connection'),
  connectionText: document.getElementById('connectionText'),
  refreshBtn: document.getElementById('refreshBtn'),
  gameSelect: document.getElementById('gameSelect'),
  teamCountSelect: document.getElementById('teamCountSelect'),
  playersModeBtn: document.getElementById('playersModeBtn'),
  officialModeBtn: document.getElementById('officialModeBtn'),
  modeHelp: document.getElementById('modeHelp'),
  teamsGrid: document.getElementById('teamsGrid'),
  saveBtn: document.getElementById('saveBtn'),
  pickerModal: document.getElementById('pickerModal'),
  pickerTitle: document.getElementById('pickerTitle'),
  pickerSub: document.getElementById('pickerSub'),
  closePickerBtn: document.getElementById('closePickerBtn'),
  donePickerBtn: document.getElementById('donePickerBtn'),
  pickerSearch: document.getElementById('pickerSearch'),
  pickerScroll: document.getElementById('pickerScroll'),
  pickerGrid: document.getElementById('pickerGrid'),
  selectionSummary: document.getElementById('selectionSummary'),
  toastStack: document.getElementById('toastStack'),
  loadingCover: document.getElementById('loadingCover'),
  loadingText: document.getElementById('loadingText')
};

function createSlot() {
  return {
    playerIds: new Set(),
    officialTeamColumn: '',
    score: ''
  };
}

function ensureSlotCount(count) {
  while (state.slots.length < count) state.slots.push(createSlot());
  if (state.slots.length > count) state.slots.length = count;
  state.teamCount = count;
}

function setConnection(stateName, text) {
  els.connection.dataset.state = stateName;
  els.connectionText.textContent = text;
}

function showLoading(show, text = 'Saglabā rezultātus…') {
  state.loading = show;
  els.loadingText.textContent = text;
  els.loadingCover.classList.toggle('open', show);
  els.loadingCover.setAttribute('aria-hidden', String(!show));
  updateSaveState();
}

function toast(message, type = '') {
  const node = document.createElement('div');
  node.className = `toast ${type}`.trim();
  node.textContent = message;
  els.toastStack.replaceChildren(node);
  window.setTimeout(() => {
    if (node.isConnected) node.remove();
  }, 3800);
}

function jsonp(params, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const callbackName = `__speles_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const timer = window.setTimeout(() => finish(new Error('Savienojuma noildze.')), timeoutMs);

    function cleanup() {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    function finish(error, data) {
      cleanup();
      if (error) reject(error);
      else resolve(data);
    }

    window[callbackName] = data => finish(null, data);
    script.onerror = () => finish(new Error('Neizdevās sasniegt Google serveri.'));

    const url = new URL(API_URL);
    Object.entries({ ...params, callback: callbackName, _: Date.now() }).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });

    script.src = url.toString();
    script.async = true;
    document.head.appendChild(script);
  });
}

async function loadBootstrap(force = false) {
  setConnection('busy', 'Ielādē datus');
  els.refreshBtn.disabled = true;
  els.gameSelect.disabled = true;

  try {
    const response = await jsonp({ action: 'bootstrap', force: force ? '1' : '0' });
    if (!response || response.ok !== true) throw new Error(response?.error || 'Serveris neatgrieza datus.');

    state.games = Array.isArray(response.games) ? response.games : [];
    state.players = (Array.isArray(response.players) ? response.players : [])
      .map(player => ({ id: String(player.id), name: String(player.name), row: Number(player.row) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'lv', { sensitivity: 'base', numeric: true }));

    state.officialTeams = (Array.isArray(response.officialTeams) ? response.officialTeams : [])
      .map(team => ({
        name: String(team.name),
        column: Number(team.column),
        members: Array.isArray(team.members) ? team.members.map(member => ({
          id: String(member.id),
          name: String(member.name),
          row: Number(member.row)
        })) : [],
        unresolved: Array.isArray(team.unresolved) ? team.unresolved.map(String) : []
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'lv', { sensitivity: 'base', numeric: true }));

    state.minTeams = Number(response.limits?.minTeams) || 2;
    state.maxTeams = Number(response.limits?.maxTeams) || 15;
    state.teamCount = Math.min(Math.max(state.teamCount, state.minTeams), state.maxTeams);
    ensureSlotCount(state.teamCount);

    renderGameOptions();
    renderTeamCountOptions();
    renderMode();
    renderTeams();
    setConnection('ready', `${state.players.length} spēlētāji`);

    if (!state.games.length) toast('F4:AR4 diapazonā nav atrasta neviena spēle.', 'error');
    if (!state.players.length) toast('B6:C1000 diapazonā nav atrasts neviens spēlētājs.', 'error');
    if (!state.officialTeams.length) toast('Lapā “Komandas” diapazonā C1004:Q1004 nav atrasta neviena komanda.', 'error');
  } catch (error) {
    console.error(error);
    setConnection('error', 'Nav savienojuma');
    els.gameSelect.innerHTML = '<option value="">Neizdevās ielādēt spēles</option>';
    toast(error.message || 'Neizdevās ielādēt datus.', 'error');
  } finally {
    els.refreshBtn.disabled = false;
    els.gameSelect.disabled = state.games.length === 0;
    updateSaveState();
  }
}

function renderGameOptions() {
  const previous = state.selectedGameColumn;
  const fragment = document.createDocumentFragment();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Izvēlies spēli';
  fragment.appendChild(placeholder);

  state.games.forEach(game => {
    const option = document.createElement('option');
    option.value = String(game.column);
    option.textContent = game.name;
    fragment.appendChild(option);
  });

  els.gameSelect.replaceChildren(fragment);
  if (previous && state.games.some(game => String(game.column) === String(previous))) {
    els.gameSelect.value = String(previous);
  } else {
    state.selectedGameColumn = '';
  }
}

function renderTeamCountOptions() {
  const fragment = document.createDocumentFragment();
  for (let count = state.minTeams; count <= state.maxTeams; count += 1) {
    const option = document.createElement('option');
    option.value = String(count);
    option.textContent = String(count);
    fragment.appendChild(option);
  }
  els.teamCountSelect.replaceChildren(fragment);
  els.teamCountSelect.value = String(state.teamCount);
}

function renderMode() {
  els.playersModeBtn.classList.toggle('active', state.mode === 'players');
  els.officialModeBtn.classList.toggle('active', state.mode === 'officialTeams');
  els.modeHelp.textContent = state.mode === 'players'
    ? 'Katras komandas spēlētājus izvēlies no gamehost spēlētāju saraksta.'
    : 'Izvēlies gatavas komandas no lapas “Komandas”. Punkti tiks ierakstīti visiem līdz 8 spēlētājiem zem komandas nosaukuma.';
}

function selectedPlayers(slot) {
  return state.players.filter(player => slot.playerIds.has(player.id));
}

function officialTeamByColumn(column) {
  return state.officialTeams.find(team => String(team.column) === String(column));
}

function playerInitials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '—';
}

function renderMemberList(players, maxVisible = 4) {
  const visible = players.slice(0, maxVisible);
  const rows = visible.map(player => `
    <div class="member-row">
      <span class="avatar">${escapeHtml(playerInitials(player.name))}</span>
      <span class="member-copy">
        <span class="member-name">${escapeHtml(player.name)}</span>
        <span class="member-id">ID ${escapeHtml(player.id)}</span>
      </span>
    </div>`).join('');

  const more = players.length > visible.length
    ? `<div class="more-members">+ vēl ${players.length - visible.length}</div>`
    : '';

  return `<div class="member-list">${rows}</div>${more}`;
}

function renderSelection(slot) {
  if (state.mode === 'players') {
    const players = selectedPlayers(slot);
    if (!players.length) {
      return `
        <div class="empty-selection">
          <div>
            <strong>Pievienot spēlētājus</strong>
            <span>Uzspied un izvēlies režģī</span>
          </div>
        </div>`;
    }
    return renderMemberList(players);
  }

  const team = officialTeamByColumn(slot.officialTeamColumn);
  if (!team) {
    return `
      <div class="empty-selection">
        <div>
          <strong>Izvēlēties komandu</strong>
          <span>No lapas “Komandas”</span>
        </div>
      </div>`;
  }

  const warning = team.unresolved.length
    ? `<div class="warning-text">Nav sasaistīti: ${escapeHtml(team.unresolved.join(', '))}</div>`
    : '';

  return `
    <div class="official-summary">
      <div class="official-name">${escapeHtml(team.name)}</div>
      ${renderMemberList(team.members, 3)}
      ${warning}
    </div>`;
}

function renderTeams() {
  const fragment = document.createDocumentFragment();

  state.slots.forEach((slot, index) => {
    const selectedCount = state.mode === 'players'
      ? slot.playerIds.size
      : (officialTeamByColumn(slot.officialTeamColumn)?.members.length || 0);

    const card = document.createElement('article');
    card.className = 'team-card';
    card.dataset.slotIndex = String(index);
    card.innerHTML = `
      <div class="team-head">
        <div class="team-index">
          <span class="team-badge">${index + 1}</span>
          <span>Komanda ${index + 1}</span>
        </div>
        <span class="team-count">${selectedCount}</span>
      </div>
      <button class="selection-btn" type="button" data-action="open-picker" data-slot-index="${index}">
        ${renderSelection(slot)}
      </button>
      <div class="score-row">
        <div class="score-caption">
          <strong>Punkti</strong>
          Tiks ierakstīti visiem šīs komandas dalībniekiem
        </div>
        <input
          class="team-score"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          placeholder="0"
          value="${escapeHtml(slot.score)}"
          data-action="score"
          data-slot-index="${index}"
          aria-label="Komandas ${index + 1} punkti">
      </div>`;
    fragment.appendChild(card);
  });

  els.teamsGrid.replaceChildren(fragment);
  updateSaveState();
}

function openPicker(slotIndex) {
  if (state.loading || slotIndex < 0 || slotIndex >= state.slots.length) return;
  state.activeSlotIndex = slotIndex;
  els.pickerTitle.textContent = state.mode === 'players' ? 'Izvēlies spēlētājus' : 'Izvēlies komandu';
  els.pickerSub.textContent = `Komanda ${slotIndex + 1}`;
  els.pickerSearch.placeholder = state.mode === 'players'
    ? 'Meklēt pēc vārda vai ID…'
    : 'Meklēt komandu…';
  els.pickerSearch.value = '';
  renderPickerGrid();
  updateSelectionSummary();
  els.pickerModal.classList.add('open');
  els.pickerModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  window.setTimeout(() => els.pickerSearch.focus(), 80);
}

function closePicker() {
  els.pickerModal.classList.remove('open');
  els.pickerModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  state.activeSlotIndex = -1;
  renderTeams();
}

function allPlayerIdsOutsideSlot(slotIndex) {
  const ids = new Set();
  state.slots.forEach((slot, index) => {
    if (index === slotIndex) return;
    slot.playerIds.forEach(id => ids.add(id));
  });
  return ids;
}

function officialColumnsOutsideSlot(slotIndex) {
  const columns = new Set();
  state.slots.forEach((slot, index) => {
    if (index === slotIndex || !slot.officialTeamColumn) return;
    columns.add(String(slot.officialTeamColumn));
  });
  return columns;
}

function renderPickerGrid() {
  const query = els.pickerSearch.value.trim().toLocaleLowerCase('lv');
  const slot = state.slots[state.activeSlotIndex];
  if (!slot) return;

  const fragment = document.createDocumentFragment();

  if (state.mode === 'players') {
    const blockedIds = allPlayerIdsOutsideSlot(state.activeSlotIndex);
    const matches = query
      ? state.players.filter(player => `${player.name} ${player.id}`.toLocaleLowerCase('lv').includes(query))
      : state.players;

    if (!matches.length) {
      fragment.appendChild(createEmptyPickerMessage('Neviens spēlētājs nav atrasts.'));
    } else {
      matches.forEach(player => {
        const selected = slot.playerIds.has(player.id);
        const blocked = blockedIds.has(player.id);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `picker-item${selected ? ' selected' : ''}${blocked ? ' blocked' : ''}`;
        button.dataset.playerId = player.id;
        button.disabled = blocked;
        button.setAttribute('aria-pressed', String(selected));
        button.innerHTML = `
          <span class="picker-item-name">${escapeHtml(player.name)}</span>
          <span class="picker-item-meta">ID ${escapeHtml(player.id)}${blocked ? ' · citā komandā' : ''}</span>`;
        fragment.appendChild(button);
      });
    }
  } else {
    const blockedColumns = officialColumnsOutsideSlot(state.activeSlotIndex);
    const matches = query
      ? state.officialTeams.filter(team => `${team.name} ${team.members.map(member => member.name).join(' ')}`.toLocaleLowerCase('lv').includes(query))
      : state.officialTeams;

    if (!matches.length) {
      fragment.appendChild(createEmptyPickerMessage('Neviena komanda nav atrasta.'));
    } else {
      matches.forEach(team => {
        const selected = String(slot.officialTeamColumn) === String(team.column);
        const blocked = blockedColumns.has(String(team.column));
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `picker-item${selected ? ' selected' : ''}${blocked ? ' blocked' : ''}`;
        button.dataset.officialTeamColumn = String(team.column);
        button.disabled = blocked;
        button.setAttribute('aria-pressed', String(selected));
        button.innerHTML = `
          <span class="picker-item-name">${escapeHtml(team.name)}</span>
          <span class="picker-item-meta">${team.members.length} spēlētāji${blocked ? ' · jau izvēlēta' : ''}</span>
          ${team.unresolved.length ? `<span class="picker-item-warning">${team.unresolved.length} nav sasaistīti ar gamehost</span>` : ''}`;
        fragment.appendChild(button);
      });
    }
  }

  els.pickerGrid.replaceChildren(fragment);
  els.pickerScroll.scrollTop = 0;
}

function createEmptyPickerMessage(text) {
  const node = document.createElement('div');
  node.className = 'empty-search';
  node.textContent = text;
  return node;
}

function togglePlayer(playerId) {
  const slot = state.slots[state.activeSlotIndex];
  if (!slot) return;

  const blockedIds = allPlayerIdsOutsideSlot(state.activeSlotIndex);
  if (blockedIds.has(playerId)) return;

  if (slot.playerIds.has(playerId)) slot.playerIds.delete(playerId);
  else slot.playerIds.add(playerId);

  renderPickerGrid();
  updateSelectionSummary();
}

function selectOfficialTeam(column) {
  const slot = state.slots[state.activeSlotIndex];
  if (!slot) return;

  const blockedColumns = officialColumnsOutsideSlot(state.activeSlotIndex);
  if (blockedColumns.has(String(column))) return;

  slot.officialTeamColumn = String(slot.officialTeamColumn) === String(column) ? '' : String(column);
  renderPickerGrid();
  updateSelectionSummary();
}

function updateSelectionSummary() {
  const slot = state.slots[state.activeSlotIndex];
  if (!slot) return;

  if (state.mode === 'players') {
    const count = slot.playerIds.size;
    els.selectionSummary.innerHTML = `<strong>${count}</strong> ${count === 1 ? 'spēlētājs izvēlēts' : 'spēlētāji izvēlēti'}`;
  } else {
    const team = officialTeamByColumn(slot.officialTeamColumn);
    els.selectionSummary.innerHTML = team
      ? `<strong>${escapeHtml(team.name)}</strong> · ${team.members.length} spēlētāji`
      : '<strong>0</strong> komandas izvēlētas';
  }
}

function normalizeScore(raw) {
  const normalized = String(raw).trim().replace(',', '.');
  if (!normalized) return null;
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return NaN;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
}

function slotHasSelection(slot) {
  return state.mode === 'players'
    ? slot.playerIds.size > 0
    : Boolean(officialTeamByColumn(slot.officialTeamColumn));
}

function updateSaveState() {
  const gameReady = Boolean(state.selectedGameColumn);
  const allSlotsReady = state.slots.length === state.teamCount && state.slots.every(slot => {
    const score = normalizeScore(slot.score);
    return slotHasSelection(slot) && score !== null && !Number.isNaN(score);
  });

  els.saveBtn.disabled = !gameReady || !allSlotsReady || state.loading;
  els.saveBtn.textContent = state.loading ? 'Saglabā…' : 'Saglabāt rezultātus';
}

function hasAnyTeamData(slots = state.slots) {
  return slots.some(slot => slot.playerIds.size || slot.officialTeamColumn || String(slot.score).trim());
}

function changeMode(nextMode) {
  if (nextMode === state.mode || state.loading) return;
  if (hasAnyTeamData() && !window.confirm('Mainot disciplīnas veidu, pašreiz izvēlētās komandas un punkti tiks notīrīti. Turpināt?')) {
    return;
  }

  state.mode = nextMode;
  state.slots = Array.from({ length: state.teamCount }, createSlot);
  renderMode();
  renderTeams();
}

function changeTeamCount(nextCount) {
  const normalized = Math.min(Math.max(nextCount, state.minTeams), state.maxTeams);
  if (normalized === state.teamCount) return;

  if (normalized < state.teamCount) {
    const removedSlots = state.slots.slice(normalized);
    if (hasAnyTeamData(removedSlots) && !window.confirm('Samazinot komandu skaitu, pēdējo komandu izvēles un punkti tiks dzēsti. Turpināt?')) {
      els.teamCountSelect.value = String(state.teamCount);
      return;
    }
  }

  ensureSlotCount(normalized);
  renderTeams();
}

function currentGame() {
  return state.games.find(game => String(game.column) === String(state.selectedGameColumn));
}

function buildTeamsPayload() {
  return state.slots.map(slot => {
    const score = normalizeScore(slot.score);
    if (state.mode === 'players') {
      return {
        score: score,
        playerIds: [...slot.playerIds]
      };
    }

    const officialTeam = officialTeamByColumn(slot.officialTeamColumn);
    return {
      score: score,
      officialTeamColumn: officialTeam?.column,
      officialTeamName: officialTeam?.name || ''
    };
  });
}

async function saveResults() {
  if (els.saveBtn.disabled || state.loading) return;

  const game = currentGame();
  if (!game) {
    toast('Izvēlies spēli.', 'error');
    return;
  }

  const payload = buildTeamsPayload();
  showLoading(true, 'Saglabā rezultātus…');
  setConnection('busy', 'Saglabā');

  try {
    const response = await jsonp({
      action: 'saveResult',
      mode: state.mode,
      gameColumn: game.column,
      gameName: game.name,
      teams: JSON.stringify(payload),
      requestId: createRequestId()
    }, 35000);

    if (!response || response.ok !== true) throw new Error(response?.error || 'Rezultātus neizdevās saglabāt.');

    toast(`Saglabāts: ${game.name} · ${response.teamCount} komandas`, 'success');
    setConnection('ready', 'Rezultāti saglabāti');
    resetEntry();
    window.setTimeout(() => setConnection('ready', `${state.players.length} spēlētāji`), 2200);
  } catch (error) {
    console.error(error);
    setConnection('error', 'Saglabāšana neizdevās');
    toast(error.message || 'Rezultātus neizdevās saglabāt.', 'error');
  } finally {
    showLoading(false);
  }
}

function resetEntry() {
  state.slots = Array.from({ length: state.teamCount }, createSlot);
  renderTeams();
  const firstButton = els.teamsGrid.querySelector('[data-action="open-picker"]');
  if (firstButton) firstButton.focus({ preventScroll: true });
}

function createRequestId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

els.gameSelect.addEventListener('change', () => {
  state.selectedGameColumn = els.gameSelect.value;
  updateSaveState();
});

els.teamCountSelect.addEventListener('change', () => {
  changeTeamCount(Number(els.teamCountSelect.value));
});

els.playersModeBtn.addEventListener('click', () => changeMode('players'));
els.officialModeBtn.addEventListener('click', () => changeMode('officialTeams'));

els.teamsGrid.addEventListener('click', event => {
  const button = event.target.closest('[data-action="open-picker"]');
  if (button) openPicker(Number(button.dataset.slotIndex));
});

els.teamsGrid.addEventListener('input', event => {
  const input = event.target.closest('[data-action="score"]');
  if (!input) return;
  const slotIndex = Number(input.dataset.slotIndex);
  if (!state.slots[slotIndex]) return;
  state.slots[slotIndex].score = input.value;
  updateSaveState();
});

els.closePickerBtn.addEventListener('click', closePicker);
els.donePickerBtn.addEventListener('click', closePicker);

els.pickerModal.addEventListener('click', event => {
  if (event.target === els.pickerModal) closePicker();
});

els.pickerGrid.addEventListener('click', event => {
  const playerButton = event.target.closest('[data-player-id]');
  if (playerButton && !playerButton.disabled) {
    togglePlayer(playerButton.dataset.playerId);
    return;
  }

  const teamButton = event.target.closest('[data-official-team-column]');
  if (teamButton && !teamButton.disabled) {
    selectOfficialTeam(teamButton.dataset.officialTeamColumn);
  }
});

els.pickerSearch.addEventListener('input', renderPickerGrid);
els.saveBtn.addEventListener('click', saveResults);
els.refreshBtn.addEventListener('click', () => loadBootstrap(true));

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && els.pickerModal.classList.contains('open')) closePicker();
});

ensureSlotCount(state.teamCount);
renderTeamCountOptions();
renderMode();
renderTeams();
loadBootstrap();
