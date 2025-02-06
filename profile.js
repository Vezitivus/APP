document.addEventListener("DOMContentLoaded", async function () {
  // Nolasām uid no URL
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("uid");
  if (!uid) {
    document.body.innerHTML = "<h1 class='error'>Kļūda: NFC ID nav atrasts URL!</h1>";
    return;
  }

  // Google Apps Script Web App URL
  const scriptUrl = "https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec";

  // HTML elementi
  const changeButton = document.getElementById("change-button");
  const imageInput   = document.getElementById("image-input");
  const profileImage = document.getElementById("profile-image");

  // Pamatdati
  let imageUrl = "";

  // 1) Ielādējam esošo profilu no Sheets
  try {
    const res = await fetch(`${scriptUrl}?action=getProfile&uid=${uid}`);
    const data = await res.json();
    if (data.status === "success") {
      // Attēlojam vārdu un ID
      document.getElementById("username").innerText = data.username;
      document.getElementById("nfc-id").innerText = data.uid;

      // Saglabājam esošo attēla URL
      imageUrl = data.imageUrl;

      // Ja nav attēls, tad poga => “Izvēlēties attēlu”
      // Ja ir attēls, poga => “Nomainīt attēlu” + rādīt bildi
      if (!imageUrl) {
        changeButton.innerText = "Izvēlēties attēlu";
      } else {
        changeButton.innerText = "Nomainīt attēlu";
        profileImage.src = imageUrl;
        profileImage.style.display = "block";
      }
    } else {
      document.body.innerHTML = `<h1 class='error'>Kļūda: ${data.message}</h1>`;
    }
  } catch (error) {
    console.error("Kļūda ielādējot profilu:", error);
    document.body.innerHTML = "<h1 class='error'>Savienojuma problēma.</h1>";
  }

  // 2) Sagatavojam Cloudinary augšupielādi
  const cloudName = "dmkpb05ww";   // jūsu Cloud name
  const uploadPreset = "Vezitivus"; // jūsu Upload Preset

  // Kad nospiež pogu (Izvēlēties vai Nomainīt attēlu)
  changeButton.addEventListener("click", () => {
    imageInput.click();
  });

  // Kad lietotājs ir izvēlējies failu
  imageInput.addEventListener("change", async function () {
    const file = this.files[0];
    if (!file) return; // ja atcēla

    // Augšupielāde uz Cloudinary
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "Vezitivus");

    try {
      const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData
      });
      const result = await resp.json();

      if (result.secure_url) {
        // Attēlojam jauno bildi
        profileImage.src = result.secure_url;
        profileImage.style.display = "block";
        // Uzstādām pogai “Nomainīt attēlu”
        changeButton.innerText = "Nomainīt attēlu";

        // Saglabājam Google Sheets (Apps Script)
        const saveResp = await fetch(`${scriptUrl}?action=saveImage&uid=${uid}&imageUrl=${encodeURIComponent(result.secure_url)}`);
        const saveData = await saveResp.json();
        if (saveData.status === "success") {
          console.log("Attēls saglabāts:", saveData.message);
        } else {
          console.error("Kļūda saglabājot attēlu:", saveData.message);
        }
      } else {
        console.error("Cloudinary neatgrieza secure_url:", result);
      }
    } catch (err) {
      console.error("Kļūda augšupielādējot attēlu Cloudinary:", err);
    }
  });
});
