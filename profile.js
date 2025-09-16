<!-- Ieteicams ielikt <script type="module">, lai droši lietotu mūsdienu JS -->
<script type="module">
"use strict";

// ====== Konfigurācija ======
const CONFIG = {
  scriptUrl: "https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec",
  cloudinary: {
    cloudName: "dmkpb05ww",
    uploadPreset: "Vezitivus",
    folder: "Vezitivus",
    maxBytes: 5 * 1024 * 1024,           // 5MB limits (pielāgo vajadzībām)
    allowedTypes: ["image/jpeg","image/png","image/webp","image/avif"]
  }
};

// ====== Palīgfunkcijas ======
const qs = (k, s = window.location.search) => new URLSearchParams(s).get(k);
const select = (sel) => {
  const el = document.querySelector(sel);
  if (!el) console.warn(`Nav atrasts elements: ${sel}`);
  return el;
};
const show = (el) => el && el.classList.remove("is-hidden");
const hide = (el) => el && el.classList.add("is-hidden");

const setText = (el, value = "") => { if (el) el.textContent = value; };

const withLoading = async (el, fn, labelLoading = "Notiek…", labelIdle) => {
  if (!el) return fn();
  const prev = el.textContent;
  const prevDisabled = el.disabled;
  el.disabled = true;
  el.textContent = labelIdle ?? prev;
  if (labelLoading) el.textContent = labelLoading;
  try { return await fn(); }
  finally {
    el.disabled = prevDisabled;
    el.textContent = labelIdle ?? prev;
  }
};

