const CLOUDINARY_CLOUD_NAME = "dmkpb05ww"; 
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbyDO5hMMHgqgbCfZ_AHyQRRe6_9S_7hTx420k2busDFeWIoKCI-9wEeApXiry7vv6MxWQ/exec";

const reactions = ["❤️", "😂", "😢", "🔥"];
const reactionColumns = { "❤️": "C", "😂": "D", "😢": "E", "🔥": "F" };

const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get("uid");
if (uid) {
  document.getElementById("uploadSection").style.display = "block";
}

// Funkcija video augšupielādei uz Cloudinary un Public ID + UID saglabāšanai Google Sheets
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

// Funkcija, kas saglabā Public ID un UID Google Sheets
function saveVideoToGoogleSheets(publicId, uid) {
  fetch(`${GOOGLE_SHEETS_URL}?action=saveVideo&publicId=${encodeURIComponent(publicId)}&uid=${encodeURIComponent(uid)}`)
  .then(response => response.json())
  .then(data => console.log("Saglabāts:", data))
  .catch(error => console.error("Kļūda ar Google Sheets:", error));
}

// Funkcija, kas pievieno video galerijai
function addVideoToGrid(publicId, isNew = false, reactionsData = {}) {
  const videoGrid = document.getElementById("videoGrid");

  // Izveido wrapperu, kas satur video bloku un reakciju lauku
  const wrapper = document.createElement("div");
  wrapper.classList.add("video-wrapper");
  wrapper.style.width = "45%"; // Video bloka platums 45% no ekrāna

  // Video konteiners
  const videoContainer = document.createElement("div");
  videoContainer.classList.add("video-container");

  const video = document.createElement("video");
  video.setAttribute("controls", true);
  video.setAttribute("playsinline", true); // Neļauj pilnekrānā uz iOS
  video.setAttribute("poster", `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.jpg`);
  video.src = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.mp4`;

  video.addEventListener("click", (event) => {
    event.stopPropagation();
    document.querySelectorAll(".video-wrapper").forEach(el => el.classList.remove("active"));
    wrapper.classList.add("active");
    document.getElementById("overlay").style.display = "block";
  });

  videoContainer.appendChild(video);

  // Reakciju laukums
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
    });
    reactionContainer.appendChild(reactionBtn);
  });

  // Izveido wrapperu reakcijām, kas var plūst zem video
  const reactionWrapper = document.createElement("div");
  reactionWrapper.classList.add("reaction-wrapper");
  reactionWrapper.appendChild(reactionContainer);

  // Pievieno video konteineru un reakciju laukumu wrapperā
  wrapper.appendChild(videoContainer);
  wrapper.appendChild(reactionWrapper);

  videoGrid.appendChild(wrapper);
  if (isNew) {
    videoGrid.prepend(wrapper);
  }
}

// Kad klikšķina uz overlay, noņem aktivizāciju
document.getElementById("overlay").addEventListener("click", () => {
  document.querySelectorAll(".video-wrapper").forEach(el => el.classList.remove("active"));
  document.getElementById("overlay").style.display = "none";
});

// Funkcija, kas pievieno reakciju Google Sheets
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

// Funkcija, kas ielādē video no Google Sheets un pievieno galerijai
function loadVideosFromGoogleSheets() {
  fetch(`${GOOGLE_SHEETS_URL}?action=getVideos`)
  .then(response => response.json())
  .then(data => {
    if (data.status === "success" && data.data) {
      data.data.reverse().forEach(video => {
        addVideoToGrid(video.publicId, video.reactions);
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

// Pievieno augšupielādes funkcionalitāti
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
