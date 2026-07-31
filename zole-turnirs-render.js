function setView(view) {
  activeView = view;
  document.querySelectorAll('.tab-btn').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  document.querySelectorAll('.view').forEach(section => section.classList.toggle('active', section.id === `view-${view}`));
  if (view === 'leaderboard') renderLeaderboard();
  if (view === 'archive') renderHistory();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderAll() {
  refs.headerTitle.textContent = state.tournament.name || DEFAULT_NAME;
  refs.tournamentName.value = state.tournament.name || DEFAULT_NAME;
  refs.tabPlayers.textContent = `${state.players.length} spēlētāji`;
  renderRegistration();
  renderRound();
  renderLeaderboard();
  renderHistory();
}

function renderRegistration() {
  const started = isTournamentStarted();
  const current = getCurrentRound();
  refs.registrationFormCard.classList.toggle('hidden', started);
  refs.startTournamentBtn.disabled = started || !getTableSizes(state.players.length);
  refs.startTournamentBtn.textContent = started ? 'Turnīrs ir sākts' : 'Sākt 1. kārtu';
  refs.startHelp.textContent = started
    ? `Reģistrācija ir slēgta. Pašlaik: ${current.number}. kārta.`
    : state.players.length < 3
      ? 'Nepieciešami vismaz 3 spēlētāji.'
      : tablePlanText(state.players.length);
  refs.startHelp.className = `notice ${!started && getTableSizes(state.players.length) ? 'success' : ''}`;
  refs.playersSubtitle.textContent = state.players.length
    ? `${state.players.length} spēlētāji. ${started ? 'Reģistrācija slēgta.' : tablePlanText(state.players.length)}`
    : 'Nav reģistrētu spēlētāju.';

  if (!state.players.length) {
    refs.playerList.innerHTML = '<div class="empty-state">Pievieno pirmo spēlētāju.</div>';
  } else {
    refs.playerList.innerHTML = state.players
      .sort((a,b) => a.registrationNo - b.registrationNo)
      .map(player => `
        <div class="player-row">
          <div class="player-no">${player.registrationNo}</div>
          <div><div class="player-name">${escapeHtml(player.name)}</div><div class="player-time">${formatDateTime(player.registeredAt)}</div></div>
          ${started ? '' : `<button class="icon-btn" data-remove-player="${player.id}" aria-label="Dzēst ${escapeHtml(player.name)}">×</button>`}
        </div>`).join('');
  }

  refs.registrationNotice.classList.add('hidden');
  refs.headerStatus.textContent = !started ? 'Reģistrācija' : current.finalized ? `${current.number}. kārta pabeigta` : `${current.number}. kārta aktīva`;
  refs.tabRound.textContent = !started ? 'Nav sākta' : `${current.number}. kārta`;
}

function renderRound() {
  const round = getCurrentRound();
  refs.roundEmpty.classList.toggle('hidden', !!round);
  refs.roundContent.classList.toggle('hidden', !round);
  if (!round) return;

  const completed = round.tables.filter(table => evaluateTable(table).valid).length;
  refs.metricRound.textContent = round.number;
  refs.metricTables.textContent = round.tables.length;
  refs.metricCompleted.textContent = `${completed}/${round.tables.length}`;
  refs.roundTitle.textContent = `${round.number}. kārta`;
  refs.roundDescription.textContent = round.number === 1
    ? 'Sadalījums reģistrācijas secībā.'
    : `Sadalījums pēc ${round.number - 1}. kārtas lielajiem punktiem un pēc tam zoles punktiem.`;
  refs.finishRoundBtn.classList.toggle('hidden', round.finalized);
  refs.finishRoundBtn.disabled = !roundValid(round);
  refs.nextRoundBtn.classList.toggle('hidden', !round.finalized);
  refs.roundNotice.classList.toggle('hidden', roundValid(round) || round.finalized);
  refs.roundNotice.textContent = 'Lai pabeigtu kārtu, visiem galdiem jābūt aizpildītiem un katra galda zoles punktu summai jābūt 0.';
  if (round.finalized) {
    refs.roundNotice.classList.remove('hidden');
    refs.roundNotice.className = 'notice success';
    refs.roundNotice.textContent = `Kārta pabeigta ${formatDateTime(round.finalizedAt)}. Vari izveidot nākamo kārtu.`;
  } else {
    refs.roundNotice.className = 'notice';
  }

  refs.tablesGrid.innerHTML = round.tables.map(table => renderGameTable(round, table)).join('');
}

function getTableUi(evaluation) {
  const stateClass = evaluation.valid ? 'valid' : evaluation.complete ? 'invalid' : '';
  const status = evaluation.valid ? 'Gatavs' : evaluation.complete ? 'Kļūda' : 'Jāaizpilda';
  let footClass = '';
  let foot = 'Ievadi visu spēlētāju zoles punktus.';
  if (evaluation.complete && evaluation.sum !== 0) {
    footClass = 'bad';
    foot = `Punktu summa ir ${evaluation.sum}. Tai jābūt 0.`;
  }
  if (evaluation.valid) {
    footClass = 'good';
    foot = 'Galds aizpildīts pareizi. Punktu summa: 0.';
  }
  return { stateClass, status, footClass, foot };
}

function renderGameTable(round, table) {
  const evaluation = evaluateTable(table);
  const ui = getTableUi(evaluation);

  return `
    <article class="game-table ${ui.stateClass}" data-game-table="${table.id}">
      <div class="table-head"><h3>${table.number}. galds</h3><span class="table-state">${ui.status} · ${table.playerIds.length} spēlētāji</span></div>
      <div class="score-head"><span>Spēlētājs</span><span>Zoles punkti</span><span>Lielie</span></div>
      ${table.playerIds.map((playerId, index) => {
        const player = getPlayer(playerId);
        const value = table.scores[playerId]?.small ?? '';
        const valueText = String(value);
        const negative = valueText.startsWith('-');
        const big = evaluation.big ? evaluation.big[index] : '—';
        return `<div class="score-row">
          <div class="score-name">${escapeHtml(player.name)}<small>Reģ. Nr. ${player.registrationNo}</small></div>
          <div class="score-control">
            <button class="sign-btn ${negative ? 'active' : ''}" type="button" data-toggle-sign data-round-id="${round.id}" data-table-id="${table.id}" data-player-id="${playerId}" aria-label="Pārslēgt mīnusa zīmi ${escapeHtml(player.name)} rezultātam" aria-pressed="${negative}" ${round.finalized ? 'disabled' : ''}>−</button>
            <input class="score-input ${evaluation.complete && evaluation.sum !== 0 ? 'invalid' : ''}" type="text" inputmode="numeric" pattern="-?[0-9]*" autocomplete="off" enterkeyhint="next" value="${escapeHtml(valueText)}" data-score-input data-round-id="${round.id}" data-table-id="${table.id}" data-player-id="${playerId}" ${round.finalized ? 'disabled' : ''} aria-label="${escapeHtml(player.name)} zoles punkti">
          </div>
          <div class="big-score" data-big-score="${playerId}">${big}</div>
        </div>`;
      }).join('')}
      <div class="table-foot ${ui.footClass}">${ui.foot}</div>
    </article>`;
}

function refreshTableUi(round, table) {
  const card = refs.tablesGrid.querySelector(`[data-game-table="${table.id}"]`);
  if (!card) return;

  const evaluation = evaluateTable(table);
  const ui = getTableUi(evaluation);
  card.classList.toggle('valid', evaluation.valid);
  card.classList.toggle('invalid', evaluation.complete && !evaluation.valid);
  card.querySelector('.table-state').textContent = `${ui.status} · ${table.playerIds.length} spēlētāji`;

  table.playerIds.forEach((playerId, index) => {
    const bigCell = card.querySelector(`[data-big-score="${playerId}"]`);
    if (bigCell) bigCell.textContent = evaluation.big ? evaluation.big[index] : '—';
    const input = card.querySelector(`[data-score-input][data-player-id="${playerId}"]`);
    const sign = card.querySelector(`[data-toggle-sign][data-player-id="${playerId}"]`);
    if (input) input.classList.toggle('invalid', evaluation.complete && evaluation.sum !== 0);
    if (sign && input) {
      const negative = input.value.trim().startsWith('-');
      sign.classList.toggle('active', negative);
      sign.setAttribute('aria-pressed', String(negative));
    }
  });

  const foot = card.querySelector('.table-foot');
  foot.className = `table-foot ${ui.footClass}`.trim();
  foot.textContent = ui.foot;

  const completed = round.tables.filter(item => evaluateTable(item).valid).length;
  refs.metricCompleted.textContent = `${completed}/${round.tables.length}`;
  refs.finishRoundBtn.disabled = !roundValid(round);
  refs.roundNotice.className = roundValid(round) ? 'notice hidden' : 'notice';
  refs.roundNotice.textContent = 'Lai pabeigtu kārtu, visiem galdiem jābūt aizpildītiem un katra galda zoles punktu summai jābūt 0.';
  renderLeaderboard();
}

function renderLeaderboard() {
  const { rows, hasDraftScores } = getLeaderboard(true);
  const hasAny = rows.some(row => row.rounds > 0);
  refs.leaderboardEmpty.classList.toggle('hidden', hasAny || !state.players.length);
  refs.provisionalBadge.classList.toggle('hidden', !hasDraftScores);
  if (!state.players.length) {
    refs.leaderboardBody.innerHTML = '';
    refs.leaderboardEmpty.textContent = 'Pagaidām nav reģistrētu spēlētāju.';
    refs.leaderboardEmpty.classList.remove('hidden');
    return;
  }
  refs.leaderboardBody.innerHTML = rows.map(row => `
    <tr>
      <td><span class="rank-badge">${row.place}</span></td>
      <td><span class="leader-name">${escapeHtml(row.name)}</span><br><small style="color:var(--muted)">Reģ. Nr. ${row.registrationNo}</small></td>
      <td class="score-strong"><span class="mobile-score-label">Lielie</span>${row.big}</td>
      <td class="${row.small < 0 ? 'score-negative' : ''}"><span class="mobile-score-label">Zoles</span>${row.small}</td>
      <td>${row.rounds}</td>
    </tr>`).join('');
}

function renderHistory() {
  if (!state.rounds.length) {
    refs.historyList.innerHTML = '<div class="empty-state">Nav nevienas kārtas.</div>';
    return;
  }
  refs.historyList.innerHTML = [...state.rounds].reverse().map(round => `
    <details class="history-round" ${round === getCurrentRound() ? 'open' : ''}>
      <summary><span>${round.number}. kārta</span><span>${round.finalized ? 'Pabeigta' : 'Aktīva'} · ${round.tables.length} galdi</span></summary>
      <div class="history-content">
        ${round.tables.map(table => {
          const evaluation = evaluateTable(table);
          return `<div class="history-table"><h4>${table.number}. galds</h4>
            ${table.playerIds.map((playerId, index) => `<div class="history-score">
              <span>${escapeHtml(getPlayer(playerId)?.name || 'Nezināms')}</span>
              <span>${evaluation.values[index] ?? '—'}</span>
              <span>${evaluation.big?.[index] ?? '—'}</span>
            </div>`).join('')}
          </div>`;
        }).join('')}
      </div>
    </details>`).join('');
}
