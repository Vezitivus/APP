const CLOUDINARY_CLOUD_NAME = "dmkpb05ww";
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";
const VIDEO_FOLDER = "vezitivus_videos";

// Dinamiska video ielāde
const REMOTE_VIDEO_URLS = [
  "vezitivus_videos/video1",
  "vezitivus_videos/video2",
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
        addVideoToPlayer(data.public_id);
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
    width: 600,
    height: 400,
  });

  player.source(publicId, {
    sourceTypes: ["mp4"],
  });
}

// Funkcija video ielādei
function loadVideos() {
  REMOTE_VIDEO_URLS.forEach(publicId => {
    addVideoToPlayer(publicId);
  });
}

document.addEventListener("DOMContentLoaded", loadVideos);

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

document.addEventListener("click", (event) => {
  const videoContainer = event.target.closest(".video-container");
  if (videoContainer) {
    videoContainer.classList.toggle("expanded");
  }
});
