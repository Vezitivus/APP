'use strict';

(() => {
  function stripRegistrationNumberColumns() {
    refs.printReport.querySelectorAll('.pdf-registration-table, .pdf-round-table').forEach(table => {
      const headRow = table.querySelector('thead tr');
      if (headRow?.children.length > 0) headRow.children[0].remove();

      table.querySelectorAll('tbody tr').forEach(row => {
        if (row.querySelector('.pdf-empty')) {
          const empty = row.querySelector('.pdf-empty');
          if (empty) empty.colSpan = Math.max(1, Number(empty.colSpan || 1) - 1);
          return;
        }
        if (row.children.length > 0) row.children[0].remove();
      });
    });
  }

  const previousBuildPrintReport = buildPrintReport;
  buildPrintReport = function buildPrintReportWithoutRegistrationNumbers() {
    previousBuildPrintReport();
    stripRegistrationNumberColumns();
  };
})();
