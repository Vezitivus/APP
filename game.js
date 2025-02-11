// Norādiet savu Google Apps Script Web App URL
const GS_URL = "https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec";

/**
 * Iegūst aktivitātes no Google Sheets.
 * Sagaida atbildi: { status:"ok", data:[...] }
 */
function fetchActivities() {
  return fetch(GS_URL + "?action=getActivities")
    .then(response => response.json())
    .then(data => {
      if (data.status === "ok") {
        return data.data; // Masīvs ar aktivitātēm
      } else {
        throw new Error(data.message || "Kļūda, iegūstot aktivitātes");
      }
    });
}

/**
 * Iegūst spēlētājus no Google Sheets.
 * Sagaida atbildi: { status:"ok", data:[ { uid:"...", name:"..." }, ... ] }
 */
function fetchPlayers() {
  return fetch(GS_URL + "?action=getPlayers")
    .then(response => response.json())
    .then(data => {
      if (data.status === "ok") {
        return data.data;
      } else {
        throw new Error(data.message || "Kļūda, iegūstot spēlētājus");
      }
    });
}

/**
 * Saglabā rezultātus Google Sheets.
 * Sūtītie dati: { results:[ { uid, activity, points }, ... ] }
 */
function saveResults(results) {
  return fetch(GS_URL + "?action=saveResults", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ results: results })
  })
  .then(response => response.json())
  .then(data => {
    if (data.status === "ok") {
      return data;
    } else {
      throw new Error(data.message || "Kļūda, saglabājot rezultātus");
    }
  });
}

/* Pēc lapas ielādes – aizpilda interfeisu */
document.addEventListener("DOMContentLoaded", function() {
  const activitySelect = document.getElementById("activitySelect");
  const playersList = document.getElementById("playersList");
  const saveButton = document.getElementById("saveButton");

  // Ielādē aktivitātes un aizpilda <select>
  fetchActivities()
    .then(activities => {
      activities.forEach(activity => {
        const option = document.createElement("option");
        option.value = activity;
        option.textContent = activity;
        activitySelect.appendChild(option);
      });
    })
    .catch(err => console.error("Error fetching activities:", err));

  // Ielādē spēlētājus un aizpilda sarakstu
  fetchPlayers()
    .then(players => {
      players.forEach(player => {
        const li = document.createElement("li");
        li.textContent = `UID: ${player.uid}, Name: ${player.name}`;
        playersList.appendChild(li);
      });
    })
    .catch(err => console.error("Error fetching players:", err));

  // Saglabā rezultātu pogas klikšķa apstrāde – piemēram, izsūtām fiksētus rezultātus
  saveButton.addEventListener("click", function() {
    // Piemēra rezultātu masīvs – pielāgojiet savām vajadzībām
    const results = [
      { uid: "SP001", activity: activitySelect.value, points: "10" },
      { uid: "SP002", activity: activitySelect.value, points: "8" }
    ];
    saveResults(results)
      .then(response => {
        alert("Rezultāti saglabāti veiksmīgi!");
      })
      .catch(err => {
        console.error("Error saving results:", err);
        alert("Kļūda saglabājot rezultātus.");
      });
  });
});
