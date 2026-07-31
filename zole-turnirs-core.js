'use strict';

const STORAGE_KEY = 'zoleTournamentApp.v1';
const DEFAULT_NAME = 'Zoles turnīrs';

const emptyState = () => ({
  version: 1,
  tournament: {
    name: DEFAULT_NAME,
    createdAt: new Date().toISOString(),
    startedAt: null,
    updatedAt: new Date().toISOString()
  },
  players: [],
  rounds: []
});

let state = loadState();
let activeView = 'registration';
let toastTimer = null;

const el = id => document.getElementById(id);
const refs = {
  headerTitle: el('headerTitle'), headerStatus: el('headerStatus'),
  tournamentName: el('tournamentName'), registrationForm: el('registrationForm'),
  playerName: el('playerName'), playerList: el('playerList'), playersSubtitle: el('playersSubtitle'),
  registrationFormCard: el('registrationFormCard'), registrationNotice: el('registrationNotice'),
  startTournamentBtn: el('startTournamentBtn'), startHelp: el('startHelp'),
  tabPlayers: el('tabPlayers'), tabRound: el('tabRound'),
  roundEmpty: el('roundEmpty'), roundContent: el('roundContent'),
  metricRound: el('metricRound'), metricTables: el('metricTables'), metricCompleted: el('metricCompleted'),
  roundTitle: el('roundTitle'), roundDescription: el('roundDescription'), roundNotice: el('roundNotice'),
  tablesGrid: el('tablesGrid'), finishRoundBtn: el('finishRoundBtn'), nextRoundBtn: el('nextRoundBtn'),
  leaderboardBody: el('leaderboardBody'), leaderboardEmpty: el('leaderboardEmpty'), provisionalBadge: el('provisionalBadge'),
  historyList: el('historyList'), printBtn: el('printBtn'), exportJsonBtn: el('exportJsonBtn'),
  importJsonBtn: el('importJsonBtn'), importJsonFile: el('importJsonFile'), resetBtn: el('resetBtn'),
  printReport: el('printReport'), modalRoot: el('modalRoot'), toast: el('toast')
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.players) || !Array.isArray(parsed.rounds)) return emptyState();
    return parsed;
  } catch (error) {
    console.error('Neizdevās ielādēt datus', error);
    return emptyState();
  }
}

function saveState() {
  state.tournament.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Neizdevās saglabāt datus pārlūkā', error);
  }
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('lv-LV', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date(value));
}

function fileSafe(value) {
  return String(value || DEFAULT_NAME).trim().replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'zoles_turnirs';
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => refs.toast.classList.remove('show'), 2400);
}

