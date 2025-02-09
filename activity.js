// Cloudinary iestatījumi
const CLOUDINARY_CLOUD_NAME = "dmkpb05ww"; // Tavs Cloudinary konta nosaukums
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus"; // Tavs Upload Preset
const VIDEO_FOLDER = "vezitivus_videos"; // Mape, kurā saglabā video

// Pārbauda, vai URL satur UID
const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get("uid");

// Ja UID ir norādīts, parāda augšupielādes sadaļu
if (uid) {
  document.getElementById("uploadSection").style.display = "block";
}

// Funkcija video augšupielādei uz Cloudinary
function uploadVideo(file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", VIDEO_FOLDER);

  fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
    method: "POST",
    body: formData,
  })
    .then(response => response.json())
    .then(data => {
      if (data.public_id) {
        addVideoToPlayer(data.public_id); // Pievieno video galerijai
      } else {
        alert("Augšupielāde neizdevās.");
      }
    })
    .catch(error => console.error("Augšupielādes kļūda:", error));
}

// Funkcija video pievienošanai Cloudinary Video Player
function addVideoToPlayer(publicId) {
  const videoGrid = document.getElementById("videoGrid");

  const container = document.createElement("div");
  container.classList.add("video-container");

  container.innerHTML = `
    <video id="videoPlayer_${publicId}" controls></video>
  `;

  videoGrid.appendChild(container);

  const cld = cloudinary.Cloudinary.new({
    cloud_name: CLOUDINARY_CLOUD_NAME,
  });

  const player = cld.videoPlayer(`videoPlayer_${publicId}`, {
    controls: true,
    autoplay: false,
    muted: false,
    width: 300,
    height: 200,
  });

  player.source(publicId, {
    sourceTypes: ["mp4"],
  });
}

// Funkcija esošo video ielādei
function loadVideos() {
  const videoGrid = document.getElementById("videoGrid");

  fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/video?prefix=${VIDEO_FOLDER}`)
    .then(response => response.json())
    .then(data => {
      data.resources.forEach(video => {
        addVideoToPlayer(video.public_id);
      });
    })
    .catch(error => console.error("Kļūda, iegūstot video:", error));
}

// Kad lapa ielādējas, ielādē esošos video
document.addEventListener("DOMContentLoaded", loadVideos);

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

// Video palielināšana, uzspiežot uz video
document.addEventListener("click", (event) => {
  const videoContainer = event.target.closest(".video-container");
  if (videoContainer) {
    videoContainer.classList.toggle("expanded");
  }
});
