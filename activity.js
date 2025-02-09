const CLOUDINARY_CLOUD_NAME = "dmkpb05ww"; // Tavs Cloudinary konta nosaukums
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus"; // Tavs Upload Preset
const VIDEO_FOLDER = "vezitivus_videos"; // Cloudinary mape augšupielādēm

// Masīvs ar attāliem video URL (Fetch Mode)
const REMOTE_VIDEO_URLS = [
  "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/cf/TourDeFrance2015_Etape8_PassageRennes.webm/TourDeFrance2015_Etape8_PassageRennes.webm.1080p.vp9.webm",
  "https://upload.wikimedia.org/wikipedia/commons/4/45/Example_video.mp4"
];

// Pārbauda, vai URL satur UID (lai parādītu augšupielādes pogu)
const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get("uid");
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
        addVideoToPlayer(data.public_id); // Pievieno video Cloudinary Player
      } else {
        alert("Augšupielāde neizdevās.");
      }
    })
    .catch(error => console.error("Augšupielādes kļūda:", error));
}

// Funkcija pievienošanai Cloudinary Video Player
function addVideoToPlayer(publicId) {
  const videoGrid = document.getElementById("videoGrid");

  const container = document.createElement("div");
  container.classList.add("video-container");

  // Izveido Cloudinary Video Player
  container.innerHTML = `
    <video id="videoPlayer_${publicId}" controls></video>
  `;

  videoGrid.appendChild(container);

  // Inicializē Cloudinary Video Player
  const cld = cloudinary.Cloudinary.new({
    cloud_name: CLOUDINARY_CLOUD_NAME,
  });

  const player = cld.videoPlayer(`videoPlayer_${publicId}`, {
    controls: true,
    autoplay: false,
    muted: false,
    width: 600,
    height: 400,
  });

  player.source(publicId, {
    sourceTypes: ['mp4'],
  });
}

// Funkcija video ielādei no attāliem resursiem (Fetch Mode)
function loadVideos() {
  REMOTE_VIDEO_URLS.forEach(url => {
    const videoGrid = document.getElementById("videoGrid");

    const container = document.createElement("div");
    container.classList.add("video-container");

    container.innerHTML = `
      <video id="remotePlayer_${url}" controls></video>
    `;

    videoGrid.appendChild(container);

    // Inicializē Cloudinary Video Player
    const cld = cloudinary.Cloudinary.new({
      cloud_name: CLOUDINARY_CLOUD_NAME,
    });

    const player = cld.videoPlayer(`remotePlayer_${url}`, {
      controls: true,
      autoplay: false,
      muted: false,
      width: 600,
      height: 400,
    });

    player.source(url, {
      sourceTypes: ['mp4'],
    });
  });
}

// Kad lapa ielādējas, parāda esošos video
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