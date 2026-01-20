// profile.js (drop-in replacement, same URLs/actions/IDs)
(() => {
  let holdOverlay = true;

  // Ja HTML load-handler paslēpj overlay par ātru, mēs to atkal parādām,
  // līdz profils ir tiešām ielādējies.
  window.addEventListener("load", () => {
    if (!holdOverlay) return;
    const overlay = document.getElementById("loading-overlay");
    if (overlay) overlay.style.display = "flex";
  });

  document.addEventListener("DOMContentLoaded", () => {
    main().catch((err) => {
      console.error("Neparedzēta kļūda:", err);
      renderFatal("Kļūda: Notika neparedzēta kļūda.");
    });
  });

  async function main() {
    const params = new URLSearchParams(window.location.search);
    const uid = (params.get("uid") || "").trim();

    if (!uid) {
      renderFatal("Kļūda: NFC ID nav atrasts! (Trūkst ?uid=...)");
      return;
    }

    // Google Apps Script WebApp URL (NEAIZTIEKAM)
    const scriptUrl =
      "https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec";

    // Cloudinary iestatījumi (NEAIZTIEKAM)
    const cloudName = "dmkpb05ww";
    const uploadPreset = "Vezitivus";

    // Elementi
    const profileImage = document.getElementById("profile-image");
    const changeButton = document.getElementById("change-button");
    const imageInput = document.getElementById("image-input");
    const checkinButton = document.getElementById("checkin-button");

    if (!profileImage || !changeButton || !imageInput || !checkinButton) {
      renderFatal("Kļūda: Trūkst kāds nepieciešamais HTML elements (ID mismatch).");
      return;
    }

    // Slēpjam Check-In pogu uzreiz
    checkinButton.style.display = "none";

    // Ielādes overlay
    setOverlay(true, "Ielādē profilu…");

    // 1) Ielādējam profila datus
    try {
      const url = `${scriptUrl}?action=getProfile&uid=${encodeURIComponent(uid)}`;
      const data = await fetchJson(url, { timeoutMs: 15000 });

      if (data.status !== "success") {
        renderFatal(`Kļūda: ${escapeHtml(data.message || "Nezināma kļūda")}`);
        return;
      }

      // Aizpildām laukus
      setText("username", data.username || "");
      setText("nfc-id", data.uid || "");
      setText("place", data.place || "");
      setText("team-name", data.team || "Nav komandas");

      // Attēls
      if (data.imageUrl) {
        profileImage.src = data.imageUrl;
        profileImage.style.display = "block";
        changeButton.innerText = "Nomainīt attēlu";
      } else {
        changeButton.innerText = "Izvēlēties attēlu";
      }
      syncImagePlaceholderSafe();

      // Check-In redzamība
      const checkinStatus = data.checkinStatus;           // kolonna C
      const globalCheckinEnabled = data.globalCheckinEnabled; // Lapa1!C4
      if (globalCheckinEnabled === "TRUE" && checkinStatus === "FALSE") {
        checkinButton.style.display = "block";
      } else {
        checkinButton.style.display = "none";
      }
    } catch (err) {
      console.error("Kļūda ielādējot profilu:", err);
      renderFatal("Kļūda: Savienojuma problēma.");
      return;
    } finally {
      holdOverlay = false;
      setOverlay(false);
    }

    // Kad nospiež pogu, atver failu dialogu
    changeButton.addEventListener("click", () => {
      imageInput.click();
    });

    // Kad fails izvēlēts
    imageInput.addEventListener("change", async function () {
      const file = this.files && this.files[0];
      if (!file) return;

      // Pamat-validācija
      if (!file.type || !file.type.startsWith("image/")) {
        notify("Lūdzu izvēlies attēla failu.");
        this.value = "";
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        notify("Attēls ir par lielu (max ~15MB).");
        this.value = "";
        return;
      }

      // UI: disable poga + overlay
      const oldBtnText = changeButton.innerText;
      setButtonBusy(changeButton, true, "Augšupielādē…");
      setOverlay(true, "Augšupielādē attēlu…");

      try {
        // Kompresija (ātrāk + mazāk datu)
        const optimizedFile = await maybeCompressImage(file);

        // Cloudinary upload
        const formData = new FormData();
        formData.append("file", optimizedFile);
        formData.append("upload_preset", uploadPreset);
        formData.append("folder", "Vezitivus"); // NEAIZTIEKAM

        const resp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: "POST",
          body: formData,
        });

        const result = await resp.json();
        console.log("Cloudinary atbilde:", result);

        if (!result.secure_url || !result.public_id) {
          console.error("Cloudinary neatgrieza secure_url vai public_id:", result);
          notify("Kļūda: Cloudinary neatgrieza korektu atbildi.");
          return;
        }

        // 1) Parādām jauno bildi (front-end)
        profileImage.src = result.secure_url;
        profileImage.style.display = "block";
        changeButton.innerText = "Nomainīt attēlu";
        syncImagePlaceholderSafe();

        // 2) Sūtām uz Apps Script => vispirms dzēs veco, tad saglabā jauno (NEAIZTIEKAM action/paramus)
        const saveUrl =
          `${scriptUrl}?action=saveImage&uid=${encodeURIComponent(uid)}` +
          `&imageUrl=${encodeURIComponent(result.secure_url)}` +
          `&publicId=${encodeURIComponent(result.public_id)}`;

        const saveData = await fetchJson(saveUrl, { timeoutMs: 20000 });
        console.log("saveImage atbilde:", saveData);

        if (saveData.status === "success") {
          notify("Attēls saglabāts ✅");
        } else {
          console.error("Kļūda saglabājot attēlu:", saveData.message);
          notify("Attēls augšupielādēts, bet neizdevās saglabāt datubāzē.");
        }
      } catch (uploadErr) {
        console.error("Kļūda augšupielādējot attēlu:", uploadErr);
        notify("Kļūda augšupielādējot attēlu. Pamēģini vēlreiz.");
      } finally {
        setOverlay(false);
        setButtonBusy(changeButton, false, oldBtnText);
        // ļauj izvēlēties to pašu failu vēlreiz (change event)
        imageInput.value = "";
      }
    });

    // 3) Check-In pogas darbība
    checkinButton.addEventListener("click", async function () {
      // UI: disable
      const oldText = checkinButton.innerText;
      setButtonBusy(checkinButton, true, "Reģistrē…");

      try {
        const url = `${scriptUrl}?action=checkIn&uid=${encodeURIComponent(uid)}`;
        const checkinData = await fetchJson(url, { timeoutMs: 15000 });

        if (checkinData.status === "success") {
          checkinButton.style.display = "none";
          notify("Check-In veiksmīgi reģistrēts!");
        } else {
          notify("Kļūda Check-In procesā: " + (checkinData.message || "Nezināma kļūda"));
        }
      } catch (err) {
        console.error("Kļūda Check-In procesā:", err);
        notify("Savienojuma problēma, lūdzu mēģiniet vēlreiz.");
      } finally {
        setButtonBusy(checkinButton, false, oldText);
      }
    });
  }

  // ---------- Helpers ----------

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
  }

  function notify(msg) {
    // Ja HTML'ā ir showToast(), lietojam to; ja nav, krītam uz alert()
    if (typeof window.showToast === "function") window.showToast(msg);
    else alert(msg);
  }

  function setOverlay(on, label) {
    const overlay = document.getElementById("loading-overlay");
    if (!overlay) return;
    overlay.style.display = on ? "flex" : "none";
    overlay.setAttribute("aria-busy", on ? "true" : "false");

    if (label) {
      const textEl = overlay.querySelector(".loading-text");
      if (textEl) textEl.textContent = label;
    }
  }

  function setButtonBusy(btn, busy, busyText) {
    btn.disabled = !!busy;
    btn.style.opacity = busy ? "0.75" : "";
    btn.style.cursor = busy ? "progress" : "";
    if (busyText && busy) btn.innerText = busyText;
  }

  function renderFatal(message) {
    holdOverlay = false;
    setOverlay(false);

    // Rāda glītu kļūdu, nevis tukšu baltu lapu
    document.body.innerHTML = `
      <div style="max-width:900px;margin:0 auto;padding:22px;">
        <div class="glass-card" style="padding:18px;border-radius:22px;">
          <h1 style="margin:0 0 10px;font-size:22px;">${message}</h1>
          <p style="margin:0;opacity:.8;">
            Pārbaudi, vai saite satur <b>?uid=</b> parametru.
          </p>
        </div>
      </div>
    `;
  }

  function syncImagePlaceholderSafe() {
    // Tavā HTML bija syncImagePlaceholder() — ja tas ir, izsaucam.
    if (typeof window.syncImagePlaceholder === "function") {
      window.syncImagePlaceholder();
      return;
    }
    // Ja nav, izdarām minimālo paši
    const img = document.getElementById("profile-image");
    const ph = document.getElementById("image-placeholder");
    if (!img || !ph) return;
    const visible = img.style.display !== "none" && img.getAttribute("src");
    ph.style.display = visible ? "none" : "grid";
  }

  async function fetchJson(url, { timeoutMs = 12000 } = {}) {
    const controller = new AbortController();
    const t = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });

      // Apps Script dažreiz atgriež 200 ar error objektu; bet te pārbaudām arī HTTP
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data && data.message ? data.message : `HTTP ${res.status}`;
        throw new Error(msg);
      }

      return data;
    } finally {
      window.clearTimeout(t);
    }
  }

  // Kompresē tikai, ja vajag (lielāki faili); saglabā vizuāli labu kvalitāti
  async function maybeCompressImage(file) {
    // Ja jau mazs, neaiztiekam
    if (file.size <= 900 * 1024) return file;

    // Mēģinam decode + resize ar canvas
    try {
      const bitmap = await createImageBitmap(file);
      const maxSide = 1400; // droši priekš profila foto
      const { width, height } = bitmap;

      const scale = Math.min(1, maxSide / Math.max(width, height));
      if (scale >= 1) return file; // jau pietiekami mazs

      const w = Math.max(1, Math.round(width * scale));
      const h = Math.max(1, Math.round(height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, w, h);

      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.88);
      });

      if (!blob) return file;

      return new File([blob], "profile.jpg", { type: "image/jpeg" });
    } catch (e) {
      // Ja kāds browseris neprot, atstājam oriģinālu
      console.warn("Kompresija neizdevās, lietoju oriģinālu:", e);
      return file;
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();