const toast = (() => {
  let box;
  const ensure = () => {
    if (box) return box;
    box = document.createElement("div");
    box.setAttribute("aria-live","polite");
    box.className = "toast-stack";
    document.body.appendChild(box);
    return box;
  };
  return (msg, type = "info", ms = 3000) => {
    const container = ensure();
    const t = document.createElement("div");
    t.className = `toast toast--${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.classList.add("is-out"), ms - 250);
    setTimeout(() => t.remove(), ms);
  };
})();

const apiCall = async (url, opts = {}) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), 15000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, ...opts });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } finally {
    clearTimeout(t);
  }
};

const buildUrl = (base, paramsObj) => {
  const u = new URL(base);
  Object.entries(paramsObj).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.toString();
};

// ====== Galvenā loģika ======
document.addEventListener("DOMContentLoaded", async () => {
  // HTML elementi
  const profileImage   = select("#profile-image");
  const changeButton   = select("#change-button");
  const imageInput     = select("#image-input");
  const checkinButton  = select("#checkin-button");

  const usernameEl     = select("#username");
  const nfcIdEl        = select("#nfc-id");
  const placeEl        = select("#place");
  const teamNameEl     = select("#team-name");
  const errorBox       = select("#error-box"); // ieteicams HTML ielikt <div id="error-box"></div>

  // Palaid-drošs “hide” uzreiz
  if (checkinButton) hide(checkinButton);

  // NFC uid
  const uid = qs("uid");
  if (!uid) {
    if (errorBox) { errorBox.textContent = "Kļūda: NFC ID nav atrasts!"; show(errorBox); }
    else document.body.innerHTML = "<h1 class='error'>Kļūda: NFC ID nav atrasts!</h1>";
    return;
  }

  // 1) Ielādē profils
  try {
    const data = await apiCall(buildUrl(CONFIG.scriptUrl, { action: "getProfile", uid }));
    if (data?.status !== "success") {
      const msg = data?.message || "Nezināma kļūda.";
      if (errorBox) { errorBox.textContent = `Kļūda: ${msg}`; show(errorBox); }
      else document.body.innerHTML = `<h1 class='error'>Kļūda: ${msg}</h1>`;
      return;
    }

    setText(usernameEl, data.username || "");
    setText(nfcIdEl, data.uid || "");
    setText(placeEl, data.place || "");
    setText(teamNameEl, data.team || "Nav komandas");

    if (data.imageUrl && profileImage) {
      profileImage.src = data.imageUrl;
      profileImage.loading = "lazy";
      show(profileImage);
      if (changeButton) changeButton.textContent = "Nomainīt attēlu";
    } else if (changeButton) {
      changeButton.textContent = "Izvēlēties attēlu";
    }

    const checkinStatus = data.checkinStatus;            // kolonna C
    const globalCheckinEnabled = data.globalCheckinEnabled; // Lapa1!C4

    if (checkinButton && globalCheckinEnabled === "TRUE" && checkinStatus === "FALSE") {
      show(checkinButton);
    } else {
      hide(checkinButton);
    }

  } catch (e) {
    console.error("Kļūda ielādējot profilu:", e);
    if (errorBox) { errorBox.textContent = "Kļūda: Savienojuma problēma."; show(errorBox); }
    else document.body.innerHTML = "<h1 class='error'>Kļūda: Savienojuma problēma.</h1>";
    return;
  }

  // 2) Cloudinary: poga -> failu dialogs
  if (changeButton && imageInput) {
    changeButton.addEventListener("click", () => imageInput.click());

    imageInput.addEventListener("change", async function () {
      const file = this.files?.[0];
      if (!file) return;

      // Validācija
      if (!CONFIG.cloudinary.allowedTypes.includes(file.type)) {
        toast("Atļauti: JPG, PNG, WEBP, AVIF.", "error");
        this.value = "";
        return;
      }
      if (file.size > CONFIG.cloudinary.maxBytes) {
        toast("Fails par lielu. Maks. 5MB.", "error");
        this.value = "";
        return;
      }

      await withLoading(changeButton, async () => {
        // Priekšskatījums uzreiz
        if (profileImage) {
          const blobUrl = URL.createObjectURL(file);
          profileImage.src = blobUrl;
          show(profileImage);
        }

        // Augšupielāde uz Cloudinary
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CONFIG.cloudinary.uploadPreset);
        formData.append("folder", CONFIG.cloudinary.folder);

        let result;
        try {
          const resp = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.cloudinary.cloudName}/image/upload`, {
            method: "POST",
            body: formData
          });
          result = await resp.json();
        } catch (err) {
          console.error("Cloudinary kļūda:", err);
          toast("Neizdevās augšupielādēt attēlu.", "error");
          return;
        }

        if (!(result?.secure_url && result?.public_id)) {
          console.error("Cloudinary neatgrieza secure_url/public_id:", result);
          toast("Kļūda apstrādājot attēlu.", "error");
          return;
        }

        // Persistējam Apps Script pusē
        try {
          const saveUrl = buildUrl(CONFIG.scriptUrl, {
            action: "saveImage",
            uid,
            imageUrl: result.secure_url,
            publicId: result.public_id
          });
          const saveData = await apiCall(saveUrl);
          if (saveData?.status === "success") {
            toast("Attēls atjaunots!", "success");
          } else {
            toast(`Kļūda saglabājot attēlu: ${saveData?.message ?? "nezināms iemesls"}`, "error");
          }
        } catch (err) {
          console.error("Kļūda saglabājot attēlu:", err);
          toast("Kļūda saglabājot attēlu.", "error");
        }
      }, "Augšupielādē…", "Nomainīt attēlu");
    });
  }

  // 3) Check-In poga
  if (checkinButton) {
    checkinButton.addEventListener("click", async () => {
      await withLoading(checkinButton, async () => {
        try {
          const data = await apiCall(buildUrl(CONFIG.scriptUrl, { action: "checkIn", uid }));
          if (data?.status === "success") {
            hide(checkinButton);
            toast("Check-In veiksmīgi reģistrēts!", "success");
          } else {
            toast(`Kļūda Check-In: ${data?.message ?? "nezināms iemesls"}`, "error");
          }
        } catch (err) {
          console.error("Kļūda Check-In:", err);
          toast("Savienojuma problēma, mēģini vēlreiz.", "error");
        }
      }, "Reģistrē…");
    });
  }
});
</script>