document.addEventListener('DOMContentLoaded', async () => {
  // Piesaista HTML elementus
  const activityDropdown = document.getElementById('activityDropdown');
  const dataContainer = document.getElementById('dataContainer');
  const teamCountInput = document.getElementById('teamCountInput');
  const createTeamsBtn = document.getElementById('createTeamsBtn');
  const teamsContainer = document.getElementById('teamsContainer');
  const saveResultsButton = document.getElementById('saveResultsButton');
  const splitButton = document.getElementById('splitButton');
  const sendTeamNamesButton = document.getElementById('sendTeamNamesButton');

  // Google Apps Script Webapp URL (for GET requests)
  const webAppUrl = 'https://script.google.com/macros/s/AKfycbwvbYSracMlNJ2dhhD74EtX2FjJ0ASsDcZBy7qGm9V-kgOWIoybclFSJN1dJ6TFmM-S/exec';

  try {
    // Iegūst datus no GAS (GET)
    const response = await fetch(webAppUrl);
    const json = await response.json();

    // Aizpilda nolaižamo izvēlni ar aktivitātēm
    json.activities.forEach(activity => {
      const option = document.createElement('option');
      option.value = activity;
      option.textContent = activity;
      activityDropdown.appendChild(option);
    });

    // Izvada katru rindu kā spēlētāja kartīti (data-box)
    json.data.forEach((row, index) => {
      const box = document.createElement('div');
      box.className = 'data-box';
      box.id = `player-${index}`;
      box.setAttribute('draggable', 'true');
      box.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ b: row.b, c: row.c, id: box.id }));
      });

      // Izveido span elementus: "top" (kolonna C augšā) un "bottom" (kolonna B apakšā)
      const topSpan = document.createElement('span');
      topSpan.className = 'top';
      topSpan.textContent = row.c ? row.c : '';

      const bottomSpan = document.createElement('span');
      bottomSpan.className = 'bottom';
      bottomSpan.innerHTML = row.b ? `<b>${row.b}</b>` : '';

      box.appendChild(topSpan);
      box.appendChild(bottomSpan);
      dataContainer.appendChild(box);
    });
  } catch (error) {
    console.error('Kļūda, iegūstot datus no webapp:', error);
  }

  // Komandu izveide – izveido komandu laukus ar dropzone un fiksētu punktu ievades lauku
  createTeamsBtn.addEventListener('click', () => {
    teamsContainer.innerHTML = '';
    const count = parseInt(teamCountInput.value) || 0;
    for (let i = 0; i < count; i++) {
      const teamBox = document.createElement('div');
      teamBox.className = 'team-box';

      // Komandas nosaukums
      const header = document.createElement('h3');
      header.textContent = `Komanda ${i + 1}`;
      teamBox.appendChild(header);

      // Izveido dropzone elementu
      const dropzone = document.createElement('div');
      dropzone.className = 'team-dropzone';
      teamBox.appendChild(dropzone);

      // Fiksēts punktu ievades lauks – paliek zem dropzone
      const pointsInput = document.createElement('input');
      pointsInput.className = 'points-input';
      pointsInput.type = 'text';
      pointsInput.placeholder = 'Punkti';
      teamBox.appendChild(pointsInput);

      teamsContainer.appendChild(teamBox);
    }
    // Parādām SPLIT pogu, kad komandas ir izveidotas
    splitButton.style.display = 'block';
  });

  // SPLIT pogas funkcionalitāte – sadala visus spēlētājus randomizēti starp komandu dropzones
  splitButton.addEventListener('click', () => {
    let allPlayers = Array.from(document.querySelectorAll('.data-box'));
    // Shuffle (Fisher-Yates)
    for (let i = allPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPlayers[i], allPlayers[j]] = [allPlayers[j], allPlayers[i]];
    }
    const teamBoxes = Array.from(document.querySelectorAll('.team-box'));
    const numTeams = teamBoxes.length;
    const totalPlayers = allPlayers.length;
    const baseCount = Math.floor(totalPlayers / numTeams);
    const remainder = totalPlayers % numTeams;
    let currentIndex = 0;
    teamBoxes.forEach((teamBox, index) => {
      const dropzone = teamBox.querySelector('.team-dropzone');
      dropzone.innerHTML = '';
      let countForThisTeam = baseCount + (index < remainder ? 1 : 0);
      for (let i = 0; i < countForThisTeam; i++) {
        if (currentIndex < allPlayers.length) {
          dropzone.appendChild(allPlayers[currentIndex]);
          currentIndex++;
        }
      }
    });
  });

  // Iespēja atvilkt spēlētājus atpakaļ uz sākotnējo konteinera (dataContainer)
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
        console.error("Kļūda dataContainer drop:", err);
      }
    }
  });

  // Poga "Saglabāt rezultātus" – apkopo rezultātus un nosūta uz GAS, izmantojot formu
  saveResultsButton.addEventListener('click', () => {
    let results = [];
    const activity = activityDropdown.value;
    const teamBoxes = document.querySelectorAll('.team-box');
    teamBoxes.forEach((teamBox) => {
      const teamName = teamBox.querySelector('h3').textContent;
      const points = teamBox.querySelector('.points-input').value;
      const dropzone = teamBox.querySelector('.team-dropzone');
      let players = [];
      dropzone.querySelectorAll('.data-box').forEach((playerCard) => {
        const top = playerCard.querySelector('.top').textContent;
        const bottom = playerCard.querySelector('.bottom').textContent;
        players.push({ top: top, bottom: bottom });
      });
      results.push({ team: teamName, activity: activity, points: points, players: players });
    });
    console.log("Saglabātie rezultāti:", results);
    postResults(results);
  });

  // New button "Sūtīt komandas nosaukumu" – sends each team’s name to the sheet "Lapa1"
  sendTeamNamesButton.addEventListener('click', () => {
    let results = [];
    const teamBoxes = document.querySelectorAll('.team-box');
    teamBoxes.forEach((teamBox) => {
      const teamName = teamBox.querySelector('h3').textContent;
      const dropzone = teamBox.querySelector('.team-dropzone');
      let players = [];
      dropzone.querySelectorAll('.data-box').forEach((playerCard) => {
        const top = playerCard.querySelector('.top').textContent;
        const bottom = playerCard.querySelector('.bottom').textContent;
        players.push({ top: top, bottom: bottom });
      });
      results.push({ team: teamName, players: players });
    });
    console.log("Nosūtām komandas nosaukumu:", results);
    postTeamNames(results);
  });

  function postResults(results) {
    const resultsData = document.getElementById('resultsData');
    resultsData.value = JSON.stringify({ results: results });
    // Ensure form action is set to saveResults
    const resultsForm = document.getElementById('resultsForm');
    resultsForm.action = webAppUrl + '?action=saveResults';
    resultsForm.submit();
  }
  
  function postTeamNames(results) {
    const resultsData = document.getElementById('resultsData');
    resultsData.value = JSON.stringify({ results: results });
    // Set form action to new action "sendTeamNames"
    const resultsForm = document.getElementById('resultsForm');
    resultsForm.action = "https://script.google.com/macros/s/AKfycbwvbYSracMlNJ2dhhD74EtX2FjJ0ASsDcZBy7qGm9V-kgOWIoybclFSJN1dJ6TFmM-S/exec?action=sendTeamNames";
    resultsForm.submit();
  }
});
