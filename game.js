/****************************************************************************
 * Aizstājiet GS_URL ar SAVU reālo Google Apps Script Web App izvietošanas URL!
 ****************************************************************************/
const GS_URL = "https://script.google.com/macros/s/JUSU_WEB_APP_ID/exec";

// Globālie mainīgie
let allActivities = [];  // Tiks nolasīti no F4:AP4
let allPlayers = [];     // Tiks nolasīti no B6:C1000
let teams = [];

// DOM elementi
let activitySelect, teamCountInput, createTeamsBtn, teamsContainer, playersContainer, saveResultsBtn;

window.addEventListener("DOMContentLoaded", init);

/** Inicializācija pēc lapas ielādes */
function init() {
  activitySelect   = document.getElementById("activitySelect");
  teamCountInput   = document.getElementById("teamCountInput");
  createTeamsBtn   = document.getElementById("createTeamsBtn");
  teamsContainer   = document.getElementById("teamsContainer");
  playersContainer = document.getElementById("playersContainer");
  saveResultsBtn   = document.getElementById("saveResults");

  // Pievienojam notikumu klausītājus
  if (createTeamsBtn) createTeamsBtn.addEventListener("click", onCreateTeamsClick);
  if (saveResultsBtn) saveResultsBtn.addEventListener("click", onSaveResultsClick);

  // Iegūstam aktivitātes no Google Sheets
  fetchActivities()
    .then(activities => {
      allActivities = activities;
      populateActivitySelect();
    })
    .catch(err => console.error("Error in fetchActivities:", err));

  // Iegūstam spēlētājus no Google Sheets
  fetchPlayers()
    .then(players => {
      allPlayers = players;
      renderPlayers(players);
    })
    .catch(err => console.error("Error in fetchPlayers:", err));
}

/** AJAX: nolasa aktivitātes no Google Apps Script */
function fetchActivities() {
  const url = GS_URL + "?action=getActivities";
  return fetch(url)
    .then(res => res.json())
    .then(json => {
      if (json.status === "ok") {
        return json.data; // masīvs ar aktivitātēm
      } else {
        throw new Error(json.message || "Unknown error in fetchActivities");
      }
    });
}

/** AJAX: nolasa spēlētājus no Google Apps Script */
function fetchPlayers() {
  const url = GS_URL + "?action=getPlayers";
  return fetch(url)
    .then(res => res.json())
    .then(json => {
      if (json.status === "ok") {
        return json.data; // masīvs ar { uid, name }
      } else {
        throw new Error(json.message || "Unknown error in fetchPlayers");
      }
    });
}

/** Aizpilda aktivitāšu <select> ar iegūtajām aktivitātēm */
function populateActivitySelect() {
  activitySelect.innerHTML = "";
  if (!allActivities || allActivities.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Nav pieejamu aktivitāšu";
    activitySelect.appendChild(opt);
    return;
  }
  allActivities.forEach(activity => {
    const opt = document.createElement("option");
    opt.value = activity;
    opt.textContent = activity;
    activitySelect.appendChild(opt);
  });
  activitySelect.selectedIndex = 0;
}

/** Izveido un attēlo spēlētāju "kartītes" */
function renderPlayers(players) {
  playersContainer.innerHTML = "";
  players.forEach(player => {
    const card = createPlayerCard(player);
    playersContainer.appendChild(card);
  });
}

/** Izveido HTML elementu vienam spēlētājam */
function createPlayerCard(player) {
  const div = document.createElement("div");
  div.classList.add("player-card");
  div.draggable = true;
  // Saglabā uid un vārdu data- atribūtos
  div.dataset.uid = player.uid;
  div.dataset.name = player.name;
  
  // Drag start
  div.addEventListener("dragstart", onPlayerDragStart);
  
  const uidEl = document.createElement("div");
  uidEl.classList.add("player-uid");
  uidEl.textContent = player.uid;
  
  const nameEl = document.createElement("div");
  nameEl.classList.add("player-name");
  nameEl.textContent = player.name;
  
  div.appendChild(uidEl);
  div.appendChild(nameEl);
  return div;
}

/** Poga "Izveidot komandas" */
function onCreateTeamsClick() {
  const count = parseInt(teamCountInput.value) || 0;
  generateTeams(count);
}

