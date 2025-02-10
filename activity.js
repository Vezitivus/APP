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

// Funkcija video pievienošanai galerijā
function addVideoToGrid(publicId, reactionsData = {}) {
  const videoGrid = document.getElementById("videoGrid");

  const container = document.createElement("div");
  container.classList.add("video-container");

  const video = document.createElement("video");
  video.setAttribute("controls", true);
  video.setAttribute("playsinline", true); // Neļauj atvērt pilnekrānā uz iOS
  video.setAttribute("poster", `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.jpg`);
  video.src = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.mp4`;

  video.addEventListener("loadeddata", () => {
    console.log(`✅ Video ielādēts: ${publicId}`);
    checkAllVideosLoaded();
  });

  video.addEventListener("click", (event) => {
    event.stopPropagation();
    document.querySelectorAll(".video-container").forEach(el => el.classList.remove("active"));
    container.classList.add("active");
    document.getElementById("overlay").style.display = "block";
  });

  const reactionContainer = document.createElement("div");
  reactionContainer.classList.add("reaction-container");

  reactions.forEach((emoji) => {
    const column = reactionColumns[emoji];
    const reactionBtn = document.createElement("button");
    reactionBtn.classList.add("reaction-btn");
    reactionBtn.innerHTML = `${emoji} ${reactionsData[column] || 0}`;
    reactionBtn.addEventListener("click", () => addReaction(publicId, column, reactionBtn));
    reactionContainer.appendChild(reactionBtn);
  });

  container.appendChild(video);
  container.appendChild(reactionContainer);
  videoGrid.appendChild(container);
}

// Kad klikšķina uz overlay, noņem aktivizāciju
document.getElementById("overlay").addEventListener("click", () => {
  document.querySelectorAll(".video-container").forEach(el => el.classList.remove("active"));
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

// Saglabā video sarakstu, lai zinātu, kad visi ir ielādēti
let totalVideos = 0;
let loadedVideos = 0;

// Pārbauda, vai visi video ir ielādēti, lai paslēptu `loadingScreen`
function checkAllVideosLoaded() {
  loadedVideos++;
  console.log(`🔄 Ielādēti video: ${loadedVideos} / ${totalVideos}`);
  if (loadedVideos === totalVideos) {
    console.log("✅ Visi video ielādēti! Slēdzam `loadingScreen`.");
    document.getElementById("loadingScreen").style.display = "none";
  }
}

// Funkcija, kas ielādē video no Google Sheets un pareizi slēpj ielādes ekrānu
function loadVideosFromGoogleSheets() {
  console.log("🔄 Sākam video ielādi no Google Sheets...");
  fetch(`${GOOGLE_SHEETS_URL}?action=getVideos`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "success" && data.data) {
        totalVideos = data.data.length;
        console.log(`📥 Atrasti video: ${totalVideos}`);
        data.data.reverse().forEach(video => {
          addVideoToGrid(video.publicId, video.reactions);
        });

        // Ja nav video, paslēpjam ielādes ekrānu uzreiz
        if (totalVideos === 0) {
          console.log("⚠️ Nav neviena video. Slēdzam `loadingScreen`.");
          document.getElementById("loadingScreen").style.display = "none";
        }
      } else {
        console.error("Kļūda, ielādējot video:", data.message);
        document.getElementById("loadingScreen").style.display = "none";
      }
    })
    .catch(error => {
      console.error("Kļūda ar Google Sheets:", error);
      document.getElementById("loadingScreen").style.display = "none";
    });
}

// Kad lapa ielādējas, ielādē video no Google Sheets
document.addEventListener("DOMContentLoaded", () => {
  loadVideosFromGoogleSheets();
});
