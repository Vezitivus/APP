<script type="module">
"use strict";

// ====== Konfigurācija ======
const CONFIG = {
  scriptUrl: "https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec",
  cloudinary: {
    cloudName: "dmkpb05ww",
    uploadPreset: "Vezitivus",
    folder: "Vezitivus",
    maxBytes: 5 * 1024 * 1024,
    allowedTypes: ["image/jpeg","image/png","image/webp","image/avif"]
  },
  timeouts: {
    apiMs: 15000,
    cloudinaryMs: 30000
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
const setText = (el, value = "—") => { if (el) el.textContent = value; };

// Apps Script dažreiz dod "TRUE"/"FALSE", dažreiz true/false
const normalizeBool = (v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.trim().toLowerCase() === "true";
  return false;
};

const withLoading = async (el, fn, labelLoading = "Notiek…", labelIdle) => {
  if (!el) return fn();
  const prevText = el.textContent;
  const prevDisabled = el.disabled;
  el.disabled = true;
  el.textContent = labelLoading;
  try { return await fn(); }
  finally {
    el.disabled = prevDisabled;
    el.textContent = labelIdle ?? prevText;
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
    const outAt = Math.max(250, ms - 250);
    setTimeout(() => t.classList.add("is-out"), outAt);
    setTimeout(() => t.remove(), ms);
  };
})();

const buildUrl = (base, paramsObj = {}) => {
  const u = new URL(base);
  Object.entries(paramsObj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
};

// Robustāks API: Apps Script reizēm atdod nepareizu content-type / tukšu text
const apiCall = async (url, opts = {}) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CONFIG.timeouts.apiMs);

  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, ...opts });
    const text = await res.text();

    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }

    if (!res.ok) {
      const msg = data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    if (data === null) throw new Error("Atbilde nav derīgs JSON (Apps Script).");

    return data;
  } finally {
    clearTimeout(t);
  }
};

// Cloudinary upload ar timeout + labāku error
const cloudinaryUpload = async (file) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), CONFIG.timeouts.cloudinaryMs);

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CONFIG.cloudinary.uploadPreset);
    formData.append("folder", CONFIG.cloudinary.folder);

    const resp = await fetch(
      `https://api.cloudinary.com/v1_1/${CONFIG.cloudinary.cloudName}/image/upload`,
      { method: "POST", body: formData, signal: ctrl.signal }
    );

    const result = await resp.json().catch(() => null);

    if (!resp.ok) {
      const msg = result?.error?.message || `Cloudinary HTTP ${resp.status}`;
      throw new Error(msg);
    }
    if (!(result?.secure_url && result?.public_id)) {
      throw new Error("Cloudinary neatgrieza secure_url/public_id.");
    }

    return { imageUrl: result.secure_url, publicId: result.public_id };
  } finally {
    clearTimeout(t);
  }
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
  const errorBox       = select("#error-box");

  const showError = (msg) => {
    if (errorBox) { errorBox.textContent = msg; show(errorBox); }
    else document.body.innerHTML = `<h1 class="error">${msg}</h1>`;
  };
  const clearError = () => {
    if (errorBox) { errorBox.textContent = ""; hide(errorBox); }
  };

  // Palaid-drošs “hide” uzreiz
  if (checkinButton) hide(checkinButton);

  // NFC uid
  const uid = qs("uid");
  if (!uid) {
    showError("Kļūda: NFC ID (uid) nav atrasts URL! Piemērs: ?uid=ABC123");
    return;
  }

  let originalImageUrl = "";

  // 1) Ielādē profils
  try {
    clearError();
    const data = await apiCall(buildUrl(CONFIG.scriptUrl, { action: "getProfile", uid }));

    if (data?.status !== "success") {
      showError(`Kļūda: ${data?.message || "Nezināma kļūda."}`);
      return;
    }

    setText(usernameEl, data.username || "—");
    setText(nfcIdEl, data.uid || uid);
    setText(placeEl, data.place || "—");
    setText(teamNameEl, data.team || "Nav komandas");

    originalImageUrl = data.imageUrl || "";

    if (profileImage) {
      if (originalImageUrl) {
        profileImage.src = originalImageUrl;
        profileImage.loading = "lazy";
        show(profileImage);
        if (changeButton) changeButton.textContent = "Nomainīt attēlu";
      } else if (changeButton) {
        changeButton.textContent = "Izvēlēties attēlu";
      }
    }

    // check-in loģika (robusta pret TRUE/FALSE un true/false)
    const checkinStatus = normalizeBool(data.checkinStatus); // true = jau check-in
    const globalEnabled = normalizeBool(data.globalCheckinEnabled);

    if (checkinButton && globalEnabled && !checkinStatus) show(checkinButton);
    else hide(checkinButton);

  } catch (e) {
    console.error("Kļūda ielādējot profilu:", e);
    showError("Kļūda: Savienojuma problēma vai nederīgs API formāts.");
    return;
  }

  // 2) Cloudinary: poga -> failu dialogs
  if (changeButton && imageInput) {
    changeButton.addEventListener("click", () => imageInput.click());

    imageInput.addEventListener("change", async function () {
      clearError();

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
        let blobUrl = "";

        try {
          // Preview uzreiz
          if (profileImage) {
            blobUrl = URL.createObjectURL(file);
            profileImage.src = blobUrl;
            show(profileImage);
          }

          // Upload
          const { imageUrl, publicId } = await cloudinaryUpload(file);

          // Persistējam Apps Script pusē
          const saveData = await apiCall(buildUrl(CONFIG.scriptUrl, {
            action: "saveImage",
            uid,
            imageUrl,
            publicId
          }));

          if (saveData?.status === "success") {
            toast("Attēls atjaunots!", "success");
            originalImageUrl = imageUrl;
            if (profileImage) profileImage.src = imageUrl;
          } else {
            toast(`Kļūda saglabājot attēlu: ${saveData?.message ?? "nezināms iemesls"}`, "error");
            if (profileImage && originalImageUrl) profileImage.src = originalImageUrl;
          }

        } catch (err) {
          console.error("Attēla maiņas kļūda:", err);
          toast("Neizdevās augšupielādēt vai saglabāt attēlu.", "error");
          if (profileImage && originalImageUrl) profileImage.src = originalImageUrl;
        } finally {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          this.value = ""; // ļauj izvēlēties to pašu failu vēlreiz
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