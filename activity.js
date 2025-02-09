const CLOUDINARY_CLOUD_NAME = "dmkpb05ww";
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";
const VIDEO_FOLDER = "vezitivus_videos"; // Norādiet mapi Cloudinary kontā

// Funkcija augšupielādei uz Cloudinary
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
        // Pievieno video galerijai
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

  const container = document.createElement("div");
  container.classList.add("video-container");

  container.innerHTML = `
    <img src="https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/c_fit,w_300,h_180/${publicId}.jpg" alt="Video Thumbnail" />
    <i class="fas fa-play-circle play-overlay"></i>
    <video controls>
      <source src="https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.mp4" type="video/mp4">
    </video>
  `;

  container.addEventListener("click", () => {
    const video = container.querySelector("video");
    const img = container.querySelector("img");

    video.style.display = "block";
    img.style.display = "none";
    video.play();
  });

  videoGrid.appendChild(container);
}

// Funkcija video galerijas ielādei
function loadVideos() {
  const videoPublicIds = [
    // Šeit norādiet sākotnējos public ID no Cloudinary vai dinamiski ielādējiet
  ];

  videoPublicIds.forEach(publicId => {
    addVideoToGallery(publicId);
  });
}

// Augšupielādes pogas funkcionalitāte
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

// Ielādē galeriju, kad lapa ir gatava
document.addEventListener("DOMContentLoaded", loadVideos);