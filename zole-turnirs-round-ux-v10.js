'use strict';

(() => {
  let pendingRoundReveal = null;

  function decorateTableStatus(card, table) {
    if (!card || !table) return;
    const evaluation = evaluateTable(table);
    const missing = evaluation.values.filter(value => !Number.isFinite(value)).length;
    const status = card.querySelector('.table-state');
    const foot = card.querySelector('.table-foot');

    card.classList.remove('event-table-ready', 'event-table-error', 'event-table-pending');
    if (evaluation.valid) {
      card.classList.add('event-table-ready');
      if (status) status.textContent = `GATAVS · ${table.playerIds.length} spēlētāji`;
      if (foot) {
        foot.className = 'table-foot good event-table-message';
        foot.textContent = 'Galds gatavs · punktu summa 0.';
      }
      return;
    }

    if (evaluation.complete) {
      card.classList.add('event-table-error');
      const sum = Number(evaluation.sum) || 0;
      const correction = Math.abs(sum);
      const action = sum > 0 ? `jāsamazina par ${correction}` : `jāpalielina par ${correction}`;
      const signed = sum > 0 ? `+${sum}` : `${sum}`;
      if (status) status.textContent = `JĀLABO · SUMMA ${signed}`;
      if (foot) {
        foot.className = 'table-foot bad event-table-message';
        foot.textContent = `Summa ${signed}. Lai sasniegtu 0, kopējais rezultāts ${action}.`;
      }
      return;
    }

    card.classList.add('event-table-pending');
    const completed = table.playerIds.length - missing;
    if (status) status.textContent = `GAIDA · ${completed}/${table.playerIds.length} ievadīti`;
    if (foot) {
      foot.className = 'table-foot event-table-message';
      foot.textContent = missing === 1
        ? 'Vēl jāievada 1 spēlētāja rezultāts.'
        : `Vēl jāievada ${missing} spēlētāju rezultāti.`;
    }
  }

  function enhanceRoundTables() {
    const round = getCurrentRound();
    if (!round) return;
    round.tables.forEach(table => {
      const card = refs.tablesGrid.querySelector(`[data-game-table="${table.id}"]`);
      decorateTableStatus(card, table);
    });
  }

  function playRoundReveal(roundNumber) {
    document.getElementById('roundRevealOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'roundRevealOverlay';
    overlay.className = 'round-reveal-overlay';
    overlay.innerHTML = `<div><small>JAUNS SADALĪJUMS</small><strong>${roundNumber}. KĀRTA</strong><span>Spēlētāji ieņem vietas pie galdiem</span></div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    // Paziņojums paliek redzams pilnas 4 sekundes. Tikai pēc tam sākas galdu atklāšana.
    setTimeout(() => {
      overlay.classList.add('leave');
      [...refs.tablesGrid.querySelectorAll('.game-table')].forEach((card, index) => {
        card.classList.remove('round-card-enter');
        card.style.setProperty('--round-enter-delay', `${index * 90}ms`);
        requestAnimationFrame(() => card.classList.add('round-card-enter'));
      });
      setTimeout(() => overlay.remove(), 650);
    }, 4000);
  }

  const baseRenderRound = renderRound;
  renderRound = function renderRoundWithEventStatus() {
    baseRenderRound();
    enhanceRoundTables();
  };

  const baseRefreshTableUi = refreshTableUi;
  refreshTableUi = function refreshTableUiWithEventStatus(round, table) {
    baseRefreshTableUi(round, table);
    const card = refs.tablesGrid.querySelector(`[data-game-table="${table.id}"]`);
    decorateTableStatus(card, table);
  };

  const baseCreateRound = createRound;
  createRound = function createRoundWithReveal(number) {
    const round = baseCreateRound(number);
    pendingRoundReveal = { id: round.id, number: round.number };
    return round;
  };

  const baseSetView = setView;
  setView = function setViewWithRoundReveal(view) {
    baseSetView(view);
    if (view === 'round' && pendingRoundReveal) {
      const reveal = pendingRoundReveal;
      pendingRoundReveal = null;
      setTimeout(() => playRoundReveal(reveal.number), 40);
    }
  };

  enhanceRoundTables();
})();
