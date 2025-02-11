// Norādiet savu Google Apps Script Web App URL
const GS_URL = "https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec";

// Globālie mainīgie datu glabāšanai
let allActivities = [];  // dati no F4:AP4
let allPlayers = [];     // masīvs ar objektiem { uid, name }
let teams = [];          // komandu objekti: { id, name, score, players: [] }

// HTML elementu atsauces (tiek ielādētas pēc DOMContentLoaded)
let activitySelect, teamCountInput, createTeamsBtn, teamsContainer, playersContainer, saveResultsBtn;

// Inicializācija pēc lapas ielādes
window.addEventListener("DOMContentLoaded", init);

function init() {
  // Saglabā atsauces uz DOM elementiem
  activitySelect   = document.getElementById("activitySelect");
  teamCountInput   = document.getElementById("teamCountInput");
  createTeamsBtn   = document.getElementById("createTeamsBtn");
  teamsContainer   = document.getElementById("teamsContainer");
  playersContainer = document.getElementById("playersContainer");
  saveResultsBtn   = document.getElementById("saveResults");

  // Piesaista notikumu klausītājus, ja elementi pastāv
  if (createTeamsBtn) {
    createTeamsBtn.addEventListener("click", onCreateTeamsClick);
  } else {
    console.error("Elementam ar id 'createTeamsBtn' nav atrasts.");
  }
  if (saveResultsBtn) {
    saveResultsBtn.addEventListener("click", onSaveResultsClick);
  } else {
    console.error("Elementam ar id 'saveResults' nav atrasts.");
  }

  // Ielādē aktivitātes
  fetchActivities()
    .then(activities => {
      allActivities = activities;
      populateActivitySelect();
    })
    .catch(err => console.error("Error in fetchActivities: " + err));

  // Ielādē spēlētājus
  fetchPlayers()
    .then(players => {
      allPlayers = players;
      renderPlayers(players);
    })
    .catch(err => console.error("Error in fetchPlayers: " + err));
}

// Iegūst aktivitātes no Google Apps Script (no F4:AP4)
function fetchActivities() {
  const url = GS_URL + "?action=getActivities";
  return fetch(url)
    .then(res => res.json())
    .then(json => {
      if (json.status === "ok") {
        return json.data; 
      } else {
        throw new Error("fetchActivities failed: " + (json.message || "Unknown error"));
      }
    });
}

// Iegūst spēlētājus no Google Apps Script (no B6:B1000 un C6:C1000)
function fetchPlayers() {
  const url = GS_URL + "?action=getPlayers";
  return fetch(url)
    .then(res => res.json())
    .then(json => {
      if (json.status === "ok") {
        return json.data; 
      } else {
        throw new Error("fetchPlayers failed: " + (json.message || "Unknown error"));
      }
    });
}

// Aizpilda aktivitāšu izvēles sarakstu
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

// Attēlo visus spēlētājus sākotnēji (no Google Sheets)
function renderPlayers(players) {
  playersContainer.innerHTML = "";
  players.forEach(player => {
    const card = createPlayerCard(player);
    playersContainer.appendChild(card);
  });
}

// Izveido vienu spēlētāja "kartīti"
function createPlayerCard(player) {
  const div = document.createElement("div");
  div.classList.add("player-card");
  div.draggable = true;
  div.dataset.uid = player.uid;
  div.dataset.name = player.name;

  // Piesaista drag notikumu
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

// Poga "Izveidot komandas" – ģenerē komandu blokus
function onCreateTeamsClick() {
  const count = parseInt(teamCountInput.value) || 0;
  generateTeams(count);
}

// Ģenerē komandu blokus
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

    // Veido komandas HTML elementus
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

// Drag sākšanas notikums spēlētāja kartītei
function onPlayerDragStart(e) {
  e.dataTransfer.setData("text/plain", JSON.stringify({
    uid: e.target.dataset.uid,
    name: e.target.dataset.name
  }));
}

// Apstrādā vilkšanas notikumu pār dropzone
function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("hover");
}

// Apstrādā nomest notikumu dropzone
function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("hover");

  const data = e.dataTransfer.getData("text/plain");
  if (data) {
    try {
      const player = JSON.parse(data);
      const card = createPlayerCard(player);
      removePlayerCardFromTeams(player.uid);
      removePlayerCardFromContainer(player.uid, playersContainer);
      e.currentTarget.appendChild(card);
    } catch (error) {
      console.error("Error in onDrop while parsing drag data: " + error);
    }
  }
}

// Noņem spēlētāja kartīti no visām komandu dropzone
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

// Kad tiek ievadīti punkti, pārbauda, vai jādodas uz "Saglabāt rezultātus" pogu
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

// Saglabā rezultātus – izveido masīvu ar katra spēlētāja datiem no komandām
function onSaveResultsClick() {
  const teamBlocks = teamsContainer.querySelectorAll(".team-block");
  let results = [];

  teamBlocks.forEach(block => {
    const scoreInput = block.querySelector(".team-score-input");
    const dropzone = block.querySelector(".dropzone");
    const score = scoreInput.value.trim();

    const cards = dropzone.querySelectorAll(".player-card");
    cards.forEach(card => {
      const uid = card.dataset.uid;
      results.push({
        uid,
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
    .then(resp => {
      alert("Rezultāti saglabāti veiksmīgi!");
    })
    .catch(err => {
      console.error("Error in onSaveResultsClick while saving results: " + err);
      alert("Kļūda saglabājot rezultātus.");
    })
    .finally(() => {
      saveResultsBtn.disabled = false;
    });
}

// Sūta rezultātus uz Google Sheets
function saveResults(results) {
  const url = GS_URL + "?action=saveResults";
  return fetch(url, {
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
      throw new Error("saveResults failed: " + (data.message || "Unknown error"));
    }
  });
}
