'use strict';

(() => {
  const LEADERBOARD_ROWS_PER_PAGE = 24;
  const REGISTRATION_ROWS_PER_PAGE = 30;
  const ROUND_TABLES_PER_PAGE = 10;

  function chunks(items, size) {
    const result = [];
    for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
    return result.length ? result : [[]];
  }

  function safeLogo() {
    const value = state?.tournament?.logoDataUrl;
    return typeof value === 'string' && /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value)
      ? value.replace(/"/g, '&quot;')
      : '';
  }

  function startRound(player) {
    const value = Number(player?.activeFromRound);
    return Number.isInteger(value) && value > 0 ? value : 1;
  }

  function fitClass(name) {
    const length = String(name || '').trim().replace(/\s+/g, ' ').length;
    if (length > 22) return 'pdf-name-fit-xxlong';
    if (length > 17) return 'pdf-name-fit-xlong';
    if (length > 12) return 'pdf-name-fit-long';
    return 'pdf-name-fit-normal';
  }

  function reportHeader(kicker) {
    const logo = safeLogo();
    const title = escapeHtml((state.tournament.name || DEFAULT_NAME).toLocaleUpperCase('lv-LV'));
    return `
      <header class="pdf-header">
        <div class="pdf-title-lockup">
          <span class="pdf-slash" aria-hidden="true"></span>
          <div>
            <div class="pdf-kicker">${escapeHtml(kicker)}</div>
            <h1>${title}</h1>
          </div>
        </div>
        ${logo ? `<img class="pdf-logo" src="${logo}" alt="Turnīra logo">` : ''}
      </header>
      <div class="pdf-accent-lines" aria-hidden="true"><span></span><span></span></div>`;
  }

  function reportFooter(label, generatedAt, pageNo, totalPages) {
    return `
      <footer class="pdf-footer">
        <span>${escapeHtml(label)}</span>
        <span>LAPA ${pageNo}/${totalPages} · ${formatDateTime(generatedAt)}</span>
      </footer>`;
  }

  function leaderboardTable(rows) {
    const body = rows.length ? rows.map(row => {
      const name = row.name || '';
      return `
        <tr>
          <td class="pdf-place">${row.place}.</td>
          <td class="pdf-name ${fitClass(name)}">${escapeHtml(name.toLocaleUpperCase('lv-LV'))}</td>
          <td class="pdf-small-score">${row.small}</td>
          <td class="pdf-big-score">${row.big}</td>
        </tr>`;
    }).join('') : '<tr><td colspan="4" class="pdf-empty">Pagaidām nav rezultātu.</td></tr>';

    return `
      <table class="pdf-table pdf-leaderboard-table">
        <thead><tr><th>VIETA</th><th>VĀRDS</th><th class="pdf-red-heading">ZOLES PUNKTI</th><th>LIELIE PUNKTI</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  function registrationTable(players) {
    const body = players.length ? players.map(player => {
      const name = player.name || '';
      return `
        <tr>
          <td class="pdf-place">${player.registrationNo}.</td>
          <td class="pdf-name ${fitClass(name)}">${escapeHtml(name.toLocaleUpperCase('lv-LV'))}</td>
          <td>${formatDateTime(player.registeredAt)}</td>
          <td class="pdf-join-round">${startRound(player)}. KĀRTA</td>
        </tr>`;
    }).join('') : '<tr><td colspan="4" class="pdf-empty">Nav reģistrētu spēlētāju.</td></tr>';

    return `
      <table class="pdf-table pdf-registration-table">
        <thead><tr><th>NR.</th><th>VĀRDS</th><th>REĢISTRĀCIJAS LAIKS</th><th>NO KĀRTAS</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  function roundTable(table, round) {
    const evaluation = evaluateTable(table);
    const rows = table.playerIds.map((playerId, index) => {
      const player = getPlayer(playerId);
      const name = player?.name || 'Nezināms';
      return `
        <tr>
          <td class="pdf-place">${player?.registrationNo ?? '—'}.</td>
          <td class="pdf-name ${fitClass(name)}">${escapeHtml(name.toLocaleUpperCase('lv-LV'))}</td>
          <td class="pdf-small-score">${evaluation.values[index] ?? '—'}</td>
          <td class="pdf-big-score">${evaluation.big?.[index] ?? '—'}</td>
        </tr>`;
    }).join('');

    return `
      <section class="pdf-table-block">
        <div class="pdf-table-title">
          <span>${table.number}. GALDS</span>
          <small>${evaluation.valid ? 'PUNKTU SUMMA 0' : round.finalized ? 'SAGLABĀTS' : 'AKTĪVS'}</small>
        </div>
        <table class="pdf-table pdf-round-table">
          <thead><tr><th>REĢ. NR.</th><th>VĀRDS</th><th class="pdf-red-heading">ZOLES PUNKTI</th><th>LIELIE PUNKTI</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  }

  function buildPageDescriptors() {
    const generatedAt = new Date().toISOString();
    const { rows: leaderboard, hasDraftScores } = getLeaderboard(true);
    const finalizedRounds = state.rounds.filter(round => round.finalized).length;
    const pages = [];

    const leaderboardChunks = chunks(leaderboard, LEADERBOARD_ROWS_PER_PAGE);
    leaderboardChunks.forEach((rows, index) => {
      pages.push({
        label: `KOPVĒRTĒJUMS${leaderboardChunks.length > 1 ? ` · ${index + 1}/${leaderboardChunks.length}` : ''}`,
        html: `
          <section class="pdf-page pdf-cover-page">
            ${reportHeader(index === 0 ? 'TURNĪRA REZULTĀTI' : 'KOPVĒRTĒJUMA TURPINĀJUMS')}
            <div class="pdf-page-meta">
              <span>${hasDraftScores ? 'PROVIZORISKS KOPVĒRTĒJUMS' : 'AKTUĀLAIS KOPVĒRTĒJUMS'}</span>
              <span>${state.players.length} SPĒLĒTĀJI</span>
              <span>${finalizedRounds} PABEIGTAS KĀRTAS</span>
              ${leaderboardChunks.length > 1 ? `<span>${index + 1}/${leaderboardChunks.length} DAĻA</span>` : ''}
            </div>
            <div class="pdf-content pdf-content-main">${leaderboardTable(rows)}</div>
          </section>`
      });
    });

    const registered = [...state.players].sort((a, b) => a.registrationNo - b.registrationNo);
    const registrationChunks = chunks(registered, REGISTRATION_ROWS_PER_PAGE);
    registrationChunks.forEach((players, index) => {
      pages.push({
        label: `REĢISTRĀCIJA${registrationChunks.length > 1 ? ` · ${index + 1}/${registrationChunks.length}` : ''}`,
        html: `
          <section class="pdf-page">
            ${reportHeader(index === 0 ? 'TURNĪRA ATSKAITE' : 'REĢISTRĀCIJAS TURPINĀJUMS')}
            <div class="pdf-section-heading">
              <div><span>01</span><h2>REĢISTRĀCIJA</h2></div>
              <p>${state.players.length} DALĪBNIEKI${registrationChunks.length > 1 ? ` · ${index + 1}/${registrationChunks.length}` : ''}</p>
            </div>
            <div class="pdf-content">${registrationTable(players)}</div>
            ${index === registrationChunks.length - 1 ? `
              <div class="pdf-info-strip">
                <div><small>TURNĪRS IZVEIDOTS</small><strong>${formatDateTime(state.tournament.createdAt)}</strong></div>
                <div><small>TURNĪRS SĀKTS</small><strong>${formatDateTime(state.tournament.startedAt)}</strong></div>
              </div>` : ''}
          </section>`
      });
    });

    state.rounds.forEach((round, roundIndex) => {
      const tableChunks = chunks(round.tables, ROUND_TABLES_PER_PAGE);
      tableChunks.forEach((tables, index) => {
        pages.push({
          label: `${round.number}. KĀRTA${tableChunks.length > 1 ? ` · ${index + 1}/${tableChunks.length}` : ''}`,
          html: `
            <section class="pdf-page">
              ${reportHeader(index === 0 ? 'KĀRTU REZULTĀTI' : `${round.number}. KĀRTAS TURPINĀJUMS`)}
              <div class="pdf-section-heading">
                <div><span>${String(roundIndex + 2).padStart(2, '0')}</span><h2>${round.number}. KĀRTA</h2></div>
                <p>${round.finalized ? `PABEIGTA ${formatDateTime(round.finalizedAt)}` : 'AKTĪVA / NEPABEIGTA'}${tableChunks.length > 1 ? ` · ${index + 1}/${tableChunks.length}` : ''}</p>
              </div>
              <div class="pdf-content pdf-rounds-content">
                ${tables.map(table => roundTable(table, round)).join('')}
              </div>
            </section>`
        });
      });
    });

    return { pages, generatedAt };
  }

  buildPrintReport = function buildCompactPageSafeReport() {
    const { pages, generatedAt } = buildPageDescriptors();
    const totalPages = pages.length;
    refs.printReport.innerHTML = `<div class="pdf-document">${pages.map((page, index) => {
      const pageHtml = page.html.replace(
        /<\/section>\s*$/,
        `${reportFooter(page.label, generatedAt, index + 1, totalPages)}</section>`
      );
      return pageHtml;
    }).join('')}</div>`;
  };
})();
