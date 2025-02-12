document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  const activityDropdown = document.getElementById('activityDropdown');
  const dataContainer = document.getElementById('dataContainer');
  const teamsContainer = document.getElementById('teamsContainer');
  const saveResultsGlobal = document.getElementById('saveResultsGlobal');
  
  // Web app URL (GET)
  const webAppUrl = 'https://script.google.com/macros/s/AKfycbyMHiivE56GC6okPj2xOYJaBGs-aF8Dxf_45Q6eprSs6_-vVrRCA1s0GMfrW_WaHhbzJA/exec';
  
  try {
    // Fetch data from backend (GET)
    const response = await fetch(webAppUrl);
    const json = await response.json();
    // Expected JSON keys: activities, players, teams

    // Populate activities dropdown
    json.activities.forEach(activity => {
      const option = document.createElement('option');
      option.value = activity;
      option.textContent = activity;
      activityDropdown.appendChild(option);
    });
    
    // Populate players container (dataArea) with draggable player cards
    json.players.forEach((player, index) => {
      const box = document.createElement('div');
      box.className = 'data-box';
      box.id = `player-${index}`;
      box.setAttribute('draggable', 'true');
      box.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ b: player.b, c: player.c, id: box.id }));
      });
      // Create spans: top (from column C) and bottom (from column B)
      const topSpan = document.createElement('span');
      topSpan.className = 'top';
      topSpan.textContent = player.c ? player.c : '';
      const bottomSpan = document.createElement('span');
      bottomSpan.className = 'bottom';
      bottomSpan.innerHTML = player.b ? `<b>${player.b}</b>` : '';
      box.appendChild(topSpan);
      box.appendChild(bottomSpan);
      dataContainer.appendChild(box);
    });
    
    // Populate teams container using team names from backend (from sheet "Komandas")
    // Here we expect json.teams is an array of non-empty team names.
    json.teams.forEach((teamName, index) => {
      const teamBox = document.createElement('div');
      teamBox.className = 'team-box';
      
      // Team name header (displayed in small letters)
      const header = document.createElement('h3');
      header.style.fontSize = '80%';
      header.textContent = teamName;
      teamBox.appendChild(header);
      
      // Create dropzone for players
      const dropzone = document.createElement('div');
      dropzone.className = 'team-dropzone';
      teamBox.appendChild(dropzone);
      
      // Create an input for symbols (positioned at the right side inside team box)
      const symbolsInput = document.createElement('input');
      symbolsInput.className = 'symbols-input';
      symbolsInput.type = 'text';
      symbolsInput.placeholder = 'Simboli';
      teamBox.appendChild(symbolsInput);
      
      // Create a points input that stays at the bottom of the team box
      const pointsInput = document.createElement('input');
      pointsInput.className = 'points-input';
      pointsInput.type = 'text';
      pointsInput.placeholder = 'Punkti';
      teamBox.appendChild(pointsInput);
      
      teamsContainer.appendChild(teamBox);
      
      // Add dropzone events for players
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('hover');
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('hover');
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('hover');
        const data = e.dataTransfer.getData('text/plain');
        if (data) {
          try {
            const playerData = JSON.parse(data);
            const originalElem = document.getElementById(playerData.id);
            if (originalElem) {
              dropzone.appendChild(originalElem);
            }
          } catch (err) {
            console.error("Error parsing drag data:", err);
          }
        }
      });
    });
    
  } catch (error) {
    console.error('Error fetching data from webapp:', error);
  }
  
  // Allow players to be dragged back to the players area
  dataContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  dataContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      try {
        const playerData = JSON.parse(data);
        const originalElem = document.getElementById(playerData.id);
        if (originalElem) {
          dataContainer.appendChild(originalElem);
        }
      } catch (err) {
        console.error("Error in dataContainer drop:", err);
      }
    }
  });
  
  // Save Results: collect data from each team and submit via hidden form
  saveResultsGlobal.addEventListener('click', () => {
    let results = [];
    const activity = activityDropdown.value;
    // For each team, get the team name, points, symbols, and the list of players dropped into its dropzone
    const teamBoxes = document.querySelectorAll('.team-box');
    teamBoxes.forEach((teamBox) => {
      const teamName = teamBox.querySelector('h3').textContent;
      const points = teamBox.querySelector('.points-input').value;
      const symbols = teamBox.querySelector('.symbols-input').value;
      const dropzone = teamBox.querySelector('.team-dropzone');
      let players = [];
      dropzone.querySelectorAll('.data-box').forEach((playerCard) => {
        const top = playerCard.querySelector('.top').textContent;
        const bottom = playerCard.querySelector('.bottom').textContent;
        players.push({ top: top, bottom: bottom });
      });
      results.push({ team: teamName, activity: activity, points: points, symbols: symbols, players: players });
    });
    console.log("Collected results:", results);
    postResults(results);
  });
  
  // Use a hidden form submission to POST results (bypassing CORS)
  function postResults(results) {
    const resultsData = document.getElementById('resultsData');
    resultsData.value = JSON.stringify({ results: results });
    document.getElementById('resultsForm').submit();
  }
});
