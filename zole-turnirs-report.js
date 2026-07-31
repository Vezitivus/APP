function buildPrintReport() {
  const leaderboard = getLeaderboard(true).rows;
  const now = new Date().toISOString();
  const registrationRows = [...state.players].sort((a,b) => a.registrationNo - b.registrationNo).map(player => `
    <tr><td class="num">${player.registrationNo}</td><td>${escapeHtml(player.name)}</td><td>${formatDateTime(player.registeredAt)}</td></tr>`).join('');

  const roundsHtml = state.rounds.map(round => `
    <div class="print-section print-round">
      <h2>${round.number}. kārta</h2>
      <div class="print-note">Izveidota: ${formatDateTime(round.createdAt)} · ${round.finalized ? `Pabeigta: ${formatDateTime(round.finalizedAt)}` : 'Aktīva / nepabeigta'}</div>
      ${round.tables.map(table => {
        const evaluation = evaluateTable(table);
        return `<div class="print-game"><h3>${table.number}. galds</h3><table class="print-table">
          <thead><tr><th>Reģ. Nr.</th><th>Spēlētājs</th><th class="num">Zoles punkti</th><th class="num">Lielie punkti</th></tr></thead>
          <tbody>${table.playerIds.map((playerId,index) => {
            const player = getPlayer(playerId);
            return `<tr><td class="num">${player.registrationNo}</td><td>${escapeHtml(player.name)}</td><td class="num">${evaluation.values[index] ?? '—'}</td><td class="num">${evaluation.big?.[index] ?? '—'}</td></tr>`;
          }).join('')}</tbody></table></div>`;
      }).join('')}
    </div>`).join('');

  refs.printReport.innerHTML = `
    <div class="print-title">
      <h1>${escapeHtml(state.tournament.name || DEFAULT_NAME)}</h1>
      <div class="print-meta">
        <div><strong>Turnīrs izveidots:</strong> ${formatDateTime(state.tournament.createdAt)}</div>
        <div><strong>Turnīrs sākts:</strong> ${formatDateTime(state.tournament.startedAt)}</div>
        <div><strong>Atskaites laiks:</strong> ${formatDateTime(now)}</div>
        <div><strong>Spēlētāji:</strong> ${state.players.length}</div>
      </div>
    </div>
    <div class="print-section">
      <h2>Reģistrācija</h2>
      <table class="print-table"><thead><tr><th class="num">Nr.</th><th>Spēlētājs</th><th>Reģistrācijas laiks</th></tr></thead><tbody>${registrationRows || '<tr><td colspan="3">Nav spēlētāju</td></tr>'}</tbody></table>
    </div>
    ${roundsHtml || '<div class="print-section"><h2>Kārtas</h2><p>Nav aizvadītu kārtu.</p></div>'}
    <div class="print-section">
      <h2>Kopvērtējums</h2>
      <table class="print-table"><thead><tr><th class="num">Vieta</th><th>Spēlētājs</th><th class="num">Lielie punkti</th><th class="num">Zoles punkti</th><th class="num">Kārtas</th></tr></thead>
      <tbody>${leaderboard.map(row => `<tr><td class="num">${row.place}</td><td>${escapeHtml(row.name)}</td><td class="num">${row.big}</td><td class="num">${row.small}</td><td class="num">${row.rounds}</td></tr>`).join('')}</tbody></table>
      <div class="print-note">Kopvērtējums kārtots pēc lielo punktu summas, pēc tam pēc zoles punktu summas. Aktīvās kārtas rezultāti tiek ieskaitīti tikai pilnībā un korekti aizpildītiem galdiem.</div>
    </div>`;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