function showModal({ title, text, confirmText = 'Apstiprināt', danger = false, onConfirm }) {
  refs.modalRoot.className = 'modal-backdrop';
  refs.modalRoot.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      <h3 id="modalTitle">${escapeHtml(title)}</h3>
      <p>${escapeHtml(text)}</p>
      <div class="action-row">
        <button class="btn btn-ghost" data-modal-cancel>Atcelt</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-modal-confirm>${escapeHtml(confirmText)}</button>
      </div>
    </div>`;
  refs.modalRoot.querySelector('[data-modal-cancel]').onclick = closeModal;
  refs.modalRoot.querySelector('[data-modal-confirm]').onclick = () => { closeModal(); onConfirm?.(); };
  refs.modalRoot.onclick = event => { if (event.target === refs.modalRoot) closeModal(); };
}

function closeModal() {
  refs.modalRoot.className = 'hidden';
  refs.modalRoot.innerHTML = '';
}

function getPlayer(id) { return state.players.find(player => player.id === id); }
function getCurrentRound() { return state.rounds[state.rounds.length - 1] || null; }
function isTournamentStarted() { return state.rounds.length > 0; }

function getTableSizes(count) {
  if (count < 3) return null;
  const fourCount = count % 3 === 0 ? 0 : count % 3 === 1 ? 1 : 2;
  const remaining = count - fourCount * 4;
  if (remaining < 0 || remaining % 3 !== 0) return null;
  return [...Array(remaining / 3).fill(3), ...Array(fourCount).fill(4)];
}

function tablePlanText(count) {
  const sizes = getTableSizes(count);
  if (!sizes) return 'Šo spēlētāju skaitu nevar sadalīt derīgos 3 vai 4 spēlētāju galdos.';
  const threes = sizes.filter(size => size === 3).length;
  const fours = sizes.filter(size => size === 4).length;
  const parts = [];
  if (threes) parts.push(`${threes} × 3 spēlētāji`);
  if (fours) parts.push(`${fours} × 4 spēlētāji`);
  return `Sadalījums: ${parts.join(' un ')}.`;
}

function calculateBigPoints(scores) {
  if (!scores.length || scores.some(score => !Number.isFinite(score))) return null;

  const placePoints = scores.length === 3
    ? [6, 4, 2]
    : scores.length === 4
      ? [6, 4, 2, 0]
      : null;

  if (!placePoints) throw new Error('Neatbalstīts galda spēlētāju skaits.');

  if (scores.length === 4 && scores.every(score => score === scores[0])) {
    return [2, 2, 2, 2];
  }

  const result = Array(scores.length).fill(0);
  const ordered = scores
    .map((score, originalIndex) => ({ score, originalIndex }))
    .sort((a, b) => b.score - a.score);

  let start = 0;
  while (start < ordered.length) {
    let end = start + 1;
    while (end < ordered.length && ordered[end].score === ordered[start].score) end += 1;

    const sharedPoints = placePoints
      .slice(start, end)
      .reduce((sum, points) => sum + points, 0) / (end - start);

    for (let index = start; index < end; index += 1) {
      result[ordered[index].originalIndex] = sharedPoints;
    }
    start = end;
  }

  return result;
}

function evaluateTable(table) {
  const values = table.playerIds.map(playerId => {
    const raw = table.scores?.[playerId]?.small;
    return raw === '' || raw === null || raw === undefined ? null : Number(raw);
  });
  const complete = values.every(Number.isFinite);
  const sum = complete ? values.reduce((total, value) => total + value, 0) : null;
  const valid = complete && sum === 0;
  const big = complete ? calculateBigPoints(values) : null;
  return { values, complete, sum, valid, big };
}

function roundValid(round) { return round.tables.every(table => evaluateTable(table).valid); }

function getPreviousRoundOrder(roundNumber) {
  if (roundNumber === 1) return [...state.players].sort((a,b) => a.registrationNo - b.registrationNo).map(player => player.id);
  const previous = state.rounds.find(round => round.number === roundNumber - 1);
  if (!previous || !previous.finalized) throw new Error('Iepriekšējā kārta nav pabeigta.');
  const previousScores = new Map();
  previous.tables.forEach(table => {
    const evaluation = evaluateTable(table);
    table.playerIds.forEach((playerId, index) => {
      previousScores.set(playerId, { big: evaluation.big[index], small: evaluation.values[index] });
    });
  });
  return [...state.players]
    .sort((a,b) => {
      const sa = previousScores.get(a.id) || { big: -Infinity, small: -Infinity };
      const sb = previousScores.get(b.id) || { big: -Infinity, small: -Infinity };
      return sb.big - sa.big || sb.small - sa.small || a.registrationNo - b.registrationNo;
    })
    .map(player => player.id);
}

function createRound(number) {
  const orderedIds = getPreviousRoundOrder(number);
  const sizes = getTableSizes(orderedIds.length);
  if (!sizes) throw new Error('Spēlētāju skaitu nevar sadalīt pa 3 vai 4 spēlētāju galdiem.');
  let cursor = 0;
  const tables = sizes.map((size, index) => {
    const playerIds = orderedIds.slice(cursor, cursor + size);
    cursor += size;
    const scores = Object.fromEntries(playerIds.map(id => [id, { small: '' }]));
    return { id: uid('table'), number: index + 1, playerIds, scores };
  });
  return {
    id: uid('round'), number, createdAt: new Date().toISOString(), finalizedAt: null, finalized: false, tables
  };
}

function getLeaderboard(includeDraft = true) {
  const totals = new Map(state.players.map(player => [player.id, {
    id: player.id, name: player.name, registrationNo: player.registrationNo, big: 0, small: 0, rounds: 0
  }]));
  let hasDraftScores = false;

  state.rounds.forEach(round => {
    round.tables.forEach(table => {
      const evaluation = evaluateTable(table);
      const counted = round.finalized || (includeDraft && evaluation.valid);
      if (!counted) return;
      if (!round.finalized) hasDraftScores = true;
      table.playerIds.forEach((playerId, index) => {
        const row = totals.get(playerId);
        row.big += evaluation.big[index];
        row.small += evaluation.values[index];
        row.rounds += 1;
      });
    });
  });

  const sorted = [...totals.values()].sort((a,b) =>
    b.big - a.big || b.small - a.small || a.registrationNo - b.registrationNo
  );
  sorted.forEach((row, index) => {
    const previous = sorted[index - 1];
    row.place = previous && previous.big === row.big && previous.small === row.small
      ? previous.place
      : index + 1;
  });
  return { rows: sorted, hasDraftScores };
}
