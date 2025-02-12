document.addEventListener('DOMContentLoaded', async () => {
  // Piesaista HTML elementus
  const activityDropdown = document.getElementById('activityDropdown');
  const dataContainer = document.getElementById('dataContainer');
  const teamCountInput = document.getElementById('teamCountInput');
  const createTeamsBtn = document.getElementById('createTeamsBtn');
  const teamsContainer = document.getElementById('teamsContainer');
  const saveResultsButton = document.getElementById('saveResultsButton');

  // Google Apps Script Webapp URL
  const webAppUrl = 'https://script.google.com/macros/s/AKfycbwvbYSracMlNJ2dhhD74EtX2FjJ0ASsDcZBy7qGm9V-kgOWIoybclFSJN1dJ6TFmM-S/exec';

  try {
    // Iegūst datus no GAS
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
      // Saglabā UID datu atribūtā (no kolonnas B)
      box.dataset.uid = row.b;
      box.setAttribute('draggable', 'true');
      box.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ uid: row.b, id: box.id }));
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

  // Komandu izveides funkcionalitāte
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

      // Pievieno fiksētu punktu ievades lauku zem dropzone
      const pointsInput = document.createElement('input');
      pointsInput.className = 'points-input';
      pointsInput.type = 'text';
      pointsInput.placeholder = 'Punkti';
      teamBox.appendChild(pointsInput);

      teamsContainer.appendChild(teamBox);

      // Piesaista dropzone notikumus
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
            console.error("Kļūda parsējot drag datus:", err);
          }
        }
      });
    }
  });

  // Iespēja spēlētājus atvilkt atpakaļ uz sākotnējo konteinera (#dataContainer)
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

  // Saglabāšanas pogas notikumu apstrāde
  saveResultsButton.addEventListener('click', async () => {
    const selectedActivity = activityDropdown.value;
    let results = [];
    const teamBoxes = document.querySelectorAll('.team-box');
    teamBoxes.forEach(teamBox => {
      const points = teamBox.querySelector('.points-input').value;
      const dropzone = teamBox.querySelector('.team-dropzone');
      const playerCards = dropzone.querySelectorAll('.data-box');
      playerCards.forEach(playerCard => {
        const uid = playerCard.dataset.uid;
        if (uid) {
          results.push({ uid: uid, activity: selectedActivity, points: points });
        }
      });
    });
    try {
      const res = await fetch(webAppUrl + '?action=saveResults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: results })
      });
      const resultJson = await res.json();
      console.log("Saglabātie rezultāti:", resultJson);
      alert("Rezultāti saglabāti!");
    } catch (err) {
      console.error("Kļūda saglabājot rezultātus:", err);
      alert("Kļūda saglabājot rezultātus.");
    }
  });
});
