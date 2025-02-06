document.addEventListener("DOMContentLoaded", function () {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("uid");

  if (!uid) {
    document.body.innerHTML = "<h1 class='error'>Kļūda: NFC ID nav atrasts!</h1>";
    return;
  }

  // Datu ielāde no Google Sheets (Apps Script)
  fetch(`https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec?uid=${uid}&action=getProfile`)
    .then(response => response.text())
    .then(text => {
      try {
        const data = JSON.parse(text);
        if (data.status === "success") {
          document.getElementById("username").innerText = data.username;
          document.getElementById("nfc-id").innerText = data.uid;
        } else {
          document.body.innerHTML = "<h1 class='error'>Kļūda: Lietotāja profils nav atrasts!</h1>";
        }
      } catch (error) {
        console.warn("Atbilde nav JSON, tiek pārlādēts uz:", text);
        window.location.href = text;
      }
    })
    .catch(error => {
      console.error("Kļūda fetch pieprasījumā:", error);
      document.body.innerHTML = "<h1 class='error'>Kļūda: Savienojuma problēma.</h1>";
    });

  // Attēla augšupielādes funkcionalitāte
  const uploadButton = document.getElementById("upload-button");
  const imageInput = document.getElementById("image-input");
  const profileImage = document.getElementById("profile-image");

  uploadButton.addEventListener("click", function () {
    imageInput.click();
  });

  imageInput.addEventListener("change", function () {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        profileImage.src = e.target.result;
        profileImage.style.display = "block";
        uploadButton.style.display = "none"; // Paslēpt pogu, kad attēls ir izvēlēts
        // Noņem sākotnējo fiksēto kvadrāta proporciju, lai augstums pielāgotos attēlam
        profileImage.parentElement.classList.add("has-image");
      };
      reader.readAsDataURL(file);
    }
  });
});
