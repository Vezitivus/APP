'use strict';

(() => {
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

  function reportFooter(label, generatedAt) {
    return `
      <footer class="pdf-footer" data-flow-label="${escapeHtml(label)}">
        <span>${escapeHtml(label)}</span>
        <span>${formatDateTime(generatedAt)}</span>
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

  function roundBlock(table, round) {
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

  function buildUnpaginatedReport() {
    const generatedAt = new Date().toISOString();
    const { rows: leaderboard, hasDraftScores } = getLeaderboard(true);
    const finalizedRounds = state.rounds.filter(round => round.finalized).length;
    const registered = [...state.players].sort((a, b) => a.registrationNo - b.registrationNo);

    const pages = [];

    pages.push(`
      <section class="pdf-page pdf-cover-page flow-source-page" data-flow-section="leaderboard">
        ${reportHeader('TURNĪRA REZULTĀTI')}
        <div class="pdf-page-meta" data-flow-base-meta="true">
          <span>${hasDraftScores ? 'PROVIZORISKS KOPVĒRTĒJUMS' : 'AKTUĀLAIS KOPVĒRTĒJUMS'}</span>
          <span>${state.players.length} SPĒLĒTĀJI</span>
          <span>${finalizedRounds} PABEIGTAS KĀRTAS</span>
        </div>
        <div class="pdf-content pdf-content-main">${leaderboardTable(leaderboard)}</div>
        ${reportFooter('KOPVĒRTĒJUMS', generatedAt)}
      </section>`);

    pages.push(`
      <section class="pdf-page flow-source-page" data-flow-section="registration">
        ${reportHeader('TURNĪRA ATSKAITE')}
        <div class="pdf-section-heading">
          <div><span>01</span><h2>REĢISTRĀCIJA</h2></div>
          <p data-flow-base-meta="${escapeHtml(`${state.players.length} DALĪBNIEKI`)}">${state.players.length} DALĪBNIEKI</p>
        </div>
        <div class="pdf-content">${registrationTable(registered)}</div>
        <div class="pdf-info-strip">
          <div><small>TURNĪRS IZVEIDOTS</small><strong>${formatDateTime(state.tournament.createdAt)}</strong></div>
          <div><small>TURNĪRS SĀKTS</small><strong>${formatDateTime(state.tournament.startedAt)}</strong></div>
        </div>
        ${reportFooter('REĢISTRĀCIJA', generatedAt)}
      </section>`);

    state.rounds.forEach((round, roundIndex) => {
      const baseMeta = round.finalized ? `PABEIGTA ${formatDateTime(round.finalizedAt)}` : 'AKTĪVA / NEPABEIGTA';
      pages.push(`
        <section class="pdf-page flow-source-page" data-flow-section="round" data-flow-round="${round.number}">
          ${reportHeader('KĀRTU REZULTĀTI')}
          <div class="pdf-section-heading">
            <div><span>${String(roundIndex + 2).padStart(2, '0')}</span><h2>${round.number}. KĀRTA</h2></div>
            <p data-flow-base-meta="${escapeHtml(baseMeta)}">${escapeHtml(baseMeta)}</p>
          </div>
          <div class="pdf-content pdf-rounds-content">
            ${round.tables.map(table => roundBlock(table, round)).join('')}
          </div>
          ${reportFooter(`${round.number}. KĀRTA`, generatedAt)}
        </section>`);
    });

    refs.printReport.innerHTML = `<div class="pdf-document flow-document">${pages.join('')}</div>`;
  }

  function insertAfter(node, reference) {
    reference.parentNode.insertBefore(node, reference.nextSibling);
  }

  function pageFits(page) {
    const footer = page.querySelector('.pdf-footer');
    const pageRect = page.getBoundingClientRect();
    const limit = footer ? footer.getBoundingClientRect().top - 6 : pageRect.bottom - 14;
    let bottom = pageRect.top;

    [...page.children].forEach(child => {
      if (child.classList.contains('pdf-footer')) return;
      const rect = child.getBoundingClientRect();
      bottom = Math.max(bottom, rect.bottom);
    });

    return bottom <= limit;
  }

  function makeContinuation(template, section, pageIndex) {
    const page = template.cloneNode(true);
    page.classList.remove('flow-source-page');
    page.classList.add('flow-continuation-page');
    page.dataset.flowSection = section;

    const kicker = page.querySelector('.pdf-kicker');
    if (kicker) {
      if (section === 'leaderboard') kicker.textContent = 'KOPVĒRTĒJUMA TURPINĀJUMS';
      if (section === 'registration') kicker.textContent = 'REĢISTRĀCIJAS TURPINĀJUMS';
      if (section === 'round') kicker.textContent = `${page.dataset.flowRound}. KĀRTAS TURPINĀJUMS`;
    }

    const info = page.querySelector('.pdf-info-strip');
    if (info) info.remove();

    if (section === 'leaderboard') {
      const tbody = page.querySelector('.pdf-leaderboard-table tbody');
      if (tbody) tbody.innerHTML = '';
    } else if (section === 'registration') {
      const tbody = page.querySelector('.pdf-registration-table tbody');
      if (tbody) tbody.innerHTML = '';
    } else if (section === 'round') {
      const container = page.querySelector('.pdf-rounds-content');
      if (container) container.innerHTML = '';
    }

    page.dataset.flowSectionIndex = String(pageIndex);
    return page;
  }

  function splitRows(sourcePage, section, tableSelector) {
    const sourceBody = sourcePage.querySelector(`${tableSelector} tbody`);
    if (!sourceBody) return [sourcePage];

    const rows = [...sourceBody.children].map(row => row.cloneNode(true));
    const infoStrip = section === 'registration' ? sourcePage.querySelector('.pdf-info-strip')?.cloneNode(true) : null;
    sourcePage.querySelector('.pdf-info-strip')?.remove();
    sourceBody.innerHTML = '';

    const template = sourcePage.cloneNode(true);
    const templateBody = template.querySelector(`${tableSelector} tbody`);
    if (templateBody) templateBody.innerHTML = '';

    const pages = [sourcePage];
    let current = sourcePage;

    rows.forEach(row => {
      const body = current.querySelector(`${tableSelector} tbody`);
      body.appendChild(row);

      if (!pageFits(current) && body.children.length > 1) {
        const moved = body.lastElementChild;
        moved.remove();
        const next = makeContinuation(template, section, pages.length + 1);
        insertAfter(next, current);
        next.querySelector(`${tableSelector} tbody`).appendChild(moved);
        pages.push(next);
        current = next;
      }
    });

    if (infoStrip) {
      const footer = current.querySelector('.pdf-footer');
      if (footer) current.insertBefore(infoStrip, footer);
      else current.appendChild(infoStrip);

      if (!pageFits(current)) {
        infoStrip.remove();
        const next = makeContinuation(template, section, pages.length + 1);
        insertAfter(next, current);
        const nextFooter = next.querySelector('.pdf-footer');
        if (nextFooter) next.insertBefore(infoStrip, nextFooter);
        else next.appendChild(infoStrip);
        pages.push(next);
        current = next;
      }
    }

    return pages;
  }

  function splitBlocks(sourcePage) {
    const container = sourcePage.querySelector('.pdf-rounds-content');
    if (!container) return [sourcePage];

    const blocks = [...container.children].map(block => block.cloneNode(true));
    container.innerHTML = '';

    const template = sourcePage.cloneNode(true);
    const templateContainer = template.querySelector('.pdf-rounds-content');
    if (templateContainer) templateContainer.innerHTML = '';

    const pages = [sourcePage];
    let current = sourcePage;

    blocks.forEach(block => {
      const target = current.querySelector('.pdf-rounds-content');
      target.appendChild(block);

      if (!pageFits(current) && target.children.length > 1) {
        const moved = target.lastElementChild;
        moved.remove();
        const next = makeContinuation(template, 'round', pages.length + 1);
        next.dataset.flowRound = sourcePage.dataset.flowRound;
        insertAfter(next, current);
        next.querySelector('.pdf-rounds-content').appendChild(moved);
        pages.push(next);
        current = next;
      }
    });

    return pages;
  }

  function updateSectionPagination(pages, section) {
    pages.forEach((page, index) => {
      const current = index + 1;
      const total = pages.length;

      if (section === 'leaderboard') {
        const meta = page.querySelector('.pdf-page-meta');
        if (meta) {
          meta.querySelectorAll('[data-flow-part]').forEach(node => node.remove());
          if (total > 1) {
            const span = document.createElement('span');
            span.dataset.flowPart = 'true';
            span.textContent = `${current}/${total} DAĻA`;
            meta.appendChild(span);
          }
        }
      } else {
        const meta = page.querySelector('.pdf-section-heading p');
        if (meta) {
          const base = meta.dataset.flowBaseMeta || meta.textContent.split(' · ')[0];
          meta.textContent = total > 1 ? `${base} · ${current}/${total}` : base;
        }
      }
    });
  }

  function renumberFooters() {
    const pages = [...refs.printReport.querySelectorAll('.pdf-page')];
    pages.forEach((page, index) => {
      const footer = page.querySelector('.pdf-footer');
      if (!footer) return;
      const spans = footer.querySelectorAll('span');
      if (spans.length < 2) return;
      spans[0].textContent = footer.dataset.flowLabel || spans[0].textContent;
      spans[1].textContent = `LAPA ${index + 1}/${pages.length} · ${formatDateTime(new Date().toISOString())}`;
    });
  }

  function flowPaginate() {
    if (!refs.printReport.querySelector('.flow-document')) return;

    const leaderboardSource = refs.printReport.querySelector('[data-flow-section="leaderboard"]');
    const registrationSource = refs.printReport.querySelector('[data-flow-section="registration"]');

    const leaderboardPages = leaderboardSource
      ? splitRows(leaderboardSource, 'leaderboard', '.pdf-leaderboard-table')
      : [];
    updateSectionPagination(leaderboardPages, 'leaderboard');

    const registrationPages = registrationSource
      ? splitRows(registrationSource, 'registration', '.pdf-registration-table')
      : [];
    updateSectionPagination(registrationPages, 'registration');

    const roundSources = [...refs.printReport.querySelectorAll('[data-flow-section="round"].flow-source-page')];
    roundSources.forEach(source => {
      const pages = splitBlocks(source);
      updateSectionPagination(pages, 'round');
    });

    renumberFooters();
    refs.printReport.querySelector('.flow-document')?.classList.add('flow-pagination-complete');
  }

  buildPrintReport = function buildFlowingPrintReport() {
    buildUnpaginatedReport();
    setTimeout(flowPaginate, 0);
  };
})();
