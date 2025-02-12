document.addEventListener('DOMContentLoaded', async () => {
  // Piesaistām HTML elementus
  const activityDropdown = document.getElementById('activityDropdown');
  const dataContainer = document.getElementById('dataContainer');

  // Google Apps Script Webapp URL
  const webAppUrl = 'https://script.google.com/macros/s/AKfycbwvbYSracMlNJ2dhhD74EtX2FjJ0ASsDcZBy7qGm9V-kgOWIoybclFSJN1dJ6TFmM-S/exec';

  try {
    // Iegūstam datus no GAS
    const response = await fetch(webAppUrl);
    const json = await response.json();

    // Aizpildām nolaižamo izvēlni ar aktivitātēm
    json.activities.forEach(activity => {
      const option = document.createElement('option');
      option.value = activity;
      option.textContent = activity;
      activityDropdown.appendChild(option);
    });

    // Izvadām katru rindas B un C vērtību jaunā "lodziņā"
    json.data.forEach(row => {
      // Izveido konteinera elementu
      const box = document.createElement('div');
      box.className = 'data-box';

      // B kolonna
      const bText = document.createElement('span');
      bText.innerHTML = `<b>${row.b}</b>`;

      // C kolonna
      const cText = document.createElement('span');
      // Ja C tukša (undefined vai ""), rāda tukšu
      cText.textContent = row.c ? row.c : '';

      box.appendChild(bText);
      box.appendChild(cText);
      dataContainer.appendChild(box);
    });

  } catch (error) {
    console.error('Kļūda, iegūstot datus no webapp:', error);
  }
});
