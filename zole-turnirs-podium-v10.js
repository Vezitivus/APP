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
  }

  const baseRenderLeaderboard = renderLeaderboard;
  renderLeaderboard = function renderLeaderboardWithPodium() {
    baseRenderLeaderboard();
    renderPodium();
  };

  renderPodium();
})();
