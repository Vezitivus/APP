'use strict';

(() => {
  const previousBuildPrintReport = buildPrintReport;

  buildPrintReport = function buildPrintReportWithPageRootFooters() {
    previousBuildPrintReport();
    refs.printReport.querySelectorAll('.pdf-page').forEach(page => {
      const footer = page.querySelector('.pdf-footer');
      if (footer && footer.parentElement !== page) page.appendChild(footer);
    });
  };
})();
