document.addEventListener('DOMContentLoaded', () => {
  // Aizstājiet ar savu Google Apps Script URL (beidzas ar .../exec)
  const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbwvbYSracMlNJ2dhhD74EtX2FjJ0ASsDcZBy7qGm9V-kgOWIoybclFSJN1dJ6TFmM-S/exec';
  
  let activities = [];
  let players = [];

  // Atlases
  const activitySelect = document.getElementById('activitySelect');
  const teamCountInput = document.getElementById('teamCount');
  const generateTeamsBtn = document.getElementById('generateTeamsBtn');
  const teamsContainer = document.getElementById('teamsContainer');
  const playersContainer = document.getElementById('playersContainer');
  const saveContainer = document.getElementById('saveContainer');
  const saveResultsBtn = document.getElementById('saveResultsBtn');
  
  // ==== 1) Ielādē sākotnējos datus (aktivitātes, spēlētājus) ====
  function fetchData() {
    fetch(`${googleScriptUrl}?action=getData`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          activities = data.activities || [];
          players = data.players || [];
          
          // Aizpildām aktivitāšu sarakstu
          populateActivities();
          // Aizpildām spēlētāju sarakstu
          populatePlayers();
        } else {
          console.error('Kļūda saņemot datus:', data.message);
        }
      })
      .catch(err => console.error('Kļūda fetchData:', err));
  }
  
  function populateActivities() {
    activitySelect.innerHTML = '';
    if (activities.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Nav aktivitāšu';
      activitySelect.appendChild(opt);
    } else {
      activities.forEach(act => {
        const opt = document.createElement('option');
        opt.value = act;
        opt.textContent = act;
        activitySelect.appendChild(opt);
      });
    }
  }

  function populatePlayers() {
    playersContainer.innerHTML = '';
    players.forEach(p => {
      const div = document.createElement('div');
      div.className = 'player';
      div.draggable = true;
      div.dataset.uid = p.uid;
      // Parādām UID augšā, vārdu apakšā
      div.innerHTML = `<div style="font-weight:bold;">${p.uid}</div><div>${p.name}</div>`;
      
      // Drag events
      div.addEventListener('dragstart', handleDragStart);
      div.addEventListener('dragend', handleDragEnd);
      playersContainer.appendChild(div);
    });
  }
  
  // ==== 2) Drag & Drop loģika ====
  let dragged = null;

  function handleDragStart(e) {
    dragged = this; // saglabājam, kurš elements tiek vilkts
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Lai Firefox/Chrome saprastu, ka vilkšana notiek
    e.dataTransfer.setData('text/plain', this.dataset.uid);
  }
  function handleDragEnd() {
    this.classList.remove('dragging');
  }
  function handleDragOver(e) {
    e.preventDefault();
    // Lai parādītos 'drop' efekts
    e.dataTransfer.dropEffect = 'move';
    this.classList.add('dragover');
  }
  function handleDragLeave() {
    this.classList.remove('dragover');
  }
  function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('dragover');
    if (dragged) {
      // Pārvietojam elementu no vecā konteinerā uz jauno
      dragged.parentNode.removeChild(dragged);
      this.appendChild(dragged);
    }
  }

  // ==== 3) Komandu izveide ====
  generateTeamsBtn.addEventListener('click', () => {
    const count = parseInt(teamCountInput.value, 10);
    if (isNaN(count) || count < 1) {
      alert('Lūdzu ievadi derīgu komandu skaitu.');
      return;
    }
    teamsContainer.innerHTML = '';
    
    for (let i = 1; i <= count; i++) {
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
      
      // Pievienojam dropzone eventus
      const dropzone = teamDiv.querySelector('.dropzone');
      dropzone.addEventListener('dragover', handleDragOver);
      dropzone.addEventListener('dragleave', handleDragLeave);
      dropzone.addEventListener('drop', handleDrop);
      
      teamsContainer.appendChild(teamDiv);
    }
    
    // Parādām saglabāšanas pogu, ja komandas izveidotas
    saveContainer.style.display = 'block';
  });

  // ==== 4) Rezultātu saglabāšana ====
  saveResultsBtn.addEventListener('click', () => {
    const selectedActivity = activitySelect.value;
    if (!selectedActivity) {
      alert('Lūdzu izvēlies aktivitāti no saraksta!');
      return;
    }
    
    const results = [];
    // Katru komandu un tās spēlētājus
    document.querySelectorAll('.team').forEach(teamEl => {
      const teamId = teamEl.dataset.teamId;
      const scoreInput = teamEl.querySelector('.team-score');
      const teamScore = scoreInput.value.trim();
      const dropzone = teamEl.querySelector('.dropzone');
      const teamPlayers = dropzone.querySelectorAll('.player');
      
      teamPlayers.forEach(playerEl => {
        results.push({
          uid: playerEl.dataset.uid,
          score: teamScore,
          team: teamId
        });
      });
    });
    
    // Tagad sūtām POST pieprasījumu uz Google Script
    fetch(googleScriptUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        action: 'saveResults',
        activity: selectedActivity,
        results: results
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'success') {
        alert('Rezultāti saglabāti!');
      } else {
        alert('Kļūda saglabājot rezultātus: ' + (data.message || 'unknown'));
      }
    })
    .catch(err => {
      console.error('POST error:', err);
      alert('Neizdevās saglabāt rezultātus (skat. konsoli).');
    });
  });

  // Uzreiz mēģinām ielādēt datus
  fetchData();
});
