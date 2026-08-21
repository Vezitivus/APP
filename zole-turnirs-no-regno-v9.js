'use strict';

(() => {
  function removeColumn(table, columnIndex) {
    const headRow = table.querySelector('thead tr');
    if (!headRow || columnIndex < 0 || columnIndex >= headRow.children.length) return;

    headRow.children[columnIndex].remove();

    table.querySelectorAll('tbody tr').forEach(row => {
      const empty = row.querySelector('.pdf-empty');
      if (empty) {
        empty.colSpan = Math.max(1, Number(empty.colSpan || 1) - 1);
        return;
      }
      if (columnIndex < row.children.length) row.children[columnIndex].remove();
    });
  }

  function stripRegistrationNumberColumns() {
    refs.printReport.querySelectorAll('.pdf-registration-table, .pdf-round-table').forEach(table => {
      removeColumn(table, 0);
    });
  }

  function stripJoinRoundColumn() {
    refs.printReport.querySelectorAll('.pdf-registration-table').forEach(table => {
      const headers = [...table.querySelectorAll('thead th')];
      const index = headers.findIndex(header => header.textContent.trim().toLocaleUpperCase('lv-LV') === 'NO KĀRTAS');
      if (index >= 0) removeColumn(table, index);
    });
  }

  function stripRoundTableStatus() {
    refs.printReport.querySelectorAll('.pdf-table-block .pdf-table-title small').forEach(status => status.remove());
  }

  const previousBuildPrintReport = buildPrintReport;
  buildPrintReport = function buildCleanPdfReport() {
    previousBuildPrintReport();
    stripRegistrationNumberColumns();
    stripJoinRoundColumn();
    stripRoundTableStatus();
  };
})();
