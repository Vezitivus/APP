document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  const activityDropdown = document.getElementById('activityDropdown');
  const teamsContainer = document.getElementById('teamsContainer');
  const saveResultsGlobal = document.getElementById('saveResultsGlobal');

  // Your Google Apps Script Web App URL for GET requests
  const webAppUrl = 'https://script.google.com/macros/s/AKfycbyMHiivE56GC6okPj2xOYJaBGs-aF8Dxf_45Q6eprSs6_-vVrRCA1s0GMfrW_WaHhbzJA/exec';

  try {
    // Fetch data from your backend
    const response = await fetch(webAppUrl);
    const json = await response.json();
    // Expected JSON structure: { activities: [...], teams: [ { team: "TeamName", players: [ "Player1", "Player2", ... ] }, ... ] }

    // Populate activities dropdown
    json.activities.forEach(activity => {
      const option = document.createElement('option');
      option.value = activity;
      option.textContent = activity;
      activityDropdown.appendChild(option);
    });

    // Populate teams container with team boxes
    json.teams.forEach((teamObj, index) => {
      const teamBox = document.createElement('div');
      teamBox.className = 'team-box';
      
      // Team header (team name in small letters)
      const header = document.createElement('h3');
      header.textContent = teamObj.team;
      teamBox.appendChild(header);
      
      // Player list inside the team box
      const playerList = document.createElement('div');
      playerList.className = 'player-list';
      // For each player (non-empty) from the team data
      teamObj.players.forEach(player => {
        if(player) { // ignore empty cells
          const playerItem = document.createElement('div');
          playerItem.className = 'player-item';
          playerItem.textContent = player;
          playerList.appendChild(playerItem);
        }
      });
      teamBox.appendChild(playerList);
      
      // Symbols input (placed to the right inside team box – here, we simply add it below the player list)
      const symbolsInput = document.createElement('input');
      symbolsInput.className = 'symbols-input';
      symbolsInput.type = 'text';
      symbolsInput.placeholder = 'Simboli';
      teamBox.appendChild(symbolsInput);
      
      // Points input at the bottom
      const pointsInput = document.createElement('input');
      pointsInput.className = 'points-input';
      pointsInput.type = 'text';
      pointsInput.placeholder = 'Punkti';
      teamBox.appendChild(pointsInput);
      
      teamsContainer.appendChild(teamBox);
    });
  } catch (error) {
    console.error('Error fetching data from webapp:', error);
  }
  
  // Save results button: Collects data and submits via hidden form
  saveResultsGlobal.addEventListener('click', () => {
    let results = [];
    const activity = activityDropdown.value;
    const teamBoxes = document.querySelectorAll('.team-box');
    teamBoxes.forEach(teamBox => {
      const teamName = teamBox.querySelector('h3').textContent;
      const points = teamBox.querySelector('.points-input').value;
      const symbols = teamBox.querySelector('.symbols-input').value;
      const playerItems = teamBox.querySelectorAll('.player-item');
      let players = [];
      playerItems.forEach(item => {
        players.push(item.textContent);
      });
      results.push({ team: teamName, activity: activity, points: points, symbols: symbols, players: players });
    });
    console.log("Collected results:", results);
    postResults(results);
  });
  
  function postResults(results) {
    const resultsData = document.getElementById('resultsData');
    resultsData.value = JSON.stringify({ results: results });
    document.getElementById('resultsForm').submit();
  }
});
