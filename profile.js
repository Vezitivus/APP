document.addEventListener("DOMContentLoaded", async function () {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("uid");
  if (!uid) {
    document.body.innerHTML = "<h1 class='error'>Kļūda: NFC ID nav atrasts!</h1>";
    return;
  }

  // Google Apps Script WebApp URL
  const scriptUrl =
    "https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec";

  // HTML elementi
  const profileImage = document.getElementById("profile-image");
  const changeButton = document.getElementById("change-button");
  const imageInput = document.getElementById("image-input");
  const checkinButton = document.getElementById("checkin-button");

  // Paslēpjam Check‑In pogu uzreiz pēc ielādes
  checkinButton.style.display = "none";

  // 1) Ielādējam profila datus
  try {
    const res = await fetch(`${scriptUrl}?action=getProfile&uid=${uid}`);
    const data = await res.json();
    if (data.status === "success") {
      // Parādam Vārdu, ID, Kopvērtējuma vietu un Tava Komanda
      document.getElementById("username").innerText = data.username || "";
      document.getElementById("nfc-id").innerText = data.uid || "";
      document.getElementById("place").innerText = data.place || "";
      document.getElementById("team-name").innerText = data.team || "Nav komandas";

      // Ja attēls jau ir
      if (data.imageUrl) {
        profileImage.src = data.imageUrl;
        profileImage.style.display = "block";
        changeButton.innerText = "Nomainīt attēlu";
      } else {
        changeButton.innerText = "Izvēlēties attēlu";
      }

      // Check‑In pogas loģika
      const checkinStatus = data.checkinStatus; // Lietotāja check‑in statuss (C kolonna)
      const globalCheckinEnabled = data.globalCheckinEnabled; // Globāla opcija (Lapa1!C4)
      if (globalCheckinEnabled === "TRUE" && checkinStatus === "FALSE") {
        checkinButton.style.display = "block"; // Parādām pogu
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
  const cloudName = "dmkpb05ww";
  const uploadPreset = "Vezitivus";

  // Kad nospiež pogu, atver failu dialogu
  changeButton.addEventListener("click", () => {
    imageInput.click();
  });

  // Kad fails izvēlēts
  imageInput.addEventListener("change", async function () {
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
        body: formData,
      });
      const result = await resp.json();
      console.log("Cloudinary atbilde:", result);

      if (result.secure_url && result.public_id) {
        // 1) Parādām jauno bildi (front-end)
        profileImage.src = result.secure_url;
        profileImage.style.display = "block";
        changeButton.innerText = "Nomainīt attēlu";

        // 2) Sūtām uz Apps Script – vispirms dzēs veco, tad saglabā jauno
        const saveUrl =
          `${scriptUrl}?action=saveImage&uid=${uid}` +
          `&imageUrl=${encodeURIComponent(result.secure_url)}` +
          `&publicId=${encodeURIComponent(result.public_id)}`;

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

  // 3) Check‑In pogas darbība
  checkinButton.addEventListener("click", async function () {
    try {
      const checkinRes = await fetch(`${scriptUrl}?action=checkIn&uid=${uid}`);
      if (!checkinRes.ok) throw new Error("Savienojuma kļūda ar serveri.");

      const checkinData = await checkinRes.json();

      if (checkinData.status === "success") {
        checkinButton.style.display = "none"; // Paslēpjam pogu
        alert("Check‑In veiksmīgi reģistrēts!");
      } else {
        alert("Kļūda Check‑In procesā: " + checkinData.message);
      }
    } catch (err) {
      console.error("Kļūda Check‑In procesā:", err);
      alert("Savienojuma problēma, lūdzu mēģiniet vēlreiz.");
    }
  });
});
