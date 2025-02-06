document.addEventListener("DOMContentLoaded", async function() {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("uid");
  if (!uid) {
    document.body.innerHTML = "<h1 class='error'>Kļūda: NFC ID nav atrasts!</h1>";
    return;
  }

  // Google Apps Script WebApp
  const scriptUrl = "https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec";

  // HTML elementi
  const profileImage = document.getElementById("profile-image");
  const changeButton = document.getElementById("change-button");
  const imageInput   = document.getElementById("image-input");

  // 1) Ielādējam profila datus
  try {
    const res = await fetch(`${scriptUrl}?action=getProfile&uid=${uid}`);
    const data = await res.json();
    if (data.status === "success") {
      // Parādam Vārdu, ID, Kopvērtējuma vietu
      document.getElementById("username").innerText = data.username || "";
      document.getElementById("nfc-id").innerText   = data.uid || "";
      document.getElementById("place").innerText    = data.place || "";

      // Ja attēls jau ir
      if (data.imageUrl) {
        profileImage.src = data.imageUrl;
        profileImage.style.display = "block";
        changeButton.innerText = "Nomainīt attēlu";
      } else {
        // Nav attēla
        changeButton.innerText = "Izvēlēties attēlu";
      }
    } else {
      document.body.innerHTML = `<h1 class='error'>Kļūda: ${data.message}</h1>`;
      return;
    }
  } catch (err) {
    console.error("Kļūda ielādējot profilu:", err);
    document.body.innerHTML = "<h1 class='error'>Kļūda: Savienojuma problēma.</h1>";
    return;
  }

  // 2) Cloudinary iestatījumi
  const cloudName    = "dmkpb05ww";
  const uploadPreset = "Vezitivus";

  // Kad nospiež pogu, atver failu dialogu
  changeButton.addEventListener("click", () => {
    imageInput.click();
  });

  // Kad fails izvēlēts
  imageInput.addEventListener("change", async function() {
    const file = this.files[0];
    if (!file) return;

    // Augšupielādējam uz Cloudinary
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", "Vezitivus"); // Lai būtu mapē Vezitivus

    try {
      const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData
      });
      const result = await resp.json();
      console.log("Cloudinary atbilde:", result);

      if (result.secure_url && result.public_id) {
        // 1) Parādām jauno bildi (front-end)
        profileImage.src = result.secure_url;
        profileImage.style.display = "block";
        changeButton.innerText = "Nomainīt attēlu";

        // 2) Sūtām uz Apps Script => vispirms dzēs veco, tad saglabā jauno
        const saveUrl = `${scriptUrl}?action=saveImage&uid=${uid}`
          + `&imageUrl=${encodeURIComponent(result.secure_url)}`
          + `&publicId=${encodeURIComponent(result.public_id)}`;

        const saveResp = await fetch(saveUrl);
        const saveData = await saveResp.json();
        console.log("saveImage atbilde:", saveData);
        if (saveData.status === "success") {
          console.log("Vecais attēls izdzēsts un jaunais saglabāts.");
        } else {
          console.error("Kļūda saglabājot attēlu:", saveData.message);
        }
      } else {
        console.error("Cloudinary neatgrieza secure_url vai public_id:", result);
      }
    } catch (uploadErr) {
      console.error("Kļūda augšupielādējot attēlu Cloudinary:", uploadErr);
    }
  });
});
