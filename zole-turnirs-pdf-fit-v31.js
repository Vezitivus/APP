'use strict';

(() => {
  const previousBuildPrintReport = buildPrintReport;

  function getFitClass(length) {
    if (length > 22) return 'pdf-name-fit-xxlong';
    if (length > 17) return 'pdf-name-fit-xlong';
    if (length > 12) return 'pdf-name-fit-long';
    return 'pdf-name-fit-normal';
  }

  buildPrintReport = function buildPrintReportWithFittedNames() {
    previousBuildPrintReport();

    refs.printReport.querySelectorAll('.pdf-round-table .pdf-name').forEach(cell => {
      const normalizedLength = cell.textContent.trim().replace(/\s+/g, ' ').length;
      cell.classList.remove(
        'pdf-name-fit-normal',
        'pdf-name-fit-long',
        'pdf-name-fit-xlong',
        'pdf-name-fit-xxlong'
      );
      cell.classList.add(getFitClass(normalizedLength));
    });
  };
})();
