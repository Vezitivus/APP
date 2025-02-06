document.addEventListener("DOMContentLoaded", async function () {
  // 1. Izlasa uid no URL ( ?uid=... )
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("uid");
  if (!uid) {
    document.body.innerHTML = "<h1 class='error'>Kļūda: NFC ID nav atrasts URL!</h1>";
    return;
  }

  // 2. Ielādējam profila datus no Google Apps Script
  try {
    // Piemēram, jūsu Apps Script WebApp URL:
    // https://script.google.com/macros/s/AKfycbxx.../exec?action=getProfile&uid=...
    const res = await fetch(`https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=getProfile&uid=${uid}`);
    const data = await res.json();

    if (data.status === "success") {
      document.getElementById("username").innerText = data.username;
      document.getElementById("nfc-id").innerText = data.uid;
      
      // Ja imageUrl jau ir saglabāts, parādām attēlu
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

  // 3. Sagatavojam Cloudinary Unsigned upload
  const cloudName = "JŪSU_CLOUD_NAME";  // piem., "dmkpb05ww"
  const uploadPreset = "Vezitivus";     // jūsu izveidotais preset

  // HTML elementi
  const uploadButton = document.getElementById("upload-button");
  const imageInput   = document.getElementById("image-input");
  const profileImage = document.getElementById("profile-image");

  // Nospiežot pogu, atver failu dialogu
  uploadButton.addEventListener("click", () => {
    imageInput.click();
  });

  // Kad lietotājs izvēlas failu:
  imageInput.addEventListener("change", async function () {
    const file = this.files[0];
    if (!file) return; // ja atcēla

    // 3.1. Augšupielāde uz Cloudinary
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    try {
      const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData
      });
      const result = await resp.json();
      
      if (result.secure_url) {
        // 1) Parādām attēlu lokāli
        profileImage.src = result.secure_url;
        profileImage.style.display = "block";
        uploadButton.style.display = "none";

        // 2) Saglabājam Cloudinary URL Sheets (action=saveImage)
        //    Izsaucam doGet ar action=saveImage
        const saveResp = await fetch(`https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=saveImage&uid=${uid}&imageUrl=${encodeURIComponent(result.secure_url)}`);
        const saveData = await saveResp.json();
        
        if (saveData.status === "success") {
          console.log("Attēls veiksmīgi saglabāts:", saveData.message);
        } else {
          console.error("Attēla saglabāšanas kļūda:", saveData.message);
        }
      } else {
        console.error("Cloudinary atgriezat neatbilstošu formātu:", result);
      }
    } catch (err) {
      console.error("Kļūda augšupielādējot attēlu uz Cloudinary:", err);
    }
  });
});
