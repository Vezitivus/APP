'use strict';

(() => {
  const LEADERBOARD_ROWS_PER_PAGE = 36;
  const previousBuildPrintReport = buildPrintReport;

  function repackLeaderboardPages() {
    const pages = [...refs.printReport.querySelectorAll('.pdf-page.pdf-cover-page')];
    if (!pages.length) return;

    const rows = pages.flatMap(page =>
      [...page.querySelectorAll('.pdf-leaderboard-table tbody tr')]
        .filter(row => !row.querySelector('.pdf-empty'))
        .map(row => row.cloneNode(true))
    );

    const neededPages = Math.max(1, Math.ceil(rows.length / LEADERBOARD_ROWS_PER_PAGE));
    const firstPage = pages[0];
    const parent = firstPage?.parentNode;
    if (!firstPage || !parent) return;

    while (pages.length < neededPages) {
      const clone = firstPage.cloneNode(true);
      parent.insertBefore(clone, pages[pages.length - 1].nextSibling);
      pages.push(clone);
    }

    const keptPages = pages.slice(0, neededPages);

    keptPages.forEach((page, pageIndex) => {
      page.classList.add('leaderboard-repacked');
      const table = page.querySelector('.pdf-leaderboard-table');
      const tbody = table?.querySelector('tbody');
      if (!tbody) return;

      tbody.innerHTML = '';
      const start = pageIndex * LEADERBOARD_ROWS_PER_PAGE;
      const chunk = rows.slice(start, start + LEADERBOARD_ROWS_PER_PAGE);
      if (chunk.length) chunk.forEach(row => tbody.appendChild(row));
      else {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4" class="pdf-empty">Pagaidām nav rezultātu.</td>';
        tbody.appendChild(row);
      }

      const kicker = page.querySelector('.pdf-kicker');
      if (kicker) kicker.textContent = pageIndex === 0 ? 'TURNĪRA REZULTĀTI' : 'KOPVĒRTĒJUMA TURPINĀJUMS';

      const meta = page.querySelector('.pdf-page-meta');
      if (meta) {
        const part = [...meta.querySelectorAll('span')].find(span => /DAĻA$/.test(span.textContent));
        if (neededPages > 1) {
          if (part) part.textContent = `${pageIndex + 1}/${neededPages} DAĻA`;
          else {
            const span = document.createElement('span');
            span.textContent = `${pageIndex + 1}/${neededPages} DAĻA`;
            meta.appendChild(span);
          }
        } else if (part) {
          part.remove();
        }
      }
    });

    pages.slice(neededPages).forEach(page => page.remove());

    const allPages = [...refs.printReport.querySelectorAll('.pdf-page')];
    const total = allPages.length;
    allPages.forEach((page, index) => {
      const footer = page.querySelector('.pdf-footer');
      if (!footer) return;
      const spans = footer.querySelectorAll('span');
      if (spans.length < 2) return;
      const text = spans[1].textContent;
      const separator = text.indexOf('·');
      const suffix = separator >= 0 ? text.slice(separator + 1).trim() : '';
      spans[1].textContent = `LAPA ${index + 1}/${total}${suffix ? ` · ${suffix}` : ''}`;
    });
  }

  buildPrintReport = function buildPrintReportWithDenseLeaderboard() {
    previousBuildPrintReport();
    repackLeaderboardPages();
  };
})();
