document.addEventListener('DOMContentLoaded', () => {
  // MAINIET UZ SAVU .../exec URL:
  const googleScriptUrl = 'https://script.google.com/macros/s/AKfycbwvbYSracMlNJ2dhhD74EtX2FjJ0ASsDcZBy7qGm9V-kgOWIoybclFSJN1dJ6TFmM-S/exec';
  
  let activities = [];
  let players = [];
  
  // Elementi
  const activitySelect = document.getElementById('activitySelect');
  const teamCountInput = document.getElementById('teamCount');
  const generateTeamsBtn = document.getElementById('generateTeamsBtn');
  const teamsContainer = document.getElementById('teamsContainer');
  const playersContainer = document.getElementById('playersContainer');
  const saveContainer = document.getElementById('saveContainer');
  const saveResultsBtn = document.getElementById('saveResultsBtn');
  
  // 1) Ielādē aktivitātes, spēlētājus
  function fetchData() {
    fetch(`${googleScriptUrl}?action=getData`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          // Aizpildām mainīgos
          activities = data.activities || [];
          players = data.players || [];
          populateActivities();
          populatePlayers();
        } else {
          console.error('Kļūda ielādējot datus:', data.message);
        }
      })
      .catch(err => {
        console.error('Kļūda ielādējot datus:', err);
      });
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
      div.innerHTML = `<div style="font-weight:bold;">${p.uid}</div><div>${p.name}</div>`;
      // Drag event
      div.addEventListener('dragstart', handleDragStart);
      div.addEventListener('dragend', handleDragEnd);
      playersContainer.appendChild(div);
    });
  }
  
  // 2) Drag & Drop
  let dragged = null;
  function handleDragStart(e) {
    dragged = this;
    this.classList.add('dragging');
    e.dataTransfer.setData('text/plain', this.dataset.uid);
    e.dataTransfer.effectAllowed = 'move';
  }
  function handleDragEnd() {
    this.classList.remove('dragging');
  }
  function handleDragOver(e) {
    e.preventDefault();
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
      dragged.parentNode.removeChild(dragged);
      this.appendChild(dragged);
    }
  }
  
  // 3) Komandu ģenerēšana
  generateTeamsBtn.addEventListener('click', () => {
    const count = parseInt(teamCountInput.value, 10);
    if (isNaN(count) || count < 1) {
      alert('Ievadi derīgu komandu skaitu');
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
      const dropzone = teamDiv.querySelector('.dropzone');
      dropzone.addEventListener('dragover', handleDragOver);
      dropzone.addEventListener('dragleave', handleDragLeave);
      dropzone.addEventListener('drop', handleDrop);
      teamsContainer.appendChild(teamDiv);
    }
    saveContainer.style.display = 'block';
  });
  
  // 4) Rezultātu saglabāšana
  saveResultsBtn.addEventListener('click', () => {
    const selectedActivity = activitySelect.value;
    if (!selectedActivity) {
      alert('Izvēlies aktivitāti!');
      return;
    }
    const results = [];
    document.querySelectorAll('.team').forEach(teamEl => {
      const teamScore = teamEl.querySelector('.team-score').value.trim();
      const teamId = teamEl.dataset.teamId;
      const pEls = teamEl.querySelectorAll('.player');
      pEls.forEach(p => {
        results.push({
          uid: p.dataset.uid,
          score: teamScore,
          team: teamId
        });
      });
    });
    
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
        alert('Kļūda saglabājot: ' + data.message);
      }
    })
    .catch(err => {
      console.error(err);
      alert('Neizdevās saglabāt rezultātus!');
    });
  });
  
  // Sākam ar datu ielādi
  fetchData();
});
