// *** KONFIGURĀCIJA ***
// Jaunais Google Apps Script Web App URL (nomainiet uz savu, ja nepieciešams)
const GSHEET_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec";

// Datu glabāšanas mainīgie
let allActivities = [];  // dati no F4:AP4
let allPlayers = [];     // objekti { uid: '...', name: '...' }
let teams = [];          // pašreizējās komandas: { id, name, score, players: [] }

// HTML elementi
const activitySelect = document.getElementById("activitySelect");
const teamCountInput = document.getElementById("teamCountInput");
const createTeamsBtn = document.getElementById("createTeamsBtn");
const teamsContainer = document.getElementById("teamsContainer");
const playersContainer = document.getElementById("playersContainer");
const saveResultsBtn = document.getElementById("saveResults");

// Lietotāja izvēlēta aktivitāte
let selectedActivity = null;

// Inicializācija, kad lapa ir ielādēta
window.addEventListener("DOMContentLoaded", init);

function init() {
  // Ielādē aktivitātes
  fetchActivities()
    .then(activities => {
      allActivities = activities;
      populateActivitySelect();
    })
    .catch(err => console.error("Kļūda ielādējot aktivitātes:", err));

  // Ielādē spēlētājus
  fetchPlayers()
    .then(players => {
      allPlayers = players;
      renderPlayers(players);
    })
    .catch(err => console.error("Kļūda ielādējot spēlētājus:", err));

  // Piesaista pogu notikumus
  createTeamsBtn.addEventListener("click", onCreateTeamsClick);
  saveResultsBtn.addEventListener("click", onSaveResultsClick);
  activitySelect.addEventListener("change", () => {
    selectedActivity = activitySelect.value;
  });
}

// Ielādē aktivitātes no Google Apps Script (no F4:AP4)
function fetchActivities() {
  const url = GSHEET_WEBAPP_URL + "?action=getActivities";
  return fetch(url)
    .then(res => res.json())
    .then(json => {
      if (json.status === "ok") {
        return json.data; // masīvs ar aktivitātēm
      } else {
        throw new Error(json.message || "Nezināma kļūda fetchActivities");
      }
    });
}

// Ielādē spēlētājus no Google Apps Script (B6:B1000 un C6:C1000)
function fetchPlayers() {
  const url = GSHEET_WEBAPP_URL + "?action=getPlayers";
  return fetch(url)
    .then(res => res.json())
    .then(json => {
      if (json.status === "ok") {
        return json.data;
      } else {
        throw new Error(json.message || "Nezināma kļūda fetchPlayers");
      }
    });
}

// Aizpilda <select> ar aktivitātēm
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
  // Izvēlas pirmo pēc noklusējuma
  activitySelect.selectedIndex = 0;
  selectedActivity = activitySelect.value;
}

// Attēlo spēlētājus sākotnēji (pirms komandu sadalīšanas)
function renderPlayers(players) {
  playersContainer.innerHTML = "";
  players.forEach(player => {
    const card = createPlayerCard(player);
    playersContainer.appendChild(card);
  });
}

