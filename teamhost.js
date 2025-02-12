document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  const activityDropdown = document.getElementById('activityDropdown');
  const teamsContainer = document.getElementById('teamsContainer');
  const saveResultsGlobal = document.getElementById('saveResultsGlobal');
  
  // Web app URL for GET requests
  const webAppUrl = 'https://script.google.com/macros/s/AKfycbyMHiivE56GC6okPj2xOYJaBGs-aF8Dxf_45Q6eprSs6_-vVrRCA1s0GMfrW_WaHhbzJA/exec';
  
  try {
    const response = await fetch(webAppUrl);
    const json = await response.json();
    // json is expected to have: activities, teams, and optionally players.
    
    // Populate activities dropdown
    json.activities.forEach(activity => {
      const option = document.createElement('option');
      option.value = activity;
      option.textContent = activity;
      activityDropdown.appendChild(option);
    });
    
    // Populate teams container using teams data from "Komandas" sheet
    // Each team object is expected to be: { teamName: "Name", members: [ { id, name }, ... ] }
    json.teams.forEach((teamObj, index) => {
      const teamBox = document.createElement('div');
      teamBox.className = 'team-box';
      
      // Team name header (displayed in smaller letters)
      const header = document.createElement('h3');
      header.style.fontSize = '80%';
      header.textContent = teamObj.teamName;
      teamBox.appendChild(header);
      
      // Create container for team members
      const membersContainer = document.createElement('div');
      membersContainer.className = 'team-members';
      teamObj.members.forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.style.fontSize = '70%';
        memberDiv.textContent = member.name;
        // Optionally store the id in a data attribute for later use
        memberDiv.dataset.id = member.id;
        membersContainer.appendChild(memberDiv);
      });
      teamBox.appendChild(membersContainer);
      
      // Input for symbols
      const symbolsInput = document.createElement('input');
      symbolsInput.className = 'symbols-input';
      symbolsInput.type = 'text';
      symbolsInput.placeholder = 'Simboli';
      teamBox.appendChild(symbolsInput);
      
      // Input for team points
      const pointsInput = document.createElement('input');
      pointsInput.className = 'points-input';
      pointsInput.type = 'text';
      pointsInput.placeholder = 'Punkti';
      teamBox.appendChild(pointsInput);
      
      teamsContainer.appendChild(teamBox);
    });
    
  } catch (error) {
    console.error('Error fetching data:', error);
  }
  
  // Save Results button: collect data and submit via hidden form
  saveResultsGlobal.addEventListener('click', () => {
    let results = [];
    const activity = activityDropdown.value;
    const teamBoxes = document.querySelectorAll('.team-box');
    teamBoxes.forEach(teamBox => {
      const teamName = teamBox.querySelector('h3').textContent;
      const points = teamBox.querySelector('.points-input').value;
      const symbols = teamBox.querySelector('.symbols-input').value;
      let players = [];
      // For each member div, get the id from dataset (or fallback to text content)
      teamBox.querySelectorAll('.team-members > div').forEach(memberDiv => {
        let id = memberDiv.dataset.id || memberDiv.textContent;
        players.push({ top: "", bottom: id });
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
