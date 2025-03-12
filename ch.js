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

  // Palīgfunkcija JSONP pieprasījumam
  function jsonpRequest(url, callbackName) {
    var script = document.createElement('script');
    // Ja URL jau satur "?", tad papildina ar "&callback=", pretējā gadījumā "?"
    script.src = url + (url.indexOf('?') !== -1 ? "&" : "?") + "callback=" + callbackName;
    document.body.appendChild(script);
  }

  // Globālais atgriešanas (callback) funkcijas definīcija
  window.processRead = function(data) {
    if (data.status === "success") {
      if (data.checkin === "TRUE") {
        // Ja C kolonnā ir TRUE, uzreiz parādām reģistrācijas ziņojumu
        showRegisteredMessage();
      } else {
        // Ja nav, sākam animāciju
        startMatrixAnimation();
      }
    } else {
      document.body.innerHTML = "<h1>ID netika atrasts!</h1>";
    }
  };

  window.processUpdate = function(data) {
    if (data.status === "success") {
      let container = document.getElementById("matrix-container");
      if (container) {
        container.classList.add("fade-out");
      }
      setTimeout(showRegisteredMessage, 1000);
    } else {
      console.error("Update failed:", data);
    }
  };

  // Izsaucam "read" darbību, izmantojot JSONP, lai izvairītos no CORS
  jsonpRequest(apiUrl + "?action=read&uid=" + encodeURIComponent(uid), "processRead");

  // Matrix stila animācijas funkcija
  function startMatrixAnimation() {
    let container = document.createElement("div");
    container.id = "matrix-container";
    document.body.appendChild(container);

    let fallingText = document.createElement("div");
    fallingText.id = "falling-text";
    fallingText.innerText = "VĒLOS CHECK‑IN VEZITIVUS";
    container.appendChild(fallingText);

    // Pēc animācijas (3000ms) parādās zelta riņķa poga
    setTimeout(() => {
      let button = document.createElement("div");
      button.id = "golden-button";
      button.innerText = "CHECK‑IN";
      button.addEventListener("click", function() {
        // Izsaucam "update" darbību, izmantojot JSONP
        jsonpRequest(apiUrl + "?action=update&uid=" + encodeURIComponent(uid), "processUpdate");
      });
      container.appendChild(button);
    }, 3000);
  }

  // Funkcija reģistrācijas ziņojuma attēlošanai
  function showRegisteredMessage() {
    document.body.innerHTML = "";
    let message = document.createElement("div");
    message.id = "registered-message";
    message.innerText = "TU JAU ESI REŠISTRĒJIES";
    document.body.appendChild(message);
  }
});
