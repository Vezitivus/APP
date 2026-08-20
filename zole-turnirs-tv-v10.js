'use strict';

(() => {
  const ROTATE_MS = 7500;
  let timer = null;
  let slideIndex = 0;

  function standingsBeforeCurrentRound() {
    const current = getCurrentRound();
    if (!current || current.number <= 1) return [];

    const totals = new Map(state.players.map(player => [player.id, {
      id: player.id,
      name: player.name,
      registrationNo: player.registrationNo,
      big: 0,
      small: 0,
      rounds: 0
    }]));

    state.rounds
      .filter(round => round.number < current.number && round.finalized)
      .forEach(round => round.tables.forEach(table => {
        const evaluation = evaluateTable(table);
        table.playerIds.forEach((playerId, index) => {
          const row = totals.get(playerId);
          if (!row || !evaluation.big) return;
          row.big += evaluation.big[index];
          row.small += evaluation.values[index];
          row.rounds += 1;
        });
      }));

    const rows = [...totals.values()]
      .filter(row => row.rounds > 0)
      .sort((a, b) => b.big - a.big || b.small - a.small || a.registrationNo - b.registrationNo);

    rows.forEach((row, index) => {
      const previous = rows[index - 1];
      row.place = previous && previous.big === row.big && previous.small === row.small ? previous.place : index + 1;
    });
    return rows;
  }

  function slides() {
    const rows = getLeaderboard(true).rows.filter(row => Number(row.rounds) > 0);
    const current = getCurrentRound();
    const previous = standingsBeforeCurrentRound();
    const previousById = new Map(previous.map(row => [row.id, row]));
    const movers = rows
      .map(row => ({ ...row, delta: previousById.has(row.id) ? previousById.get(row.id).place - row.place : null }))
      .filter(row => Number(row.delta) > 0)
      .sort((a, b) => b.delta - a.delta || a.place - b.place)
      .slice(0, 8);

    const topHtml = rows.length ? `<div class="tv-top-list">${rows.slice(0, 10).map(row => `
      <div class="tv-top-row">
        <span class="tv-rank">${row.place}</span>
        <strong>${escapeHtml(row.name)}</strong>
        <span>${row.big}<small> LP</small></span>
        <span>${row.small}<small> ZP</small></span>
      </div>`).join('')}</div>` : '<div class="tv-empty">Rezultāti vēl nav pieejami.</div>';

    const moversHtml = movers.length ? `<div class="tv-movers">${movers.map(row => `
      <div class="tv-mover"><span>▲ ${row.delta}</span><strong>${escapeHtml(row.name)}</strong><small>tagad ${row.place}. vietā</small></div>`).join('')}</div>` : '<div class="tv-empty">Šajā kārtā vietu kāpumu vēl nav.</div>';

    const roundHtml = current ? `<div class="tv-round-grid">${current.tables.map(table => {
      const evaluation = evaluateTable(table);
      const label = evaluation.valid ? 'GATAVS' : evaluation.complete ? 'JĀLABO' : 'SPĒLĒ';
      const cls = evaluation.valid ? 'ready' : evaluation.complete ? 'error' : 'pending';
      return `<article class="tv-table ${cls}"><div><strong>${table.number}. GALDS</strong><span>${label}</span></div><p>${table.playerIds.map(id => escapeHtml(getPlayer(id)?.name || '—')).join(' · ')}</p></article>`;
    }).join('')}</div>` : '<div class="tv-empty">Kārta vēl nav sākta.</div>';

    const statusHtml = current ? `
      <div class="tv-status-summary"><strong>${current.tables.filter(table => evaluateTable(table).valid).length}/${current.tables.length}</strong><span>galdi gatavi</span></div>
      <div class="tv-status-grid">${current.tables.map(table => {
        const evaluation = evaluateTable(table);
        const missing = evaluation.values.filter(value => !Number.isFinite(value)).length;
        const cls = evaluation.valid ? 'ready' : evaluation.complete ? 'error' : 'pending';
        const label = evaluation.valid ? 'GATAVS · 0' : evaluation.complete ? `JĀLABO · ${evaluation.sum > 0 ? '+' : ''}${evaluation.sum}` : `GAIDA · ${missing}`;
        return `<div class="tv-status-card ${cls}"><strong>${table.number}. galds</strong><span>${label}</span></div>`;
      }).join('')}</div>` : '<div class="tv-empty">Nav aktīvas kārtas.</div>';

    return [
      { title: 'KOPVĒRTĒJUMS · TOP 10', html: topHtml },
      { title: 'LIELĀKIE KĀPUMI', html: moversHtml },
      { title: current ? `${current.number}. KĀRTA · GALDI` : 'AKTUĀLĀ KĀRTA', html: roundHtml },
      { title: 'GALDU STATUSS', html: statusHtml }
    ];
  }

  function renderSlide() {
    const overlay = document.getElementById('eventTvMode');
    if (!overlay) return;
    const allSlides = slides();
    slideIndex %= allSlides.length;
    const slide = allSlides[slideIndex];
    overlay.querySelector('[data-tv-title]').textContent = slide.title;
    const content = overlay.querySelector('[data-tv-content]');
    content.classList.remove('tv-content-enter');
    content.innerHTML = slide.html;
    requestAnimationFrame(() => content.classList.add('tv-content-enter'));
    overlay.querySelectorAll('[data-tv-dot]').forEach((dot, index) => dot.classList.toggle('active', index === slideIndex));
  }

  function restartTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
      slideIndex = (slideIndex + 1) % 4;
      renderSlide();
    }, ROTATE_MS);
  }

  function closeTvMode() {
    clearInterval(timer);
    timer = null;
    document.getElementById('eventTvMode')?.remove();
    document.body.classList.remove('tv-mode-open');
    try {
      if (document.fullscreenElement) document.exitFullscreen?.();
    } catch (_) {}
  }

  function openTvMode() {
    if (document.getElementById('eventTvMode')) return;
    const overlay = document.createElement('div');
    overlay.id = 'eventTvMode';
    overlay.className = 'event-tv-mode';
    overlay.innerHTML = `
      <header class="tv-header">
        <div><small>LIVE TURNĪRS</small><strong>${escapeHtml(state.tournament.name || DEFAULT_NAME)}</strong></div>
        <div class="tv-header-actions"><span data-tv-title></span><button type="button" data-tv-close aria-label="Aizvērt TV režīmu">×</button></div>
      </header>
      <main class="tv-content" data-tv-content></main>
      <footer class="tv-footer">
        <div>${Array.from({ length: 4 }, (_, index) => `<button type="button" data-tv-dot="${index}" aria-label="TV skats ${index + 1}"></button>`).join('')}</div>
        <span>${state.tournament.finishedAt ? 'TURNĪRS NOSLĒGTS' : 'REZULTĀTI ATJAUNOJAS AUTOMĀTISKI'}</span>
      </footer>`;
    document.body.appendChild(overlay);
    document.body.classList.add('tv-mode-open');
    slideIndex = 0;
    renderSlide();
    overlay.querySelector('[data-tv-close]')?.addEventListener('click', closeTvMode);
    overlay.querySelectorAll('[data-tv-dot]').forEach(button => button.addEventListener('click', () => {
      slideIndex = Number(button.dataset.tvDot) || 0;
      renderSlide();
      restartTimer();
    }));
    restartTimer();
    try { document.documentElement.requestFullscreen?.(); } catch (_) {}
  }

  function ensureButton() {
    const card = document.querySelector('#view-leaderboard > .card');
    const head = card?.querySelector('.card-head');
    if (!head) return;
    let button = document.getElementById('tvModeBtn');
    if (!button) {
      button = document.createElement('button');
      button.id = 'tvModeBtn';
      button.type = 'button';
      button.className = 'btn btn-secondary tv-mode-btn';
      button.textContent = 'TV režīms';
      head.appendChild(button);
      button.addEventListener('click', openTvMode);
    }
  }

  const baseRenderAll = renderAll;
  renderAll = function renderAllWithTvButton() {
    baseRenderAll();
    ensureButton();
    if (document.getElementById('eventTvMode')) renderSlide();
  };

  ensureButton();
})();