/** Ģenerē HTML blokos norādīto komandu skaitu */
function generateTeams(count) {
  teamsContainer.innerHTML = "";
  teams = [];
  
  for (let i = 0; i < count; i++) {
    const teamId = "team_" + i;
    const team = {
      id: teamId,
      name: `Komanda ${i + 1}`,
      score: "",
      players: []
    };
    teams.push(team);

    // Komandas HTML
    const teamBlock = document.createElement("div");
    teamBlock.classList.add("team-block");
    
    const h3 = document.createElement("h3");
    h3.textContent = team.name;
    
    const scoreInput = document.createElement("input");
    scoreInput.type = "text";
    scoreInput.placeholder = "Punkti";
    scoreInput.classList.add("team-score-input");
    scoreInput.addEventListener("input", onScoreInput);
    
    const dropzone = document.createElement("div");
    dropzone.classList.add("dropzone");
    dropzone.addEventListener("dragover", onDragOver);
    dropzone.addEventListener("drop", onDrop);
    
    teamBlock.appendChild(h3);
    teamBlock.appendChild(scoreInput);
    teamBlock.appendChild(dropzone);
    teamsContainer.appendChild(teamBlock);
  }
}

/** Drag start uz spēlētāja "kartītes" */
function onPlayerDragStart(e) {
  const data = {
    uid: e.target.dataset.uid,
    name: e.target.dataset.name
  };
  e.dataTransfer.setData("text/plain", JSON.stringify(data));
}

/** DragOver notikums dropzone */
function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("hover");
}

/** Drop notikums dropzone */
function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("hover");
  
  const data = e.dataTransfer.getData("text/plain");
  if (data) {
    try {
      const player = JSON.parse(data);
      const card = createPlayerCard(player);
      // Noņemjam šo spēlētāju no citām komandām (ja jau ielikts)
      removePlayerCardFromTeams(player.uid);
      // Noņemjam no sākotnējā saraksta, ja tur bija
      removePlayerCardFromContainer(player.uid, playersContainer);
      // Pievienojam šai dropzone
      e.currentTarget.appendChild(card);
    } catch (error) {
      console.error("Error parsing dropped player data:", error);
    }
  }
}

/** Noņem spēlētāja kartīti no visām komandām */
function removePlayerCardFromTeams(uid) {
  const dropzones = teamsContainer.querySelectorAll(".dropzone");
  dropzones.forEach(dz => {
    const existingCard = dz.querySelector(`.player-card[data-uid="${uid}"]`);
    if (existingCard) {
      dz.removeChild(existingCard);
    }
  });
}

/** Noņem spēlētāja kartīti no sākotnējā saraksta, ja tāda tur ir */
function removePlayerCardFromContainer(uid, container) {
  const existingCard = container.querySelector(`.player-card[data-uid="${uid}"]`);
  if (existingCard) {
    container.removeChild(existingCard);
  }
}

/** Kad ievadīti punkti, pārbaudām, vai rādīt "Saglabāt" pogu */
function onScoreInput(e) {
  checkIfShowSaveButton();
}

function checkIfShowSaveButton() {
  const scoreInputs = teamsContainer.querySelectorAll(".team-score-input");
  let anyScore = false;
  scoreInputs.forEach(input => {
    if (input.value.trim() !== "") anyScore = true;
  });
  saveResultsBtn.style.display = anyScore ? "inline-block" : "none";
}

/** Klikšķis uz "Saglabāt rezultātus" */
function onSaveResultsClick() {
  const teamBlocks = teamsContainer.querySelectorAll(".team-block");
  const results = [];
  
  teamBlocks.forEach(block => {
    const scoreInput = block.querySelector(".team-score-input");
    const dropzone = block.querySelector(".dropzone");
    const score = scoreInput.value.trim();
    
    const cards = dropzone.querySelectorAll(".player-card");
    cards.forEach(card => {
      results.push({
        uid: card.dataset.uid,
        activity: activitySelect.value,
        points: score
      });
    });
  });

  if (results.length === 0) {
    alert("Nav spēlētāju, kam saglabāt rezultātus!");
    return;
  }

  saveResultsBtn.disabled = true;
  saveResults(results)
    .then(() => {
      alert("Rezultāti veiksmīgi saglabāti!");
    })
    .catch(err => {
      console.error("Error while saving results:", err);
      alert("Kļūda saglabājot rezultātus.");
    })
    .finally(() => {
      saveResultsBtn.disabled = false;
    });
}

/** Sūta POST ar rezultātiem uz Google Apps Script */
function saveResults(results) {
  const url = GS_URL + "?action=saveResults";
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results })
  })
    .then(res => res.json())
    .then(data => {
      if (data.status === "ok") {
        return data;
      } else {
        throw new Error(data.message || "Unknown error in saveResults");
      }
    });
}
