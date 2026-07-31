document.querySelectorAll('.tab-btn').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));

refs.tournamentName.addEventListener('change', () => {
  const value = refs.tournamentName.value.trim() || DEFAULT_NAME;
  state.tournament.name = value;
  saveState();
  renderAll();
});

refs.registrationForm.addEventListener('submit', event => {
  event.preventDefault();
  if (isTournamentStarted()) return;
  const name = refs.playerName.value.trim().replace(/\s+/g, ' ');
  if (!name) return;
  if (state.players.some(player => player.name.localeCompare(name, 'lv', { sensitivity: 'base' }) === 0)) {
    refs.registrationNotice.textContent = 'Spēlētājs ar šādu vārdu jau ir reģistrēts.';
    refs.registrationNotice.className = 'notice danger';
    return;
  }
  state.players.push({ id: uid('player'), name, registrationNo: state.players.length + 1, registeredAt: new Date().toISOString() });
  refs.playerName.value = '';
  saveState();
  renderAll();
  refs.playerName.focus();
  showToast(`${name} reģistrēts`);
});

refs.playerList.addEventListener('click', event => {
  const button = event.target.closest('[data-remove-player]');
  if (!button || isTournamentStarted()) return;
  const player = getPlayer(button.dataset.removePlayer);
  showModal({
    title: 'Dzēst spēlētāju?', text: `${player.name} tiks noņemts no reģistrācijas.`, confirmText: 'Dzēst', danger: true,
    onConfirm: () => {
      state.players = state.players.filter(item => item.id !== player.id);
      state.players.sort((a,b) => a.registrationNo - b.registrationNo).forEach((item,index) => item.registrationNo = index + 1);
      saveState(); renderAll(); showToast('Spēlētājs dzēsts');
    }
  });
});

refs.startTournamentBtn.addEventListener('click', () => {
  if (isTournamentStarted() || !getTableSizes(state.players.length)) return;
  showModal({
    title: 'Sākt turnīru?',
    text: `Tiks slēgta reģistrācija un izveidota 1. kārta. ${tablePlanText(state.players.length)}`,
    confirmText: 'Sākt 1. kārtu',
    onConfirm: () => {
      state.tournament.startedAt = new Date().toISOString();
      state.rounds.push(createRound(1));
      saveState(); renderAll(); setView('round'); showToast('1. kārta izveidota');
    }
  });
});

refs.tablesGrid.addEventListener('input', event => {
  const input = event.target.closest('[data-score-input]');
  if (!input) return;
  const round = state.rounds.find(item => item.id === input.dataset.roundId);
  const table = round?.tables.find(item => item.id === input.dataset.tableId);
  if (!round || !table || round.finalized) return;

  let raw = input.value.replace(/[^0-9-]/g, '');
  if (raw.startsWith('-')) raw = '-' + raw.slice(1).replace(/-/g, '');
  else raw = raw.replace(/-/g, '');
  if (input.value !== raw) input.value = raw;

  table.scores[input.dataset.playerId].small = raw;
  saveState();
  refreshTableUi(round, table);
});

refs.tablesGrid.addEventListener('click', event => {
  const button = event.target.closest('[data-toggle-sign]');
  if (!button || button.disabled) return;
  const card = button.closest('[data-game-table]');
  const input = card?.querySelector(`[data-score-input][data-player-id="${button.dataset.playerId}"]`);
  if (!input) return;

  const raw = input.value.trim();
  input.value = raw.startsWith('-') ? raw.slice(1) : `-${raw}`;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus({ preventScroll: true });
  try { input.setSelectionRange(input.value.length, input.value.length); } catch (_) {}
});

refs.finishRoundBtn.addEventListener('click', () => {
  const round = getCurrentRound();
  if (!round || round.finalized || !roundValid(round)) return;
  showModal({
    title: `Pabeigt ${round.number}. kārtu?`,
    text: 'Pēc pabeigšanas rezultātus šajā kārtā vairs nevarēs mainīt. Nākamais sadalījums tiks veidots tikai pēc šīs kārtas rezultātiem.',
    confirmText: 'Pabeigt kārtu',
    onConfirm: () => {
      round.finalized = true;
      round.finalizedAt = new Date().toISOString();
      saveState(); renderAll(); showToast(`${round.number}. kārta pabeigta`);
    }
  });
});

refs.nextRoundBtn.addEventListener('click', () => {
  const round = getCurrentRound();
  if (!round?.finalized) return;
  const nextNumber = round.number + 1;
  showModal({
    title: `Izveidot ${nextNumber}. kārtu?`,
    text: `Spēlētāji tiks sakārtoti pēc ${round.number}. kārtas lielajiem punktiem, pēc tam pēc zoles punktiem. Iepriekšējo kārtu punkti sadalījumā netiks summēti.`,
    confirmText: `Izveidot ${nextNumber}. kārtu`,
    onConfirm: () => {
      state.rounds.push(createRound(nextNumber));
      saveState(); renderAll(); setView('round'); showToast(`${nextNumber}. kārta izveidota`);
    }
  });
});

refs.printBtn.addEventListener('click', () => {
  buildPrintReport();
  const oldTitle = document.title;
  document.title = `${fileSafe(state.tournament.name)}_${new Date().toISOString().slice(0,10)}`;
  document.body.classList.add('printing');
  setTimeout(() => window.print(), 80);
  const cleanup = () => {
    document.body.classList.remove('printing');
    document.title = oldTitle;
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  setTimeout(cleanup, 30000);
});

refs.exportJsonBtn.addEventListener('click', () => {
  downloadBlob(JSON.stringify(state, null, 2), `${fileSafe(state.tournament.name)}_dati.json`, 'application/json');
  showToast('Datu kopija lejupielādēta');
});

refs.importJsonBtn.addEventListener('click', () => refs.importJsonFile.click());
refs.importJsonFile.addEventListener('change', async () => {
  const file = refs.importJsonFile.files?.[0];
  refs.importJsonFile.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.players) || !Array.isArray(parsed.rounds)) throw new Error('Nederīgs datu formāts.');
    showModal({
      title: 'Importēt turnīru?', text: 'Pašreizējie dati šajā ierīcē tiks aizstāti ar izvēlētā faila datiem.', confirmText: 'Importēt', danger: true,
      onConfirm: () => { state = parsed; saveState(); renderAll(); setView('registration'); showToast('Dati importēti'); }
    });
  } catch (error) {
    showToast(`Importēšana neizdevās: ${error.message}`);
  }
});

refs.resetBtn.addEventListener('click', () => {
  showModal({
    title: 'Dzēst visu turnīru?', text: 'Šo darbību nevar atsaukt. Pirms dzēšanas ieteicams lejupielādēt datu rezerves kopiju.', confirmText: 'Dzēst visu', danger: true,
    onConfirm: () => {
      state = emptyState(); saveState(); renderAll(); setView('registration'); showToast('Turnīra dati dzēsti');
    }
  });
});

window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY) { state = loadState(); renderAll(); }
});

renderAll();
