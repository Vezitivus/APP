'use strict';

(() => {
  const LOGO_MAX_WIDTH = 1400;
  const LOGO_MAX_HEIGHT = 560;
  const LOGO_MAX_FILE_SIZE = 8 * 1024 * 1024;

  function getLogoDataUrl() {
    const value = state?.tournament?.logoDataUrl;
    return typeof value === 'string' && /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value) ? value : '';
  }

  function injectBrandingControls() {
    if (document.getElementById('tournamentLogoPanel')) return;
    const nameInput = refs.tournamentName;
    const cardBody = nameInput?.closest('.card-body');
    if (!cardBody) return;

    const panel = document.createElement('div');
    panel.id = 'tournamentLogoPanel';
    panel.className = 'logo-settings';
    panel.innerHTML = `
      <div class="logo-settings-copy">
        <div class="logo-settings-title">Turnīra logo</div>
        <div class="logo-settings-help">Logo tiks saglabāts šajā ierīcē un automātiski ievietots PDF atskaitē.</div>
      </div>
      <div class="logo-editor">
        <div class="logo-preview" id="tournamentLogoPreview" aria-label="Turnīra logo priekšskatījums">
          <div class="logo-placeholder" id="tournamentLogoPlaceholder">
            <span>LOGO</span>
            <small>PNG, JPG vai WEBP</small>
          </div>
          <img id="tournamentLogoImage" alt="Turnīra logo" hidden>
        </div>
        <div class="logo-actions">
          <button type="button" class="btn btn-secondary" id="chooseTournamentLogoBtn">Izvēlēties logo</button>
          <button type="button" class="btn btn-ghost" id="removeTournamentLogoBtn">Noņemt logo</button>
          <input id="tournamentLogoInput" type="file" accept="image/png,image/jpeg,image/webp" hidden>
        </div>
      </div>
      <div class="notice danger hidden" id="tournamentLogoError"></div>`;
    cardBody.appendChild(panel);

    const input = document.getElementById('tournamentLogoInput');
    const chooseButton = document.getElementById('chooseTournamentLogoBtn');
    const removeButton = document.getElementById('removeTournamentLogoBtn');

    chooseButton.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.value = '';
      if (!file) return;
      await handleLogoFile(file);
    });

    removeButton.addEventListener('click', () => {
      if (!getLogoDataUrl()) return;
      showModal({
        title: 'Noņemt turnīra logo?',
        text: 'Logo tiks izņemts no aplikācijas un turpmākajām PDF atskaitēm.',
        confirmText: 'Noņemt logo',
        danger: true,
        onConfirm: () => {
          delete state.tournament.logoDataUrl;
          saveState();
          renderBrandingControls();
          showToast('Logo noņemts');
        }
      });
    });
  }

  function renderBrandingControls() {
    injectBrandingControls();
    const logo = getLogoDataUrl();
    const image = document.getElementById('tournamentLogoImage');
    const placeholder = document.getElementById('tournamentLogoPlaceholder');
    const removeButton = document.getElementById('removeTournamentLogoBtn');
    if (!image || !placeholder || !removeButton) return;

    if (logo) {
      image.src = logo;
      image.hidden = false;
      placeholder.hidden = true;
      removeButton.disabled = false;
    } else {
      image.removeAttribute('src');
      image.hidden = true;
      placeholder.hidden = false;
      removeButton.disabled = true;
    }
  }

  function setLogoError(message = '') {
    const box = document.getElementById('tournamentLogoError');
    if (!box) return;
    box.textContent = message;
    box.classList.toggle('hidden', !message);
  }

  async function handleLogoFile(file) {
    setLogoError('');
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) {
      setLogoError('Izvēlies PNG, JPG vai WEBP attēlu.');
      return;
    }
    if (file.size > LOGO_MAX_FILE_SIZE) {
      setLogoError('Logo fails ir pārāk liels. Maksimālais izmērs ir 8 MB.');
      return;
    }

    try {
      const processed = await resizeLogo(file);
      state.tournament.logoDataUrl = processed;
      saveState();
      renderBrandingControls();
      showToast('Logo saglabāts');
    } catch (error) {
      console.error('Logo apstrādes kļūda', error);
      setLogoError('Logo neizdevās apstrādāt. Pamēģini citu attēlu.');
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Neizdevās nolasīt attēlu.'));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Neizdevās atvērt attēlu.'));
      image.src = src;
    });
  }

  async function resizeLogo(file) {
    const source = await readFileAsDataUrl(file);
    const image = await loadImage(source);
    const scale = Math.min(1, LOGO_MAX_WIDTH / image.naturalWidth, LOGO_MAX_HEIGHT / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Attēlu apstrāde nav pieejama.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  }

  function safeImageSrc(value) {
    return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(value || '')
      ? String(value).replace(/"/g, '&quot;')
      : '';
  }

  function reportHeader(kicker) {
    const title = escapeHtml((state.tournament.name || DEFAULT_NAME).toLocaleUpperCase('lv-LV'));
    const logo = safeImageSrc(getLogoDataUrl());
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
      <footer class="pdf-footer">
        <span>${escapeHtml(label)}</span>
        <span>Atskaite sagatavota ${formatDateTime(generatedAt)}</span>
      </footer>`;
  }

  function mainLeaderboardTable(rows) {
    const body = rows.length
      ? rows.map(row => `
          <tr>
            <td class="pdf-place">${row.place}.</td>
            <td class="pdf-name">${escapeHtml(row.name.toLocaleUpperCase('lv-LV'))}</td>
            <td class="pdf-small-score">${row.small}</td>
            <td class="pdf-big-score">${row.big}</td>
          </tr>`).join('')
      : '<tr><td colspan="4" class="pdf-empty">Pagaidām nav rezultātu.</td></tr>';
    return `
      <table class="pdf-table pdf-leaderboard-table">
        <thead><tr><th>VIETA</th><th>VĀRDS</th><th class="pdf-red-heading">ZOLES PUNKTI</th><th>LIELIE PUNKTI</th></tr></thead>
        <tbody>${body}</tbody>
      </table>`;
  }

  function registrationTable() {
    const rows = [...state.players]
      .sort((a, b) => a.registrationNo - b.registrationNo)
      .map(player => `
        <tr>
          <td class="pdf-place">${player.registrationNo}.</td>
          <td class="pdf-name">${escapeHtml(player.name.toLocaleUpperCase('lv-LV'))}</td>
          <td>${formatDateTime(player.registeredAt)}</td>
        </tr>`).join('');
    return `
      <table class="pdf-table">
        <thead><tr><th>NR.</th><th>VĀRDS</th><th>REĢISTRĀCIJAS LAIKS</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3" class="pdf-empty">Nav reģistrētu spēlētāju.</td></tr>'}</tbody>
      </table>`;
  }

  function roundTables(round) {
    return round.tables.map(table => {
      const evaluation = evaluateTable(table);
      const rows = table.playerIds.map((playerId, index) => {
        const player = getPlayer(playerId);
        return `
          <tr>
            <td class="pdf-place">${player?.registrationNo ?? '—'}.</td>
            <td class="pdf-name">${escapeHtml((player?.name || 'Nezināms').toLocaleUpperCase('lv-LV'))}</td>
            <td class="pdf-small-score">${evaluation.values[index] ?? '—'}</td>
            <td class="pdf-big-score">${evaluation.big?.[index] ?? '—'}</td>
          </tr>`;
      }).join('');
      return `
        <section class="pdf-table-block">
          <div class="pdf-table-title"><span>${table.number}. GALDS</span><small>${evaluation.valid ? 'PUNKTU SUMMA 0' : round.finalized ? 'SAGLABĀTS' : 'AKTĪVS'}</small></div>
          <table class="pdf-table pdf-round-table">
            <thead><tr><th>REĢ. NR.</th><th>VĀRDS</th><th class="pdf-red-heading">ZOLES PUNKTI</th><th>LIELIE PUNKTI</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </section>`;
    }).join('');
  }

  function chunkRows(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
    return chunks.length ? chunks : [[]];
  }

  buildPrintReport = function buildProfessionalPrintReport() {
    const { rows: leaderboard, hasDraftScores } = getLeaderboard(true);
    const generatedAt = new Date().toISOString();
    const finalizedRounds = state.rounds.filter(round => round.finalized).length;
    const status = hasDraftScores ? 'PROVIZORISKS KOPVĒRTĒJUMS' : 'AKTUĀLAIS KOPVĒRTĒJUMS';
    const pages = [];

    const leaderboardChunks = chunkRows(leaderboard, 18);
    leaderboardChunks.forEach((rows, pageIndex) => {
      pages.push(`
        <section class="pdf-page pdf-cover-page">
          ${reportHeader(pageIndex === 0 ? 'TURNĪRA REZULTĀTI' : 'KOPVĒRTĒJUMA TURPINĀJUMS')}
          <div class="pdf-page-meta">
            <span>${status}</span>
            <span>${state.players.length} SPĒLĒTĀJI</span>
            <span>${finalizedRounds} PABEIGTAS KĀRTAS</span>
            ${leaderboardChunks.length > 1 ? `<span>${pageIndex + 1}/${leaderboardChunks.length} LAPA</span>` : ''}
          </div>
          <div class="pdf-content pdf-content-main">${mainLeaderboardTable(rows)}</div>
          ${reportFooter(`KOPVĒRTĒJUMS${leaderboardChunks.length > 1 ? ` · ${pageIndex + 1}/${leaderboardChunks.length}` : ''}`, generatedAt)}
        </section>`);
    });

    const registeredPlayers = [...state.players].sort((a, b) => a.registrationNo - b.registrationNo);
    const registrationChunks = chunkRows(registeredPlayers, 23);
    registrationChunks.forEach((players, pageIndex) => {
      const rows = players.map(player => `
        <tr>
          <td class="pdf-place">${player.registrationNo}.</td>
          <td class="pdf-name">${escapeHtml(player.name.toLocaleUpperCase('lv-LV'))}</td>
          <td>${formatDateTime(player.registeredAt)}</td>
        </tr>`).join('');
      pages.push(`
        <section class="pdf-page">
          ${reportHeader(pageIndex === 0 ? 'TURNĪRA ATSKAITE' : 'REĢISTRĀCIJAS TURPINĀJUMS')}
          <div class="pdf-section-heading">
            <div><span>01</span><h2>REĢISTRĀCIJA</h2></div>
            <p>${state.players.length} DALĪBNIEKI${registrationChunks.length > 1 ? ` · ${pageIndex + 1}/${registrationChunks.length}` : ''}</p>
          </div>
          <div class="pdf-content">
            <table class="pdf-table">
              <thead><tr><th>NR.</th><th>VĀRDS</th><th>REĢISTRĀCIJAS LAIKS</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="3" class="pdf-empty">Nav reģistrētu spēlētāju.</td></tr>'}</tbody>
            </table>
          </div>
          ${pageIndex === registrationChunks.length - 1 ? `
            <div class="pdf-info-strip">
              <div><small>TURNĪRS IZVEIDOTS</small><strong>${formatDateTime(state.tournament.createdAt)}</strong></div>
              <div><small>TURNĪRS SĀKTS</small><strong>${formatDateTime(state.tournament.startedAt)}</strong></div>
            </div>` : ''}
          ${reportFooter(`REĢISTRĀCIJAS SARAKSTS${registrationChunks.length > 1 ? ` · ${pageIndex + 1}/${registrationChunks.length}` : ''}`, generatedAt)}
        </section>`);
    });

    state.rounds.forEach((round, roundIndex) => {
      const tableChunks = chunkRows(round.tables, 8);
      tableChunks.forEach((tables, pageIndex) => {
        const partialRound = { ...round, tables };
        pages.push(`
          <section class="pdf-page">
            ${reportHeader(pageIndex === 0 ? 'KĀRTU REZULTĀTI' : `${round.number}. KĀRTAS TURPINĀJUMS`)}
            <div class="pdf-section-heading">
              <div><span>${String(roundIndex + 2).padStart(2, '0')}</span><h2>${round.number}. KĀRTA</h2></div>
              <p>${round.finalized ? `PABEIGTA ${formatDateTime(round.finalizedAt)}` : 'AKTĪVA / NEPABEIGTA'}${tableChunks.length > 1 ? ` · ${pageIndex + 1}/${tableChunks.length}` : ''}</p>
            </div>
            <div class="pdf-content pdf-rounds-content">${roundTables(partialRound)}</div>
            ${reportFooter(`${round.number}. KĀRTA · ${round.tables.length} GALDI${tableChunks.length > 1 ? ` · ${pageIndex + 1}/${tableChunks.length}` : ''}`, generatedAt)}
          </section>`);
      });
    });

    refs.printReport.innerHTML = `<div class="pdf-document">${pages.join('')}</div>`;
  };

  const originalRenderAll = renderAll;
  renderAll = function renderAllWithBranding() {
    originalRenderAll();
    renderBrandingControls();
  };

  renderBrandingControls();
})();
