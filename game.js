// Function to show a custom popup notification
function showPopup(message) {
  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.textContent = message;
  document.body.appendChild(popup);
  setTimeout(() => {
    popup.remove();
  }, 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Get references to HTML elements
  const activityDropdown = document.getElementById('activityDropdown');
  const dataContainer = document.getElementById('dataContainer');
  const teamCountInput = document.getElementById('teamCountInput');
  const createTeamsBtn = document.getElementById('createTeamsBtn');
  const teamsContainer = document.getElementById('teamsContainer');
  const saveResultsButton = document.getElementById('saveResultsButton');
  const splitButton = document.getElementById('splitButton');
  const sendTeamNamesButton = document.getElementById('sendTeamNamesButton');
  const deleteTeamsButton = document.getElementById('deleteTeamsButton');

  // Google Apps Script Webapp URL for GET requests
  const webAppUrl = 'https://script.google.com/macros/s/AKfycbwvbYSracMlNJ2dhhD74EtX2FjJ0ASsDcZBy7qGm9V-kgOWIoybclFSJN1dJ6TFmM-S/exec';

  try {
    const response = await fetch(webAppUrl);
    const json = await response.json();

    json.activities.forEach(activity => {
      const option = document.createElement('option');
      option.value = activity;
      option.textContent = activity;
      activityDropdown.appendChild(option);
    });

    json.data.forEach((row, index) => {
      const box = document.createElement('div');
      box.className = 'data-box';
      box.id = `player-${index}`;
      // Saglabājam unikālo identifikatoru (uid) no datiem (pieņemot, ka row.b ir uid)
      box.dataset.uid = row.b;

      box.setAttribute('draggable', 'true');
      box.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData('text/plain', JSON.stringify({ b: row.b, c: row.c, id: box.id }));
      });

      const topSpan = document.createElement('span');
      topSpan.className = 'top';
      topSpan.textContent = row.c ? row.c : '';

      const bottomSpan = document.createElement('span');
      bottomSpan.className = 'bottom';
      bottomSpan.innerHTML = row.b ? `<b>${row.b}</b>` : '';

      // Create the close (X) button
      const closeBtn = document.createElement('span');
      closeBtn.className = 'close-btn';
      closeBtn.textContent = 'X';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = closeBtn.parentElement;
        card.setAttribute("draggable", "true");
        dataContainer.appendChild(card);
        showPopup("Spēlētājs atgriezts sākotnējā sarakstā");
      });

      box.appendChild(closeBtn);
      box.appendChild(topSpan);
      box.appendChild(bottomSpan);
      dataContainer.appendChild(box);
    });
  } catch (error) {
    console.error('Kļūda, iegūstot datus no webapp:', error);
  }

  createTeamsBtn.addEventListener('click', () => {
    teamsContainer.innerHTML = '';
    const count = parseInt(teamCountInput.value) || 0;
    for (let i = 0; i < count; i++) {
      const teamBox = document.createElement('div');
      teamBox.className = 'team-box';

      const header = document.createElement('h3');
      header.textContent = `Komanda ${i + 1}`;
      teamBox.appendChild(header);

      const dropzone = document.createElement('div');
      dropzone.className = 'team-dropzone';
      teamBox.appendChild(dropzone);

      const pointsInput = document.createElement('input');
      pointsInput.className = 'points-input';
      pointsInput.type = 'text';
      pointsInput.placeholder = 'Punkti';
      teamBox.appendChild(pointsInput);

      teamsContainer.appendChild(teamBox);

      // Dropzone events
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
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
              originalElem.setAttribute("draggable", "true");
              dropzone.appendChild(originalElem);
            }
          } catch (err) {
            console.error("Kļūda parsējot drag datus:", err);
          }
        }
      });
    }
    splitButton.style.display = 'block';
    showPopup("Komandu lauki izveidoti!");
  });

  splitButton.addEventListener('click', () => {
    let allPlayers = Array.from(document.querySelectorAll('.data-box'));
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
          allPlayers[currentIndex].setAttribute("draggable", "true");
          currentIndex++;
        }
      }
    });
    showPopup("Spēlētāji sadalīti pa komandām!");
  });

  dataContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });
  dataContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (data) {
      try {
        const playerData = JSON.parse(data);
        const originalElem = document.getElementById(playerData.id);
        if (originalElem) {
          originalElem.setAttribute("draggable", "true");
          dataContainer.appendChild(originalElem);
          showPopup("Spēlētājs atgriezts sākotnējā sarakstā");
        }
      } catch (err) {
        console.error("Kļūda dataContainer drop:", err);
      }
    }
  });

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
        // Ja ir pieejams uid, to iekļaujam
        const uid = playerCard.dataset.uid;
        players.push({ top: top, bottom: bottom, uid: uid });
      });
      results.push({ team: teamName, activity: activity, points: points, players: players });
    });
    console.log("Saglabātie rezultāti:", results);
    postResults(results);
  });

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
        // Iekļaujam arī uid, lai Google Sheets varētu meklēt pēc tā
        const uid = playerCard.dataset.uid;
        players.push({ top: top, bottom: bottom, uid: uid });
      });
      results.push({ team: teamName, players: players });
    });
    console.log("Nosūtām komandas nosaukumu:", results);
    postTeamNames(results);
  });

  deleteTeamsButton.addEventListener('click', () => {
    postDeleteTeams();
    showPopup("Komandas izdzēstas!");
  });

  function postResults(results) {
    const resultsData = document.getElementById('resultsData');
    resultsData.value = JSON.stringify({ results: results });
    const resultsForm = document.getElementById('resultsForm');
    resultsForm.action = webAppUrl + '?action=saveResults';
    resultsForm.submit();
  }
  
  function postTeamNames(results) {
    const resultsData = document.getElementById('resultsData');
    resultsData.value = JSON.stringify({ results: results });
    const resultsForm = document.getElementById('resultsForm');
    resultsForm.action = webAppUrl + '?action=sendTeamNames';
    resultsForm.submit();
  }

  function postDeleteTeams() {
    const resultsData = document.getElementById('resultsData');
    // Nosūta tukšu datu bloku, kas norāda uz kolonnu dzēšanu
    resultsData.value = JSON.stringify({ action: "deleteTeams" });
    const resultsForm = document.getElementById('resultsForm');
    resultsForm.action = webAppUrl + '?action=deleteTeams';
    resultsForm.submit();
  }
});
