document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  const activityDropdown = document.getElementById('activityDropdown');
  const teamsContainer = document.getElementById('teamsContainer');
  const saveResultsGlobal = document.getElementById('saveResultsGlobal');

  // Web app URL for GET requests
  const webAppUrl = 'https://script.google.com/macros/s/AKfycbyMHiivE56GC6okPj2xOYJaBGs-aF8Dxf_45Q6eprSs6_-vVrRCA1s0GMfrW_WaHhbzJA/exec';

  try {
    // Fetch data from backend
    const response = await fetch(webAppUrl);
    const json = await response.json();
    
    // Populate activity dropdown
    json.activities.forEach(activity => {
      const option = document.createElement('option');
      option.value = activity;
      option.textContent = activity;
      activityDropdown.appendChild(option);
    });
    
    // Populate teams container with team boxes (using team names and players from Komandas sheet)
    json.teams.forEach((teamObj, index) => {
      const teamBox = document.createElement('div');
      teamBox.className = 'team-box';
      
      // Team header (team name in large text)
      const header = document.createElement('h3');
      header.textContent = teamObj.team;
      teamBox.appendChild(header);
      
      // Player list inside the team box
      const playerList = document.createElement('div');
      playerList.className = 'player-list';
      teamObj.players.forEach(player => {
        if (player && player.toString().trim() !== "") {
          const playerItem = document.createElement('div');
          playerItem.className = 'player-item';
          playerItem.textContent = player;
          playerList.appendChild(playerItem);
        }
      });
      teamBox.appendChild(playerList);
      
      // Remove the symbols input field (it is not needed)
      
      // Points input: position it to the right side of the team box (outside)
      const pointsInput = document.createElement('input');
      pointsInput.className = 'points-input';
      pointsInput.type = 'text';
      pointsInput.placeholder = 'Punkti';
      teamBox.appendChild(pointsInput);
      
      teamsContainer.appendChild(teamBox);
    });
  } catch (error) {
    console.error("Error fetching data from webapp:", error);
  }
  
  // Save Results: Collect data from each team and submit via hidden form
  saveResultsGlobal.addEventListener('click', () => {
    let results = [];
    const activity = activityDropdown.value;
    const teamBoxes = document.querySelectorAll('.team-box');
    teamBoxes.forEach(teamBox => {
      const teamName = teamBox.querySelector('h3').textContent;
      const points = teamBox.querySelector('.points-input').value;
      let players = [];
      const playerItems = teamBox.querySelectorAll('.player-item');
      playerItems.forEach(item => {
        players.push(item.textContent);
      });
      results.push({ team: teamName, activity: activity, points: points, players: players });
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
