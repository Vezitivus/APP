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
  video.setAttribute("playsinline", true);
  video.setAttribute("poster", `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.jpg`);
  video.src = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.mp4`;

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

// Funkcija, kas ielādē video no Google Sheets
function loadVideosFromGoogleSheets() {
  fetch(`${GOOGLE_SHEETS_URL}?action=getVideos`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "success" && data.data) {
        data.data.reverse().forEach(video => addVideoToGrid(video.publicId, video.reactions));
      }
    })
    .catch(error => console.error("Kļūda ar Google Sheets:", error));
}

document.addEventListener("DOMContentLoaded", () => {
  loadVideosFromGoogleSheets();
});
