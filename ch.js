// ch.js
document.addEventListener("DOMContentLoaded", function() {
  // Nolasa "uid" no URL (piemēram, ?uid=lietotajaID)
  let params = new URLSearchParams(window.location.search);
  let uid = params.get("uid");
  if (!uid) {
    document.body.innerHTML = "<h1>Nav norādīts uid!</h1>";
    return;
  }

  // Google Sheets web app URL
  const apiUrl = "https://script.google.com/macros/s/AKfycby1JxJsrmsGDBUJ1NRpeFfnvlmDI68YHINB9wE3AKkoW_FD8CX--qy5RadkxZexvgE-pg/exec";

  // Dinamiski ielādējam skripta tagu, izmantojot JSONP (callback=handleReadResponse)
  let script = document.createElement("script");
  script.src = apiUrl + "?action=read&uid=" + encodeURIComponent(uid) + "&callback=handleReadResponse";
  document.body.appendChild(script);

  // Callback funkcija, kuru izsauks Google Apps Script ar JSONP atbildi
  window.handleReadResponse = function(data) {
    if (data.status === "success") {
      if (data.checkin === "TRUE") {
        // Ja C kolonnas vērtība ir "TRUE", parādām reģistrācijas ziņojumu
        showRegisteredMessage();
      } else {
        // Ja vērtība ir "FASE" vai tukša, sākam animāciju
        startMatrixAnimation();
      }
    } else {
      document.body.innerHTML = "<h1>ID netika atrasts!</h1>";
    }
  };

  // Matrix stila animācija
  function startMatrixAnimation() {
    let container = document.createElement("div");
    container.id = "matrix-container";
    document.body.appendChild(container);

    let fallingText = document.createElement("div");
    fallingText.id = "falling-text";
    fallingText.innerText = "VĒLOS CHECK‑IN VEZITIVUS";
