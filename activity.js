const CLOUDINARY_CLOUD_NAME = "dmkpb05ww"; 
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbyDO5hMMHgqgbCfZ_AHyQRRe6_9S_7hTx420k2busDFeWIoKCI-9wEeApXiry7vv6MxWQ/exec";

// Reakciju pogu mappēšana: ❤️ → C, 😂 → D, 😢 → E, 🔥 → F
const reactions = ["❤️", "😂", "😢", "🔥"];
const reactionColumns = { "❤️": "C", "😂": "D", "😢": "E", "🔥": "F" };

const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get("uid");
if (uid) {
  document.getElementById("uploadSection").style.display = "block";
}

// Global variable, lai noteiktu, vai vismaz viens video ir ielādēts
let firstVideoLoaded = false;

function uploadVideo(file) {
  document.getElementById("uploadLoadingScreen").style.display = "flex"; 
  document.getElementById("uploadVideoBtn").disabled = true;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
    method: "POST",
    body: formData,
  })
  .then(response => response.json())
  .then(data => {
    if (data.public_id) {
      saveVideoToGoogleSheets(data.public_id, uid);
      // Pievienojam video ar uzreiz parādāmu loading efektu video blokā
      addVideoToGrid(data.public_id, true);
    } else {
      alert("Augšupielāde neizdevās.");
    }
  })
  .catch(error => console.error("Augšupielādes kļūda:", error))
  .finally(() => {
    document.getElementById("uploadLoadingScreen").style.display = "none";
    document.getElementById("uploadVideoBtn").disabled = false;
  });
}

function saveVideoToGoogleSheets(publicId, uid) {
  // Saglabājam: A - publicId, B - uid, C - 0 (❤️), D - 0 (😂), E - 0 (😢), F - 0 (🔥)
  fetch(`${GOOGLE_SHEETS_URL}?action=saveVideo&publicId=${encodeURIComponent(publicId)}&uid=${encodeURIComponent(uid)}`)
    .then(response => response.json())
    .then(data => console.log("Saglabāts:", data))
    .catch(error => console.error("Kļūda ar Google Sheets:", error));
}

function addVideoToGrid(publicId, isNew = false, reactionsData = {}) {
  const videoGrid = document.getElementById("videoGrid");

  // Izveidojam video-wrapper, kas satur gan video, gan reakciju lauku
  const wrapper = document.createElement("div");
  wrapper.classList.add("video-wrapper");
  wrapper.style.width = "45%";

  // Izveidojam video konteineru
  const videoContainer = document.createElement("div");
  videoContainer.classList.add("video-container");

  // Pievienojam individuālu loading pārklājumu video blokam
  const loadingOverlay = document.createElement("div");
  loadingOverlay.classList.add("video-loading-overlay");
  loadingOverlay.textContent = "Ielādē video...";
  videoContainer.appendChild(loadingOverlay);

  const video = document.createElement("video");
  video.setAttribute("controls", true);
  video.setAttribute("playsinline", true);
  video.setAttribute("poster", `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.jpg`);
  video.src = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.mp4`;

  // Noņemam globālo loading screen, kad ielādējas pirmais video, un arī paslēpjam individuālo pārklājumu
  video.addEventListener("loadeddata", () => {
    if (!firstVideoLoaded) {
      document.getElementById("loadingScreen").classList.add("hidden");
      firstVideoLoaded = true;
    }
    loadingOverlay.style.display = "none";
  });

  // Ja video tiek atskaņots (vai uzklikšķināts), aktivizējam reakciju lauku
  // (Izmantojam gan "click", gan "play" notikumus, lai nodrošinātu, ka reakciju lauks tiek parādīts uzreiz)
  function activateVideo() {
    document.querySelectorAll(".video-wrapper").forEach(el => el.classList.remove("active"));
    wrapper.classList.add("active");
  }
  video.addEventListener("click", (event) => {
    event.stopPropagation();
    activateVideo();
  });
  video.addEventListener("play", activateVideo);

  videoContainer.appendChild(video);

  // Reakciju wrapper – izvietots zem video, sākotnēji paslēpts ar max-height=0
  const reactionWrapper = document.createElement("div");
  reactionWrapper.classList.add("reaction-wrapper");

  const reactionContainer = document.createElement("div");
  reactionContainer.classList.add("reaction-container");

  reactions.forEach((emoji) => {
    const column = reactionColumns[emoji];
    const reactionBtn = document.createElement("button");
    reactionBtn.classList.add("reaction-btn");
    reactionBtn.innerHTML = `${emoji} ${reactionsData[column] || 0}`;
    reactionBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      addReaction(publicId, column, reactionBtn);
      updateTotalReactions(reactionContainer);
    });
    reactionContainer.appendChild(reactionBtn);
  });

  reactionWrapper.appendChild(reactionContainer);
  wrapper.appendChild(videoContainer);
  wrapper.appendChild(reactionWrapper);
  if (isNew) {
    videoGrid.prepend(wrapper);
  } else {
    videoGrid.appendChild(wrapper);
  }
}

function updateTotalReactions(reactionContainer) {
  const buttons = reactionContainer.querySelectorAll(".reaction-btn");
  let total = 0;
  buttons.forEach(btn => {
    const count = parseInt(btn.textContent.split(" ")[1], 10) || 0;
    total += count;
  });
  // Ja vēlies, vari parādīt kopējo reakciju skaitu šeit
}

function addReaction(publicId, column, button) {
  fetch(`${GOOGLE_SHEETS_URL}?action=addReaction&publicId=${encodeURIComponent(publicId)}&column=${column}`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "success") {
        const currentCount = parseInt(button.textContent.split(" ")[1], 10) || 0;
        button.innerHTML = `${button.textContent.split(" ")[0]} ${currentCount + 1}`;
      } else {
        console.error("Kļūda, pievienojot reakciju:", data.message);
      }
    })
    .catch(error => console.error("Reakcijas pievienošanas kļūda:", error));
}

function loadVideosFromGoogleSheets() {
  fetch(`${GOOGLE_SHEETS_URL}?action=getVideos`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "success" && data.data) {
        data.data.reverse().forEach(video => {
          addVideoToGrid(video.publicId, false, video.reactions);
        });
      } else {
        console.error("Kļūda, ielādējot video:", data.message);
      }
    })
    .catch(error => console.error("Kļūda ar Google Sheets:", error));
}

document.addEventListener("DOMContentLoaded", () => {
  loadVideosFromGoogleSheets();
});

document.getElementById("uploadVideoBtn").addEventListener("click", () => {
  const fileInput = document.getElementById("videoFileInput");
  fileInput.click();
  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (file) {
      uploadVideo(file);
    }
  };
});
