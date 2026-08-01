'use strict';

(() => {
  function playerStartRound(player) {
    const value = Number(player?.activeFromRound);
    return Number.isInteger(value) && value > 0 ? value : 1;
  }

  function normalizePlayerStartRounds() {
    let changed = false;
    state.players.forEach(player => {
      const normalized = playerStartRound(player);
      if (player.activeFromRound !== normalized) {
        player.activeFromRound = normalized;
        changed = true;
      }
    });
    return changed;
  }

  function playersForRound(roundNumber) {
    return [...state.players]
      .filter(player => playerStartRound(player) <= roundNumber)
      .sort((a, b) => a.registrationNo - b.registrationNo);
  }

  function lateRegistrationRound() {
    const current = getCurrentRound();
    return current?.finalized ? current.number + 1 : null;
  }

  function canRemoveLatePlayer(player) {
    const nextRound = lateRegistrationRound();
    return !!nextRound && playerStartRound(player) === nextRound;
  }

  normalizePlayerStartRounds();

  getPreviousRoundOrder = function getPreviousRoundOrderWithLatePlayers(roundNumber) {
    const eligiblePlayers = playersForRound(roundNumber);
    if (roundNumber === 1) return eligiblePlayers.map(player => player.id);

    const previous = state.rounds.find(round => round.number === roundNumber - 1);
    if (!previous || !previous.finalized) throw new Error('Iepriekšējā kārta nav pabeigta.');

    const previousScores = new Map();
    previous.tables.forEach(table => {
      const evaluation = evaluateTable(table);
      table.playerIds.forEach((playerId, index) => {
        previousScores.set(playerId, {
          big: evaluation.big?.[index] ?? -Infinity,
          small: evaluation.values?.[index] ?? -Infinity
        });
      });
    });

    return eligiblePlayers
      .sort((a, b) => {
        const scoreA = previousScores.get(a.id);
        const scoreB = previousScores.get(b.id);
        if (scoreA && !scoreB) return -1;
        if (!scoreA && scoreB) return 1;
        if (!scoreA && !scoreB) return a.registrationNo - b.registrationNo;
        return scoreB.big - scoreA.big || scoreB.small - scoreA.small || a.registrationNo - b.registrationNo;
      })
      .map(player => player.id);
  };

  getLeaderboard = function getLeaderboardWithJoinRounds(includeDraft = true) {
    const currentRound = getCurrentRound();
    const visiblePlayers = currentRound
      ? state.players.filter(player => playerStartRound(player) <= currentRound.number)
      : state.players;

    const totals = new Map(visiblePlayers.map(player => [player.id, {
      id: player.id,
      name: player.name,
      registrationNo: player.registrationNo,
      activeFromRound: playerStartRound(player),
      big: 0,
      small: 0,
      rounds: 0
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
          if (!row) return;
          row.big += evaluation.big[index];
          row.small += evaluation.values[index];
          row.rounds += 1;
        });
      });
    });

    const sorted = [...totals.values()].sort((a, b) =>
      b.big - a.big || b.small - a.small || a.registrationNo - b.registrationNo
    );
    sorted.forEach((row, index) => {
      const previous = sorted[index - 1];
      row.place = previous && previous.big === row.big && previous.small === row.small
        ? previous.place
        : index + 1;
    });
    return { rows: sorted, hasDraftScores };
  };

  function injectLateRegistrationCard() {
    if (document.getElementById('lateRegistrationCard')) return;
    const anchor = refs.registrationFormCard;
    if (!anchor?.parentNode) return;

    const card = document.createElement('article');
    card.id = 'lateRegistrationCard';
    card.className = 'card late-registration-card hidden';
    card.innerHTML = `
      <div class="card-head">
        <h2 id="lateRegistrationTitle">Pievienot spēlētājus nākamajai kārtai</h2>
        <p id="lateRegistrationHint">Jaunie spēlētāji nākamajā sadalījumā būs aiz visiem iepriekšējās kārtas dalībniekiem.</p>
      </div>
      <div class="card-body">
        <form id="lateRegistrationForm" class="form-row" autocomplete="off">
          <label>Vārds un uzvārds
            <input id="latePlayerName" type="text" maxlength="80" required placeholder="Ievadi spēlētāja vārdu">
          </label>
          <button class="btn btn-primary" type="submit">Pievienot</button>
        </form>
        <div id="lateRegistrationNotice" class="notice hidden"></div>
        <div id="lateRegistrationSummary" class="late-registration-summary"></div>
      </div>`;
    anchor.parentNode.insertBefore(card, anchor.nextSibling);

    card.querySelector('#lateRegistrationForm').addEventListener('submit', event => {
      event.preventDefault();
      const nextRound = lateRegistrationRound();
      if (!nextRound) return;

      const input = card.querySelector('#latePlayerName');
      const notice = card.querySelector('#lateRegistrationNotice');
      const name = input.value.trim().replace(/\s+/g, ' ');
      if (!name) return;
      if (state.players.some(player => player.name.localeCompare(name, 'lv', { sensitivity: 'base' }) === 0)) {
        notice.textContent = 'Spēlētājs ar šādu vārdu jau ir reģistrēts.';
        notice.className = 'notice danger';
        return;
      }

      const nextRegistrationNo = state.players.reduce((max, player) => Math.max(max, Number(player.registrationNo) || 0), 0) + 1;
      state.players.push({
        id: uid('player'),
        name,
        registrationNo: nextRegistrationNo,
        registeredAt: new Date().toISOString(),
        activeFromRound: nextRound
      });
      input.value = '';
      saveState();
      renderAll();
      input.focus();
      showToast(`${name} piedalīsies no ${nextRound}. kārtas`);
    });
  }

  function renderLateRegistrationUi() {
    injectLateRegistrationCard();
    const card = document.getElementById('lateRegistrationCard');
    const nextRound = lateRegistrationRound();
    card?.classList.toggle('hidden', !nextRound);

    const startCard = refs.startTournamentBtn?.closest('.card');
    startCard?.classList.toggle('hidden', isTournamentStarted());

    if (!card || !nextRound) {
      decoratePlayerRows();
      return;
    }

    const pending = state.players
      .filter(player => playerStartRound(player) === nextRound)
      .sort((a, b) => a.registrationNo - b.registrationNo);
    const total = playersForRound(nextRound).length;
    const sizes = getTableSizes(total);

    card.querySelector('#lateRegistrationTitle').textContent = `Pievienot spēlētājus ${nextRound}. kārtai`;
    card.querySelector('#lateRegistrationHint').textContent =
      `Jaunie spēlētāji piedalīsies tikai no ${nextRound}. kārtas un nākamajā sadalījumā būs aiz visiem ${nextRound - 1}. kārtas dalībniekiem.`;

    const summary = card.querySelector('#lateRegistrationSummary');
    summary.className = `late-registration-summary ${sizes ? 'valid' : 'invalid'}`;
    summary.innerHTML = `
      <strong>${pending.length ? `${pending.length} jauni spēlētāji` : 'Jauni spēlētāji vēl nav pievienoti'}</strong>
      <span>${nextRound}. kārtā kopā būs ${total} spēlētāji. ${sizes ? tablePlanText(total) : 'Šo skaitu pašlaik nevar sadalīt derīgos galdos.'}</span>`;

    decoratePlayerRows();
  }

  function decoratePlayerRows() {
    const rows = [...refs.playerList.querySelectorAll('.player-row')];
    const players = [...state.players].sort((a, b) => a.registrationNo - b.registrationNo);
    rows.forEach((row, index) => {
      const player = players[index];
      if (!player) return;
      row.querySelectorAll('.join-round-badge,[data-remove-late-player]').forEach(element => element.remove());

      const startRound = playerStartRound(player);
      if (startRound > 1) {
        const badge = document.createElement('div');
        badge.className = 'join-round-badge';
        badge.textContent = `No ${startRound}. kārtas`;
        row.children[1]?.appendChild(badge);
      }

      if (canRemoveLatePlayer(player)) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'icon-btn';
        button.dataset.removeLatePlayer = player.id;
        button.setAttribute('aria-label', `Dzēst ${player.name}`);
        button.textContent = '×';
        row.appendChild(button);
      }
    });
  }

  refs.playerList.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-late-player]');
    if (!button) return;
    const player = getPlayer(button.dataset.removeLatePlayer);
    if (!player || !canRemoveLatePlayer(player)) return;

    showModal({
      title: 'Noņemt jauno spēlētāju?',
      text: `${player.name} nepiedalīsies ${playerStartRound(player)}. kārtā. Iepriekšējo kārtu rezultāti netiks mainīti.`,
      confirmText: 'Noņemt',
      danger: true,
      onConfirm: () => {
        const removedNo = player.registrationNo;
        const startRound = playerStartRound(player);
        state.players = state.players.filter(item => item.id !== player.id);
        state.players
          .filter(item => playerStartRound(item) === startRound && item.registrationNo > removedNo)
          .forEach(item => { item.registrationNo -= 1; });
        saveState();
        renderAll();
        showToast('Jaunais spēlētājs noņemts');
      }
    });
  });

  function updateNextRoundUi() {
    const round = getCurrentRound();
    if (!round?.finalized) return;

    const nextRound = round.number + 1;
    const playerCount = playersForRound(nextRound).length;
    const validPlan = getTableSizes(playerCount);
    refs.nextRoundBtn.disabled = !validPlan;
    refs.roundNotice.classList.remove('hidden');
    refs.roundNotice.className = `notice ${validPlan ? 'success' : 'danger'}`;
    refs.roundNotice.textContent = validPlan
      ? `${nextRound}. kārtai gatavi ${playerCount} spēlētāji. ${tablePlanText(playerCount)} Jaunos spēlētājus vari pievienot sadaļā “Reģistrācija”.`
      : `${nextRound}. kārtā pašlaik būtu ${playerCount} spēlētāji, kurus nevar sadalīt derīgos galdos. Pievieno vai noņem jaunos spēlētājus sadaļā “Reģistrācija”.`;
  }

  const baseBuildPrintReport = buildPrintReport;
  buildPrintReport = function buildPrintReportWithJoinRound() {
    baseBuildPrintReport();
    const players = [...state.players].sort((a, b) => a.registrationNo - b.registrationNo);
    let playerIndex = 0;

    [...refs.printReport.querySelectorAll('.pdf-page')].forEach(page => {
      const heading = page.querySelector('.pdf-section-heading h2');
      if (heading?.textContent.trim() !== 'REĢISTRĀCIJA') return;
      const table = page.querySelector('.pdf-content .pdf-table');
      if (!table) return;
      table.classList.add('pdf-registration-table');

      const headRow = table.querySelector('thead tr');
      if (headRow && !headRow.querySelector('[data-join-round-heading]')) {
        const th = document.createElement('th');
        th.dataset.joinRoundHeading = 'true';
        th.textContent = 'NO KĀRTAS';
        headRow.appendChild(th);
      }

      [...table.querySelectorAll('tbody tr')].forEach(row => {
        const player = players[playerIndex++];
        if (!player) return;
        const cell = document.createElement('td');
        cell.className = 'pdf-join-round';
        cell.textContent = `${playerStartRound(player)}. KĀRTA`;
        row.appendChild(cell);
      });
    });
  };

  const baseRenderAll = renderAll;
  renderAll = function renderAllWithLateRegistration() {
    const normalized = normalizePlayerStartRounds();
    if (normalized) saveState();
    baseRenderAll();
    renderLateRegistrationUi();
    updateNextRoundUi();
  };

  renderAll();
})();
