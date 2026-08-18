'use strict';

(() => {
  const previousBuildPrintReport = buildPrintReport;

  buildPrintReport = function buildMeasuredFlowReport() {
    document.body.classList.add('flow-measuring');
    previousBuildPrintReport();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.body.classList.remove('flow-measuring');
      });
    });
  };
})();
