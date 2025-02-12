document.addEventListener('DOMContentLoaded', async () => {
  // Piesaista HTML elementus
  const activityDropdown = document.getElementById('activityDropdown');
  const dataContainer = document.getElementById('dataContainer');
  const teamCountInput = document.getElementById('teamCountInput');
  const createTeamsBtn = document.getElementById('createTeamsBtn');
  const teamsContainer = document.getElementById('teamsContainer');

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

    // Izvada katru rindas B un C vērtību jaunā "data-box" elementā
    json.data.forEach((row, index) => {
      // Izveido datu kartīti
      const box = document.createElement('div');
      box.className = 'data-box';
      // Pievieno unikālu id, lai pēc tam to varētu noņemt
      box.id = `player-${index}`;
      // Padara elementu draggable
      box.setAttribute('draggable', 'true');
      // Piesaista drag start notikumu
      box.addEventListener('dragstart', (e) => {
        // Saglabā datus JSON formātā (var izmantot gan b un c vērtības)
        e.dataTransfer.setData('text/plain', JSON.stringify({ b: row.b, c: row.c, id: box.id }));
      });

      // B kolonna – uzrāda b vērtību treknrakstā
      const bText = document.createElement('span');
      bText.innerHTML = `<b>${row.b}</b>`;
      // C kolonna – uzrāda c vērtību (ja nav tukša)
      const cText = document.createElement('span');
      cText.textContent = row.c ? row.c : '';

      box.appendChild(bText);
      box.appendChild(cText);
      dataContainer.appendChild(box);
    });
  } catch (error) {
    console.error('Kļūda, iegūstot datus no webapp:', error);
  }

  // Piesaista notikumu klausītājus izveidojot komandu laukus
  createTeamsBtn.addEventListener('click', () => {
    // Notīra komandu konteineru pirms jaunu izveides
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
            // Meklē oriģinālo datu kartīti pēc unikālā id
            const originalElem = document.getElementById(playerData.id);
            if (originalElem) {
              // Pārvieto kartīti uz dropzone
              dropzone.appendChild(originalElem);
            }
          } catch (err) {
            console.error("Kļūda parsējot drag datus:", err);
          }
        }
      });
    }
  });
});
