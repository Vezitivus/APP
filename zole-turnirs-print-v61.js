'use strict';

(() => {
  const REGISTRATION_ROWS_PER_PAGE = 36;
  const previousBuildPrintReport = buildPrintReport;

  function isRegistrationPage(page) {
    const heading = page.querySelector('.pdf-section-heading h2');
    return heading?.textContent.trim() === 'REĢISTRĀCIJA';
  }

  function repackRegistrationPages() {
    const allPages = [...refs.printReport.querySelectorAll('.pdf-page')];
    const registrationPages = allPages.filter(isRegistrationPage);
    if (!registrationPages.length) return;

    const rows = registrationPages.flatMap(page =>
      [...page.querySelectorAll('.pdf-registration-table tbody tr, .pdf-content .pdf-table tbody tr')]
        .filter(row => !row.querySelector('.pdf-empty'))
        .map(row => row.cloneNode(true))
    );

    const infoStripSource = registrationPages
      .map(page => page.querySelector('.pdf-info-strip'))
      .find(Boolean);
    const infoStrip = infoStripSource ? infoStripSource.cloneNode(true) : null;

    const neededPages = Math.max(1, Math.ceil(rows.length / REGISTRATION_ROWS_PER_PAGE));
    const keptPages = registrationPages.slice(0, neededPages);

    keptPages.forEach((page, pageIndex) => {
      page.classList.add('registration-repacked');
      const table = page.querySelector('.pdf-registration-table, .pdf-content .pdf-table');
      if (!table) return;
      table.classList.add('pdf-registration-table');

      const tbody = table.querySelector('tbody');
      if (!tbody) return;
      tbody.innerHTML = '';

      const start = pageIndex * REGISTRATION_ROWS_PER_PAGE;
      const chunk = rows.slice(start, start + REGISTRATION_ROWS_PER_PAGE);
      if (chunk.length) chunk.forEach(row => tbody.appendChild(row));
      else {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = '<td colspan="4" class="pdf-empty">Nav reģistrētu spēlētāju.</td>';
        tbody.appendChild(emptyRow);
      }

      page.querySelectorAll('.pdf-info-strip').forEach(element => element.remove());
      const headingMeta = page.querySelector('.pdf-section-heading p');
      if (headingMeta) {
        headingMeta.textContent = `${state.players.length} DALĪBNIEKI${neededPages > 1 ? ` · ${pageIndex + 1}/${neededPages}` : ''}`;
      }

      const kicker = page.querySelector('.pdf-kicker');
      if (kicker && pageIndex > 0) kicker.textContent = 'REĢISTRĀCIJAS TURPINĀJUMS';
    });

    registrationPages.slice(neededPages).forEach(page => page.remove());

    if (infoStrip) {
      const lastPage = keptPages[keptPages.length - 1];
      const footer = lastPage?.querySelector('.pdf-footer');
      if (lastPage) {
        if (footer) lastPage.insertBefore(infoStrip, footer);
        else lastPage.appendChild(infoStrip);
      }
    }

    const remainingPages = [...refs.printReport.querySelectorAll('.pdf-page')];
    const total = remainingPages.length;
    remainingPages.forEach((page, index) => {
      const footer = page.querySelector('.pdf-footer');
      if (!footer) return;
      const spans = footer.querySelectorAll('span');
      if (spans.length < 2) return;
      const timePart = spans[1].textContent.includes('·')
        ? spans[1].textContent.split('·').slice(1).join('·').trim()
        : '';
      spans[1].textContent = `LAPA ${index + 1}/${total}${timePart ? ` · ${timePart}` : ''}`;
    });
  }

  buildPrintReport = function buildPrintReportWithDenseRegistration() {
    previousBuildPrintReport();
    repackRegistrationPages();
  };
})();
