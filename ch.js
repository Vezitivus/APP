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

  // Sākotnēji izsaucam “read” darbību
  fetch(apiUrl + "?action=read&uid=" + encodeURIComponent(uid))
    .then(response => response.json())
    .then(data => {
      if (data.status === "success") {
        if (data.checkin === "TRUE") {
          // Lietotājs jau reģistrēts – parādām ziņojumu uzreiz
          showRegisteredMessage();
        } else {
          // Nav reģistrēts – sākam animāciju
          startMatrixAnimation();
        }
      } else {
        document.body.innerHTML = "<h1>ID netika atrasts!</h1>";
      }
    })
    .catch(err => {
      console.error("Kļūda:", err);
      document.body.innerHTML = "<h1>Savienojuma kļūda!</h1>";
    });

  // Matrix stila animācija
  function startMatrixAnimation() {
    // Izveidojam konteineru animācijām
    let container = document.createElement("div");
    container.id = "matrix-container";
    document.body.appendChild(container);

    // Izveidojam elementu ar krītošo tekstu
    let fallingText = document.createElement("div");
    fallingText.id = "falling-text";
    fallingText.innerText = "VĒLOS CHECK‑IN VEZITIVUS";
    container.appendChild(fallingText);

    // Pēc animācijas (piemēram, 3 sekundes) parādām zelta riņķa pogu
    setTimeout(() => {
      let button = document.createElement("div");
      button.id = "golden-button";
      button.innerText = "CHECK‑IN";
      button.addEventListener("click", function() {
        // Veicam atjaunošanu – rakstām "TRUE" C kolonnā
        fetch(apiUrl + "?action=update&uid=" + encodeURIComponent(uid))
          .then(response => response.json())
          .then(data => {
            if (data.status === "success") {
              container.classList.add("fade-out");
              setTimeout(showRegisteredMessage, 1000);
            }
          })
          .catch(err => console.error("Update error:", err));
      });
      container.appendChild(button);
    }, 3000); // animācijas ilgums (3000ms)
  }

  // Parāda reģistrācijas pabeigšanas ziņojumu
  function showRegisteredMessage() {
    document.body.innerHTML = "";
    let message = document.createElement("div");
    message.id = "registered-message";
    message.innerText = "TU JAU ESI REŠISTRĒJIES";
    document.body.appendChild(message);
  }
});
