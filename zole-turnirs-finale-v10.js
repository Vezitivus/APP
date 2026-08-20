'use strict';

(() => {
  function isFinished() {
    return Boolean(state?.tournament?.finishedAt);
  }

  function topRows() {
    return getLeaderboard(true).rows.filter(row => Number(row.rounds) > 0).slice(0, 3);
  }

  function finalePodiumHtml() {
    const top = topRows();
    return [1, 0, 2].filter(index => top[index]).map(index => {
      const row = top[index];
      const rank = index + 1;
      return `<article class="finale-place rank-${rank}">
        <span>${rank}. VIETA</span>
        <strong>${escapeHtml(row.name)}</strong>
        <small>${row.big} lielie · ${row.small} zoles</small>
      </article>`;
    }).join('');
  }

  function enforceFinishedUi() {
    const round = getCurrentRound();
    const actionRow = refs.nextRoundBtn?.closest('.action-row');
    if (!actionRow) return;

    let button = document.getElementById('finishTournamentBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'finishTournamentBtn';
      button.type = 'button';
      button.className = 'btn btn-finish-tournament hidden';
      button.textContent = 'Noslēgt turnīru';
      actionRow.appendChild(button);
      button.addEventListener('click', confirmFinish);
    }

    const canFinish = Boolean(round?.finalized) && !isFinished();
    button.classList.toggle('hidden', !canFinish);

    if (isFinished()) {
      refs.nextRoundBtn.classList.add('hidden');
      const lateCard = document.getElementById('lateRegistrationCard');
      lateCard?.classList.add('hidden');
      refs.headerStatus.textContent = 'Turnīrs noslēgts';
      refs.roundNotice.classList.remove('hidden');
      refs.roundNotice.className = 'notice success';
      refs.roundNotice.textContent = `Turnīrs noslēgts ${formatDateTime(state.tournament.finishedAt)}.`;
    }
  }

  function confirmFinish() {
    const round = getCurrentRound();
    if (!round?.finalized || isFinished()) return;
    showModal({
      title: 'Noslēgt turnīru?',
      text: 'Kopvērtējums tiks fiksēts kā gala rezultāts. Jauna kārta pēc noslēgšanas vairs netiks piedāvāta.',
      confirmText: 'Noslēgt turnīru',
      onConfirm: () => {
        state.tournament.finishedAt = new Date().toISOString();
        saveState();
        renderAll();
        showFinale();
      }
    });
  }

  function showFinale() {
    document.getElementById('eventFinale')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'eventFinale';
    overlay.className = 'event-finale';
    overlay.innerHTML = `
      <div class="event-finale-inner">
        <div class="event-finale-kicker">${escapeHtml(state.tournament.name || DEFAULT_NAME)}</div>
        <h2>TURNĪRS NOSLĒGTS</h2>
        <p>${formatDateTime(state.tournament.finishedAt || new Date().toISOString())}</p>
        <div class="finale-podium">${finalePodiumHtml()}</div>
        <div class="event-finale-actions">
          <button type="button" class="btn btn-primary" data-finale-results>Skatīt rezultātus</button>
          <button type="button" class="btn btn-secondary" data-finale-pdf>PDF rezultāti</button>
          <button type="button" class="btn btn-ghost" data-finale-close>Aizvērt</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    overlay.querySelector('[data-finale-results]')?.addEventListener('click', () => {
      overlay.remove();
      setView('leaderboard');
    });
    overlay.querySelector('[data-finale-pdf]')?.addEventListener('click', () => refs.printBtn.click());
    overlay.querySelector('[data-finale-close]')?.addEventListener('click', () => overlay.remove());
  }

  function ensureReplayButton() {
    const card = document.querySelector('#view-leaderboard > .card');
    const head = card?.querySelector('.card-head');
    if (!head) return;
    let button = document.getElementById('replayFinaleBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'replayFinaleBtn';
      button.type = 'button';
      button.className = 'btn btn-secondary finale-replay-btn hidden';
      button.textContent = 'Noslēguma ceremonija';
      head.appendChild(button);
      button.addEventListener('click', showFinale);
    }
    button.classList.toggle('hidden', !isFinished());
  }

  const baseRenderRound = renderRound;
  renderRound = function renderRoundWithFinaleLock() {
    baseRenderRound();
    enforceFinishedUi();
  };

  const baseRenderAll = renderAll;
  renderAll = function renderAllWithFinale() {
    baseRenderAll();
    enforceFinishedUi();
    ensureReplayButton();
  };

  enforceFinishedUi();
  ensureReplayButton();
})();
