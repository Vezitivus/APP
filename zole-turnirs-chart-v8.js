'use strict';

(() => {
  const SNAPSHOT_KEY = 'zoleLeaderboardViewed.v2';
  const ANIMATION_MS = 2000;

  function tournamentKey() {
    return String(state?.tournament?.createdAt || 'default');
  }

  function currentRows() {
    return getLeaderboard(true).rows.map(row => ({
      id: row.id,
      place: row.place,
      big: row.big,
      small: row.small,
      rounds: row.rounds,
      registrationNo: row.registrationNo
    }));
  }

  function meaningful(rows) {
    return rows.some(row => Number(row.rounds) > 0);
  }

  function signature(rows) {
    return rows.map(row => `${row.id}:${row.place}:${row.big}:${row.small}:${row.rounds}`).join('|');
  }

  function loadSnapshot() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || 'null');
      if (!parsed || parsed.tournamentKey !== tournamentKey() || !Array.isArray(parsed.rows)) return null;
      return parsed.rows;
    } catch (_) {
      return null;
    }
  }

  function saveSnapshot(rows) {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ tournamentKey: tournamentKey(), rows }));
    } catch (_) {}
  }

  function decorateRows(rows) {
    const domRows = [...refs.leaderboardBody.querySelectorAll('tr')];
    domRows.forEach((tr, index) => {
      const row = rows[index];
      if (!row) return;
      tr.dataset.playerId = row.id;
    });
    return domRows;
  }

  function addMovementBadge(tr, previous, current) {
    tr.querySelectorAll('.chart-move').forEach(node => node.remove());
    if (!previous) return;

    const delta = Number(previous.place) - Number(current.place);
    if (!delta) return;

    const badge = document.createElement('span');
    badge.className = `chart-move ${delta > 0 ? 'up' : 'down'}`;
    badge.textContent = delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`;
    const name = tr.querySelector('.leader-name');
    if (name) name.insertAdjacentElement('afterend', badge);

    tr.classList.toggle('chart-row-up', delta > 0);
    tr.classList.toggle('chart-row-down', delta < 0);
  }

  function animateLeaderboard(previousRows, rows) {
    const domRows = decorateRows(rows);
    if (!domRows.length) return;

    const previousById = new Map(previousRows.map((row, index) => [row.id, { ...row, index }]));
    const rects = domRows.map(row => row.getBoundingClientRect());
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    domRows.forEach((tr, newIndex) => {
      const current = rows[newIndex];
      const previous = previousById.get(current.id);
      addMovementBadge(tr, previous, current);
      if (!previous || reduceMotion) return;

      const oldIndex = Math.max(0, Math.min(previous.index, rects.length - 1));
      const deltaY = rects[oldIndex].top - rects[newIndex].top;
      if (Math.abs(deltaY) < 1) return;

      tr.classList.add('chart-row-moving');
      const animation = tr.animate([
        { transform: `translateY(${deltaY}px)`, opacity: 0.76 },
        { transform: 'translateY(0)', opacity: 1 }
      ], {
        duration: ANIMATION_MS,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'both'
      });

      animation.finished.finally(() => {
        tr.classList.remove('chart-row-moving');
        try { animation.cancel(); } catch (_) {}
      });
    });

    window.setTimeout(() => {
      domRows.forEach(tr => tr.classList.remove('chart-row-up', 'chart-row-down'));
    }, ANIMATION_MS + 250);
  }

  const baseRenderLeaderboard = renderLeaderboard;
  renderLeaderboard = function renderLeaderboardWithChartIds() {
    baseRenderLeaderboard();
    decorateRows(currentRows());
  };

  function handleResultsOpen() {
    requestAnimationFrame(() => {
      renderLeaderboard();
      const rows = currentRows();
      if (!meaningful(rows)) return;

      const previousRows = loadSnapshot();
      if (!previousRows) {
        saveSnapshot(rows);
        return;
      }

      if (signature(previousRows) === signature(rows)) return;

      saveSnapshot(rows); // mark this change as viewed immediately, so it never replays on the next open
      requestAnimationFrame(() => animateLeaderboard(previousRows, rows));
    });
  }

  const resultsTab = document.querySelector('.tab-btn[data-view="leaderboard"]');
  resultsTab?.addEventListener('click', handleResultsOpen);

  decorateRows(currentRows());
})();
