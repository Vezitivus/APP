'use strict';

(() => {
  function playerStartRound(player) {
    const value = Number(player?.activeFromRound);
    return Number.isInteger(value) && value > 0 ? value : 1;
  }

  function nextRoundNumber() {
    const current = getCurrentRound();
    if (!current?.finalized || state?.tournament?.finishedAt) return null;
    return current.number + 1;
  }

  function playersForRound(roundNumber) {
    return [...state.players]
      .filter(player => playerStartRound(player) <= roundNumber)
      .sort((a, b) => a.registrationNo - b.registrationNo);
  }

  function pendingPlayers(roundNumber) {
    return [...state.players]
      .filter(player => playerStartRound(player) === roundNumber)
      .sort((a, b) => a.registrationNo - b.registrationNo);
  }

  function ensureCard() {
    let card = document.getElementById('preRoundRegistrationCard');
    if (card) return card;

    const roundNotice = refs.roundNotice;
    if (!roundNotice?.parentNode) return null;

    card = document.createElement('article');
    card.id = 'preRoundRegistrationCard';
    card.className = 'card pre-round-registration-card hidden';
    card.innerHTML = `
      <div class="card-head">
        <h2 id="preRoundRegistrationTitle">Pievienot spēlētāju nākamajai kārtai</h2>
        <p id="preRoundRegistrationHint">Jaunais spēlētājs piedalīsies tikai no nākamās kārtas.</p>
      </div>
      <div class="card-body">
        <form id="preRoundRegistrationForm" class="form-row" autocomplete="off">
          <label>Vārds un uzvārds
            <input id="preRoundPlayerName" type="text" maxlength="80" required placeholder="Ievadi spēlētāja vārdu">
          </label>
          <button class="btn btn-primary" type="submit">Pievienot</button>
        </form>
        <div id="preRoundRegistrationNotice" class="notice hidden"></div>
        <div id="preRoundRegistrationPlayers" class="pre-round-player-list"></div>
        <div id="preRoundRegistrationSummary" class="late-registration-summary"></div>
      </div>`;

    roundNotice.insertAdjacentElement('afterend', card);

    card.querySelector('#preRoundRegistrationForm').addEventListener('submit', event => {
      event.preventDefault();
      const nextRound = nextRoundNumber();
      if (!nextRound) return;

      const input = card.querySelector('#preRoundPlayerName');
      const notice = card.querySelector('#preRoundRegistrationNotice');
      const name = input.value.trim().replace(/\s+/g, ' ');
      if (!name) return;

      if (state.players.some(player => player.name.localeCompare(name, 'lv', { sensitivity: 'base' }) === 0)) {
        notice.textContent = 'Spēlētājs ar šādu vārdu jau ir reģistrēts.';
        notice.className = 'notice danger';
        return;
      }

      const registrationNo = state.players.reduce(
        (max, player) => Math.max(max, Number(player.registrationNo) || 0),
        0
      ) + 1;

      state.players.push({
        id: uid('player'),
        name,
        registrationNo,
        registeredAt: new Date().toISOString(),
        activeFromRound: nextRound
      });

      input.value = '';
      notice.className = 'notice hidden';
      saveState();
      renderAll();
      setView('round');
      showToast(`${name} pievienots ${nextRound}. kārtai`);
      setTimeout(() => document.getElementById('preRoundPlayerName')?.focus(), 0);
    });

    card.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-pre-round-player]');
      if (!button) return;

      const nextRound = nextRoundNumber();
      const player = getPlayer(button.dataset.removePreRoundPlayer);
      if (!nextRound || !player || playerStartRound(player) !== nextRound) return;

      showModal({
        title: 'Noņemt spēlētāju?',
        text: `${player.name} netiks pievienots ${nextRound}. kārtai.`,
        confirmText: 'Noņemt',
        danger: true,
        onConfirm: () => {
          state.players = state.players.filter(item => item.id !== player.id);
          saveState();
          renderAll();
          setView('round');
          showToast('Spēlētājs noņemts');
        }
      });
    });

    return card;
  }

  function renderCard() {
    const card = ensureCard();
    if (!card) return;

    const nextRound = nextRoundNumber();
    card.classList.toggle('hidden', !nextRound);
    if (!nextRound) return;

    const players = playersForRound(nextRound);
    const pending = pendingPlayers(nextRound);
    const sizes = getTableSizes(players.length);

    card.querySelector('#preRoundRegistrationTitle').textContent =
      `Pievienot spēlētāju ${nextRound}. kārtai`;
    card.querySelector('#preRoundRegistrationHint').textContent =
      `Pievienotie spēlētāji sāks turnīru no ${nextRound}. kārtas. Iepriekšējo kārtu punkti viņiem netiks piešķirti.`;

    const list = card.querySelector('#preRoundRegistrationPlayers');
    list.innerHTML = pending.length
      ? pending.map(player => `
          <div class="pre-round-player-row">
            <strong>${escapeHtml(player.name)}</strong>
            <span>No ${nextRound}. kārtas</span>
            <button type="button" class="icon-btn" data-remove-pre-round-player="${player.id}" aria-label="Noņemt ${escapeHtml(player.name)}">×</button>
          </div>`).join('')
      : '';

    const summary = card.querySelector('#preRoundRegistrationSummary');
    summary.className = `late-registration-summary ${sizes ? 'valid' : 'invalid'}`;
    summary.innerHTML = `
      <strong>${nextRound}. kārtā: ${players.length} spēlētāji</strong>
      <span>${sizes ? tablePlanText(players.length) : 'Šo spēlētāju skaitu pašlaik nevar sadalīt derīgos 3 vai 4 spēlētāju galdos.'}</span>`;
  }

  const baseRenderAll = renderAll;
  renderAll = function renderAllWithPreRoundRegistration() {
    baseRenderAll();
    renderCard();
  };

  const baseRenderRound = renderRound;
  renderRound = function renderRoundWithPreRoundRegistration() {
    baseRenderRound();
    renderCard();
  };

  renderCard();
})();
