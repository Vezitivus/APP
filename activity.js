const CLOUDINARY_CLOUD_NAME = "dmkpb05ww"; 
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbyDO5hMMHgqgbCfZ_AHyQRRe6_9S_7hTx420k2busDFeWIoKCI-9wEeApXiry7vv6MxWQ/exec";

const reactions = ["❤️", "😂", "😢", "🔥"];
// Reakciju datu kolonnas no Google Sheets: A=0, B=1, C=2, D=3, E=4, F=5, G=6
// Saglabāsim reakcijas sākotnēji kolonnās D, E, F, G
const reactionColumns = { "❤️": "D", "😂": "E", "😢": "F", "🔥": "G" };

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
  // Šeit saglabājam Public ID, UID, un sākotnējās reakciju vērtības (kolonna C paliek tukša, reakcijas sākas no D)
  fetch(`${GOOGLE_SHEETS_URL}?action=saveVideo&publicId=${encodeURIComponent(publicId)}&uid=${encodeURIComponent(uid)}`)
    .then(response => response.json())
    .then(data => console.log("Saglabāts:", data))
    .catch(error => console.error("Kļūda ar Google Sheets:", error));
}

// Funkcija, kas pievieno video galerijai
function addVideoToGrid(publicId, isNew = false, reactionsData = {}) {
  const videoGrid = document.getElementById("videoGrid");

  // Izveido video-wrapper, kas satur video un reakciju lauku zem tā
  const wrapper = document.createElement("div");
  wrapper.classList.add("video-wrapper");
  wrapper.style.width = "45%";

  // Video konteiners
  const videoContainer = document.createElement("div");
  videoContainer.classList.add("video-container");

  const video = document.createElement("video");
  video.setAttribute("controls", true);
  video.setAttribute("playsinline", true);
  video.setAttribute("poster", `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.jpg`);
  video.src = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.mp4`;

  video.addEventListener("click", (event) => {
    event.stopPropagation();
    // Noņem active statusu visiem wrapperiem
    document.querySelectorAll(".video-wrapper").forEach(el => el.classList.remove("active"));
    wrapper.classList.add("active");
  });

  videoContainer.appendChild(video);

  // Reakciju wrapper – izvietots zem video konteinera
  const reactionWrapper = document.createElement("div");
  reactionWrapper.classList.add("reaction-wrapper");
  // Sākotnēji reakciju wrapper ir paslēpts
  reactionWrapper.style.maxHeight = "0px";
  reactionWrapper.style.opacity = "0";
  reactionWrapper.style.transform = "translateY(-10px)";

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

  // Izveido elementu, lai parādītu kopējo reakciju skaitu
  const reactionTotal = document.createElement("div");
  reactionTotal.classList.add("reaction-total");
  reactionTotal.textContent = "Kopā: " + calculateTotalReactions(reactionsData);

  reactionWrapper.appendChild(reactionContainer);
  reactionWrapper.appendChild(reactionTotal);

  wrapper.appendChild(videoContainer);
  wrapper.appendChild(reactionWrapper);

  videoGrid.appendChild(wrapper);
  if (isNew) {
    videoGrid.prepend(wrapper);
  }
}

// Funkcija, kas aprēķina kopējo reakciju skaitu
function calculateTotalReactions(reactionsData) {
  let total = 0;
  for (let key in reactionsData) {
    total += parseInt(reactionsData[key], 10) || 0;
  }
  return total;
}

// Funkcija, kas atjaunina kopējo reakciju skaitu, balstoties uz reakciju pogām
function updateTotalReactions(reactionContainer) {
  const buttons = reactionContainer.querySelectorAll(".reaction-btn");
  let total = 0;
  buttons.forEach(btn => {
    const count = parseInt(btn.textContent.split(" ")[1], 10) || 0;
    total += count;
  });
  const reactionTotalEl = reactionContainer.parentElement.querySelector(".reaction-total");
  if (reactionTotalEl) {
    reactionTotalEl.textContent = "Kopā: " + total;
  }
}

// Globalizēts klikšķu klausītājs – ja klikšķina ārpus video wrapperiem, noņem active statusu
document.addEventListener("click", (event) => {
  if (!event.target.closest(".video-wrapper")) {
    document.querySelectorAll(".video-wrapper").forEach(el => el.classList.remove("active"));
  }
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
