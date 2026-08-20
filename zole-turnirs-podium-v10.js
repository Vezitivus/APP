'use strict';

(() => {
  function meaningfulRows() {
    return getLeaderboard(true).rows.filter(row => Number(row.rounds) > 0);
  }

  function podiumHtml(rows) {
    const top = rows.slice(0, 3);
    if (!top.length) return '';
    return [1, 0, 2].filter(index => top[index]).map(index => {
      const row = top[index];
      const rank = index + 1;
      return `<article class="event-podium-card rank-${rank}">
        <div class="event-podium-rank">${rank}</div>
        <div class="event-podium-name">${escapeHtml(row.name)}</div>
        <div class="event-podium-points"><strong>${row.big}</strong><span>lielie</span><strong>${row.small}</strong><span>zoles</span></div>
      </article>`;
    }).join('');
  }

  function trimTopThreeFromTable(topRows) {
    const wrap = document.querySelector('#view-leaderboard .leaderboard-wrap');
    if (!wrap) return;

    const topIds = new Set(topRows.slice(0, 3).map(row => row.id));
    [...refs.leaderboardBody.querySelectorAll('tr')].forEach(row => {
      if (topIds.has(row.dataset.playerId)) row.remove();
    });

    const hasRemainingRows = refs.leaderboardBody.querySelector('tr');
    wrap.classList.toggle('podium-followup', Boolean(topRows.length && hasRemainingRows));
    wrap.classList.toggle('hidden', Boolean(topRows.length && !hasRemainingRows));
  }

  function renderPodium() {
    const card = document.querySelector('#view-leaderboard > .card');
    const wrap = card?.querySelector('.leaderboard-wrap');
    if (!card || !wrap) return;

    let podium = card.querySelector('#eventPodium');
    if (!podium) {
      podium = document.createElement('div');
      podium.id = 'eventPodium';
      podium.className = 'event-podium-wrap hidden';
      wrap.insertAdjacentElement('beforebegin', podium);
    }

    const rows = meaningfulRows();
    podium.classList.toggle('hidden', rows.length === 0);
    podium.innerHTML = rows.length ? `<div class="event-podium">${podiumHtml(rows)}</div>` : '';

    if (rows.length) trimTopThreeFromTable(rows);
    else {
      wrap.classList.remove('podium-followup', 'hidden');
    }
  }

  const baseRenderLeaderboard = renderLeaderboard;
  renderLeaderboard = function renderLeaderboardWithPodium() {
    baseRenderLeaderboard();
    renderPodium();
  };

  renderLeaderboard();
})();
