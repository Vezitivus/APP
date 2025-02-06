document.addEventListener("DOMContentLoaded", async function () {
  const params = new URLSearchParams(window.location.search);
  const uid = params.get("uid");
  if (!uid) {
    document.body.innerHTML = "<h1 class='error'>Kļūda: NFC ID nav atrasts URL!</h1>";
    return;
  }

  // Apps Script WebApp URL
  const scriptUrl = "https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec";

  // HTML elementi
  const changeButton = document.getElementById("change-button");
  const imageInput   = document.getElementById("image-input");
  const profileImage = document.getElementById("profile-image");

  // Pirms augšupielādes glabāsim, vai jau ir attēls utt.
  let imageUrl   = "";
  let publicId   = "";
  let placeValue = "";

  // 1) Ielādējam esošo profilu
  try {
    const res = await fetch(`${scriptUrl}?action=getProfile&uid=${uid}`);
    const data = await res.json();
    if (data.status === "success") {
      // Vārds, ID, Kopvērtējuma vieta
      document.getElementById("username").innerText = data.username || "";
      document.getElementById("nfc-id").innerText = data.uid || "";
      document.getElementById("place").innerText   = data.place || "";

      // Saglabājam attēla datus
      imageUrl = data.imageUrl || "";
      publicId = data.publicId || "";

      // Ja nav attēla, poga = "Izvēlēties attēlu"
      if (!imageUrl) {
        changeButton.innerText = "Izvēlēties attēlu";
      } else {
        // Ja ir attēls, rādām bildi un poga = "Nomainīt attēlu"
        profileImage.src = imageUrl;
        profileImage.style.display = "block";
        changeButton.innerText = "Nomainīt attēlu";
      }
    } else {
      document.body.innerHTML = `<h1 class='error'>Kļūda: ${data.message}</h1>`;
      return;
    }
  } catch (error) {
    console.error("Kļūda ielādējot profilu:", error);
    document.body.innerHTML = "<h1 class='error'>Savienojuma problēma.</h1>";
    return;
  }

  // 2) Cloudinary iestatījumi
  const cloudName   = "dmkpb05ww";   // jūsu Cloud name
  const uploadPreset = "Vezitivus";  // jūsu Upload Preset

  // Kad nospiež pogu (gan pirmajai, gan nākamajai bildei)
  changeButton.addEventListener("click", () => {
    imageInput.click();
  });

  // Kad lietotājs izvēlas failu
  imageInput.addEventListener("change", async function () {
    const file = this.files[0];
    if (!file) return; // ja atcelts

    // FormData augšupielādei
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    // Papildu param. mapes norādei
    formData.append("folder", "Vezitivus");

    try {
      const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData
      });
      const result = await resp.json();

      if (result.secure_url && result.public_id) {
        // Jaunais attēls front-end pusē
        profileImage.src = result.secure_url;
        profileImage.style.display = "block";
        changeButton.innerText = "Nomainīt attēlu";

        // 3) Saglabājam Sheets, kas dzēsīs veco un glabās jauno
        const saveUrl = `${scriptUrl}?action=saveImage&uid=${uid}`
          + `&imageUrl=${encodeURIComponent(result.secure_url)}`
          + `&publicId=${encodeURIComponent(result.public_id)}`;

        const saveResp = await fetch(saveUrl);
        const saveData = await saveResp.json();
        if (saveData.status === "success") {
          console.log("Vecais attēls (ja bija) izdzēsts, jaunais saglabāts:", saveData.message);
        } else {
          console.error("Kļūda saglabājot attēlu:", saveData.message);
        }
      } else {
        console.error("Cloudinary neatgrieza secure_url vai public_id:", result);
      }
    } catch (err) {
      console.error("Kļūda augšupielādējot attēlu Cloudinary:", err);
    }
  });
});
