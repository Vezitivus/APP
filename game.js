document.addEventListener('DOMContentLoaded', function() {
  // Google Script endpoint URL
  const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbwvbYSracMlNJ2dhhD74EtX2FjJ0ASsDcZBy7qGm9V-kgOWIoybclFSJN1dJ6TFmM-S/exec';
  let activities = [];
  let players = [];

  // Elementu atlase
  const activitySelect = document.getElementById('activitySelect');
  const teamCountInput = document.getElementById('teamCount');
  const generateTeamsBtn = document.getElementById('generateTeamsBtn');
  const teamsContainer = document.getElementById('teamsContainer');
  const playersContainer = document.getElementById('playersContainer');
  const saveContainer = document.getElementById('saveContainer');
  const saveResultsBtn = document.getElementById('saveResultsBtn');

  // Funkcija datu ielādei no Google Script
  function fetchData() {
    fetch(googleScriptUrl + '?action=getData')
      .then(response => response.json())
      .then(data => {
        if(data.activities && data.players) {
          // Filtrē tukšos rezultātus no aktivitātēm
          activities = data.activities.filter(item => item.trim() !== '');
          players = data.players;
          populateActivities();
          populatePlayers();
        }
      })
      .catch(error => {
        console.error('Kļūda ielādējot datus:', error);
      });
  }

  // Aizpilda aktivitāšu izvēles lauku
  function populateActivities() {
    activitySelect.innerHTML = '';
    activities.forEach(activity => {
      const option = document.createElement('option');
      option.value = activity;
      option.textContent = activity;
      activitySelect.appendChild(option);
    });
  }

  // Aizpilda spēlētāju sarakstu ar draggable elementiem
  function populatePlayers() {
    playersContainer.innerHTML = '';
    players.forEach(player => {
      const playerDiv = document.createElement('div');
      playerDiv.className = 'player';
      playerDiv.draggable = true;
      playerDiv.dataset.uid = player.uid;
      playerDiv.innerHTML = `<div class="uid">${player.uid}</div><div class="name">${player.name}</div>`;
      
      // Pievieno drag notikumu klausītājus
      playerDiv.addEventListener('dragstart', handleDragStart);
      playerDiv.addEventListener('dragend', handleDragEnd);

      playersContainer.appendChild(playerDiv);
    });
  }

  // Drag & Drop notikumu apstrāde
  let dragged;

  function handleDragStart(e) {
    dragged = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.uid);
  }

  function handleDragEnd(e) {
    this.classList.remove('dragging');
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e) {
    e.preventDefault();
    if (dragged) {
      // Ja nepieciešams, izņem elementu no iepriekšējā konteinerā
      dragged.parentNode.removeChild(dragged);
      this.appendChild(dragged);
    }
  }

  // Ģenerē komandu laukus pēc ievadītā skaita
  generateTeamsBtn.addEventListener('click', function() {
    const count = parseInt(teamCountInput.value);
    if(isNaN(count) || count < 1) {
      alert('Lūdzu ievadi derīgu komandu skaitu.');
      return;
    }
    teamsContainer.innerHTML = '';
    for(let i = 1; i <= count; i++) {
      const teamDiv = document.createElement('div');
      teamDiv.className = 'team';
      teamDiv.dataset.teamId = i;
      teamDiv.innerHTML = `
        <div class="team-header">
          <span>Komanda ${i}</span>
          <input type="number" class="team-score" placeholder="Punkti" style="width:60px;">
        </div>
        <div class="dropzone" data-team-id="${i}">Nomet šeit spēlētājus</div>
      `;
      // Pievieno dropzone notikumu klausītājus
      const dropzone = teamDiv.querySelector('.dropzone');
      dropzone.addEventListener('dragover', handleDragOver);
      dropzone.addEventListener('drop', handleDrop);

      teamsContainer.appendChild(teamDiv);
    }
    // Parāda saglabāšanas pogu pēc komandu ģenerēšanas
    saveContainer.style.display = 'block';
  });

  // Saglabāšanas funkcionalitāte – nosūta rezultātus uz Google Script
  saveResultsBtn.addEventListener('click', function() {
    const selectedActivity = activitySelect.value;
    if(!selectedActivity) {
      alert('Lūdzu izvēlies aktivitāti.');
      return;
    }
    let results = [];
    // Iterē pa katru komandu un apkopo spēlētāju rezultātus
    document.querySelectorAll('.team').forEach(team => {
      const teamId = team.dataset.teamId;
      const scoreInput = team.querySelector('.team-score');
      const teamScore = scoreInput.value;
      const dropzone = team.querySelector('.dropzone');
      const teamPlayers = dropzone.querySelectorAll('.player');
      teamPlayers.forEach(playerEl => {
        results.push({
          uid: playerEl.dataset.uid,
          score: teamScore,
          team: teamId
        });
      });
    });
    // Nosūta POST pieprasījumu ar rezultātiem
    fetch(googleScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'saveResults',
        activity: selectedActivity,
        results: results
      })
    })
    .then(response => response.json())
    .then(data => {
      if(data.status === 'success') {
        alert('Rezultāti saglabāti!');
      } else {
        alert('Kļūda saglabājot rezultātus.');
      }
    })
    .catch(error => {
      console.error('Kļūda saglabājot rezultātus:', error);
      alert('Kļūda saglabājot rezultātus.');
    });
  });

  // Ielādē sākotnējos datus
  fetchData();
});
