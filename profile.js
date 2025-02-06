document.addEventListener("DOMContentLoaded", async function () {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("uid");
  if (!uid) {
    document.body.innerHTML = "<h1 class='error'>Kļūda: NFC ID nav atrasts!</h1>";
    return;
  }

  // Google Apps Script URL
  const scriptUrl = "https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec";
  
  // 1) Iegūstam profila datus
  try {
    const res = await fetch(`${scriptUrl}?action=getProfile&uid=${uid}`);
    const data = await res.json();
    if (data.status === "success") {
      document.getElementById("username").innerText = data.username;
      document.getElementById("nfc-id").innerText = data.uid;

      // Ja ir saglabāts attēls, rādām
      if (data.imageUrl) {
        const profileImage = document.getElementById("profile-image");
        const uploadButton = document.getElementById("upload-button");
        profileImage.src = data.imageUrl;
        profileImage.style.display = "block";
        uploadButton.style.display = "none";
      }
    } else {
      document.body.innerHTML = `<h1 class='error'>Kļūda: ${data.message}</h1>`;
    }
  } catch (err) {
    console.error("Kļūda, ielādējot profilu:", err);
    document.body.innerHTML = "<h1 class='error'>Kļūda: Savienojuma problēma.</h1>";
    return;
  }

  // 2) Pievienojam Cloudinary augšupielādes loģiku
  const cloudName = "dmkpb05ww";  // jūsu Cloud name
  const uploadPreset = "Vezitivus"; // jūsu preset
  const uploadButton = document.getElementById("upload-button");
  const imageInput   = document.getElementById("image-input");
  const profileImage = document.getElementById("profile-image");

  uploadButton.addEventListener("click", () => {
    imageInput.click();
  });

  imageInput.addEventListener("change", async function () {
    const file = this.files[0];
    if (!file) return;

    // Augšupielāde uz Cloudinary
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    // Norādam, ka vēlamies, lai attēli iet mapē "Vezitivus"
    formData.append("folder", "Vezitivus");

    try {
      const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData
      });
      const result = await resp.json();

      if (result.secure_url) {
        // Parādām jauno attēlu
        profileImage.src = result.secure_url;
        profileImage.style.display = "block";
        uploadButton.style.display = "none";

        // Saglabājam URL Google Sheets
        const saveResp = await fetch(`${scriptUrl}?action=saveImage&uid=${uid}&imageUrl=${encodeURIComponent(result.secure_url)}`);
        const saveData = await saveResp.json();
        if (saveData.status === "success") {
          console.log("Attēls saglabāts:", saveData.message);
        } else {
          console.error("Neizdevās saglabāt attēlu:", saveData.message);
        }
      } else {
        console.error("Cloudinary atbilde nav derīga:", result);
      }
    } catch (err) {
      console.error("Kļūda augšupielādējot attēlu uz Cloudinary:", err);
    }
  });
});
