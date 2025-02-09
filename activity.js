const CLOUDINARY_CLOUD_NAME = "dmkpb05ww"; // Jūsu Cloudinary konta nosaukums
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus"; // Cloudinary Upload Preset
const VIDEO_FOLDER = "vezitivus_videos"; // Mape Cloudinary kontā

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
        addVideoToGallery(data.public_id);
      } else {
        alert("Augšupielāde neizdevās.");
      }
    })
    .catch(error => console.error("Augšupielādes kļūda:", error));
}

// Funkcija video pievienošanai galerijai
function addVideoToGallery(publicId) {
  const videoGrid = document.getElementById("videoGrid");
  const cloudinaryUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.mp4`;

  const container = document.createElement("div");
  container.classList.add("video-container");

  container.innerHTML = `
    <video controls>
      <source src="${cloudinaryUrl}" type="video/mp4">
    </video>
  `;

  videoGrid.appendChild(container);
}

// Funkcija video ielādei no attāliem resursiem (Fetch Mode)
function loadVideos() {
  const videoGrid = document.getElementById("videoGrid");

  REMOTE_VIDEO_URLS.forEach(url => {
    const cloudinaryUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/fetch/c_fit,w_300,h_200/${url}`;

    const container = document.createElement("div");
    container.classList.add("video-container");

    container.innerHTML = `
      <video controls>
        <source src="${cloudinaryUrl}" type="video/mp4">
      </video>
    `;

    videoGrid.appendChild(container);
  });

  // Noņem loading ekrānu, kad visi video ir ielādēti
  setTimeout(() => {
    document.getElementById("loadingScreen").classList.add("hidden");
  }, 3000);
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