// Aizstājiet ar savu reālo Web App URL
const GS_URL = "https://script.google.com/macros/s/AKfycbwvbYSracMlNJ2dhhD74EtX2FjJ0ASsDcZBy7qGm9V-kgOWIoybclFSJN1dJ6TFmM-S/exec";

// Globālie mainīgie
let allActivities = [];
let allPlayers = [];
let teams = [];

// HTML elementu references
let activitySelect, teamCountInput, createTeamsBtn, teamsContainer, playersContainer, saveResultsBtn;

window.addEventListener("DOMContentLoaded", init);

function init() {
  activitySelect   = document.getElementById("activitySelect");
  teamCountInput   = document.getElementById("teamCountInput");
  createTeamsBtn   = document.getElementById("createTeamsBtn");
  teamsContainer   = document.getElementById("teamsContainer");
  playersContainer = document.getElementById("playersContainer");
  saveResultsBtn   = document.getElementById("saveResults");

  if (createTeamsBtn) {
    createTeamsBtn.addEventListener("click", onCreateTeamsClick);
  }
  if (saveResultsBtn) {
    saveResultsBtn.addEventListener("click", onSaveResultsClick);
  }

  // Ielādē aktivitātes un spēlētājus
  fetchActivities()
    .then(activities => {
      allActivities = activities;
      populateActivitySelect();
    })
    .catch(err => console.error("Error in fetchActivities:", err));

  fetchPlayers()
    .then(players => {
      allPlayers = players;
      renderPlayers(players);
    })
    .catch(err => console.error("Error in fetchPlayers:", err));
}

// 1. AJAX – getActivities
function fetchActivities() {
  const url = GS_URL + "?action=getActivities";
  return fetch(url)
    .then(res => res.json())
    .then(json => {
      if (json.status === "ok") {
        return json.data;
      } else {
        throw new Error(json.message || "fetchActivities failed");
      }
    });
}

// 2. AJAX – getPlayers
function fetchPlayers() {
  const url = GS_URL + "?action=getPlayers";
  return fetch(url)
    .then(res => res.json())
    .then(json => {
      if (json.status === "ok") {
        return json.data;
      } else {
        throw new Error(json.message || "fetchPlayers failed");
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
  allActivities.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a;
    opt.textContent = a;
    activitySelect.appendChild(opt);
  });
  activitySelect.selectedIndex = 0;
}

// Attēlo spēlētājus
function renderPlayers(players) {
  playersContainer.innerHTML = "";
  players.forEach(p => {
    const card = createPlayerCard(p);
    playersContainer.appendChild(card);
  });
}

// Izveido HTML kartīti spēlētājam
function createPlayerCard(player) {
  const div = document.createElement("div");
  div.classList.add("player-card");
  div.draggable = true;
  div.dataset.uid = player.uid;
  div.dataset.name = player.name;

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

function onCreateTeamsClick() {
  const count = parseInt(teamCountInput.value) || 0;
  generateTeams(count);
}

// Izveido X komandu lauciņus
function generateTeams(count) {
  teamsContainer.innerHTML = "";
  teams = [];
  
  for (let i = 0; i < count; i++) {
    const teamId = "team_" + i;
    const team = {
      id: teamId,
      name: `Komanda ${i+1}`,
      score: "",
      players: []
    };
    teams.push(team);

    // HTML:
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

// DragStart – piesaista JSON ar uid, name
function onPlayerDragStart(e) {
  const data = {
    uid: e.target.dataset.uid,
    name: e.target.dataset.name
  };
  e.dataTransfer.setData("text/plain", JSON.stringify(data));
}

// DragOver
function onDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("hover");
}

// Drop
function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("hover");
  
  const data = e.dataTransfer.getData("text/plain");
  if (data) {
    try {
      const player = JSON.parse(data);
      // Izveido jaunu kartīti
      const card = createPlayerCard(player);
      // Noņem to no citām komandām
      removePlayerCardFromTeams(player.uid);
      // Noņem no sākotnējā saraksta, ja atrodas tur
      removePlayerCardFromContainer(player.uid, playersContainer);
      // Pievieno dropzone
      e.currentTarget.appendChild(card);
    } catch (err) {
      console.error("onDrop error:", err);
    }
  }
}

// Noņem spēlētāja kartīti no visām komandām
function removePlayerCardFromTeams(uid) {
  const dropzones = teamsContainer.querySelectorAll(".dropzone");
  dropzones.forEach(dz => {
    const existingCard = dz.querySelector(`.player-card[data-uid="${uid}"]`);
    if (existingCard) {
      dz.removeChild(existingCard);
    }
  });
}

// Noņem spēlētāja kartīti no sākotnējā saraksta
function removePlayerCardFromContainer(uid, container) {
  const existingCard = container.querySelector(`.player-card[data-uid="${uid}"]`);
  if (existingCard) {
    container.removeChild(existingCard);
  }
}

// Katru reizi, kad ievadām punktu, pārbaudām, vai rādīt "Saglabāt"
function onScoreInput() {
  checkIfShowSaveButton();
}

function checkIfShowSaveButton() {
  const scoreInputs = document.querySelectorAll(".team-score-input");
  let anyScore = false;
  scoreInputs.forEach(inp => {
    if (inp.value.trim() !== "") {
      anyScore = true;
    }
  });
  saveResultsBtn.style.display = anyScore ? "inline-block" : "none";
}

// Klikšķis uz "Saglabāt rezultātus"
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
      alert("Rezultāti saglabāti!");
    })
    .catch(err => {
      console.error("Kļūda saglabājot rezultātus:", err);
      alert("Kļūda saglabājot rezultātus.");
    })
    .finally(() => {
      saveResultsBtn.disabled = false;
    });
}

// Sūta datus uz Apps Script (saveResults)
function saveResults(results) {
  const url = GS_URL + "?action=saveResults";
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ results })
  })
  .then(r => r.json())
  .then(data => {
    if (data.status !== "ok") {
      throw new Error(data.message || "Unknown saveResults error");
    }
  });
}