// Izveido spēlētāja "kartīti"
function createPlayerCard(player) {
  const div = document.createElement("div");
  div.classList.add("player-card");
  div.draggable = true;
  div.dataset.uid = player.uid;
  div.dataset.name = player.name;

  // Drag & drop notikums
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

// Poga "Izveidot komandas" – apstrāde
function onCreateTeamsClick() {
  const count = parseInt(teamCountInput.value) || 0;
  generateTeams(count);
}

// Ģenerē komandu blokus
function generateTeams(count) {
  teamsContainer.innerHTML = "";
  teams = []; // Atiestata komandu masīvu

  for (let i = 0; i < count; i++) {
    const teamId = "team_" + i;
    const team = {
      id: teamId,
      name: `Komanda ${i+1}`,
      score: "",
      players: []
    };
    teams.push(team);

    // Izveido HTML elementus
    const teamBlock = document.createElement("div");
    teamBlock.classList.add("team-block");

    // Nosaukums
    const h3 = document.createElement("h3");
    h3.textContent = team.name;

    // Punktu ievades lauks
    const scoreInput = document.createElement("input");
    scoreInput.type = "text";
    scoreInput.placeholder = "Punkti";
    scoreInput.classList.add("team-score-input");
    scoreInput.addEventListener("input", onScoreInput);

    // Dropzone, kur nomest spēlētājus
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

// Apstrādā spēlētāja vilkšanu
function onPlayerDragStart(e) {
  e.dataTransfer.setData("text/plain", JSON.stringify({
    uid: e.target.dataset.uid,
    name: e.target.dataset.name
  }));
}

// Apstrādā vilkšanu virs dropzone
function onDragOver(e) {
  e.preventDefault();
  if (!e.currentTarget.classList.contains("hover")) {
    e.currentTarget.classList.add("hover");
  }
}

// Apstrādā nomest notikumu dropzone
function onDrop(e) {
  e.preventDefault();
  const dropzone = e.currentTarget;
  dropzone.classList.remove("hover");
  
  const data = e.dataTransfer.getData("text/plain");
  if (data) {
    try {
      const player = JSON.parse(data);
      const card = createPlayerCard(player);
      removePlayerCardFromTeams(player.uid);
      removePlayerCardFromContainer(player.uid, playersContainer);
      dropzone.appendChild(card);
    } catch (error) {
      console.error("Kļūda parsējot drag datus:", error);
    }
  }
}

// Noņem spēlētāja kartīti no komandu dropzone, ja jau tajā ir
function removePlayerCardFromTeams(uid) {
  const dropzones = teamsContainer.querySelectorAll(".dropzone");
  dropzones.forEach(dz => {
    const existingCard = dz.querySelector(`.player-card[data-uid="${uid}"]`);
    if (existingCard) {
      dz.removeChild(existingCard);
    }
  });
}

// Noņem spēlētāja kartīti no sākotnējā saraksta (playersContainer)
function removePlayerCardFromContainer(uid, container) {
  const existingCard = container.querySelector(`.player-card[data-uid="${uid}"]`);
  if (existingCard) {
    container.removeChild(existingCard);
  }
}

// Kad ievadīti punkti, pārbauda, vai jāparāda "Saglabāt rezultātus" poga
function onScoreInput(e) {
  checkIfShowSaveButton();
}

function checkIfShowSaveButton() {
  const scoreInputs = teamsContainer.querySelectorAll(".team-score-input");
  let anyScoreEntered = false;
  scoreInputs.forEach(input => {
    if (input.value.trim() !== "") {
      anyScoreEntered = true;
    }
  });
  saveResultsBtn.style.display = anyScoreEntered ? "inline-block" : "none";
}

// Apstrādā pogas "Saglabāt rezultātus" klikšķi
function onSaveResultsClick() {
  const teamBlocks = teamsContainer.querySelectorAll(".team-block");
  let results = []; // katram spēlētājam { uid, activity, points }

  teamBlocks.forEach(block => {
    const scoreInput = block.querySelector(".team-score-input");
    const dropzone = block.querySelector(".dropzone");
    const score = scoreInput.value.trim();

    const cards = dropzone.querySelectorAll(".player-card");
    cards.forEach(card => {
      const uid = card.dataset.uid;
      results.push({
        uid,
        activity: selectedActivity,
        points: score
      });
    });
  });

  if (results.length === 0) {
    alert("Nav spēlētāju, kam saglabāt rezultātus!");
    return;
  }

  saveResultsBtn.disabled = true;
  saveResultsToSheet(results)
    .then(resp => {
      if (resp.status === "ok") {
        alert("Rezultāti sekmīgi saglabāti!");
      } else {
        alert("Neizdevās saglabāt rezultātus: " + resp.message);
      }
    })
    .catch(err => {
      alert("Kļūda saglabājot rezultātus: " + err);
    })
    .finally(() => {
      saveResultsBtn.disabled = false;
    });
}

// Sūta rezultātus uz Google Sheets
function saveResultsToSheet(results) {
  const url = GSHEET_WEBAPP_URL + "?action=saveResults";
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ results })
  })
  .then(res => res.json());
}
