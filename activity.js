const CLOUDINARY_CLOUD_NAME = "dmkpb05ww";
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";

// Funkcija augšupielādei uz Cloudinary
function uploadVideo(file, uid) {
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
        saveVideoKey(uid, data.public_id);
      } else {
        alert("Augšupielāde neizdevās.");
      }
    })
    .catch(error => console.error("Augšupielādes kļūda:", error));
}

// Funkcija datu saglabāšanai Google Sheets
function saveVideoKey(uid, publicId) {
  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: uid, publicId: publicId }),
  })
    .then(response => response.json())
    .then(data => {
      if (data.status === "success") {
        loadVideos();
      } else {
        alert("Neizdevās saglabāt video atslēgu.");
      }
    })
    .catch(error => console.error("Kļūda, saglabājot video atslēgu:", error));
}

// Funkcija video datu ielādei no Google Sheets
function loadVideos() {
  fetch(`${GOOGLE_SCRIPT_URL}?action=getVideos`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "success") {
        renderVideos(data.data);
      } else {
        alert("Neizdevās ielādēt video.");
      }
    })
    .catch(error => console.error("Kļūda, ielādējot video:", error));
}

// Funkcija video attēlošanai
function renderVideos(videos) {
  const videoGrid = document.getElementById("videoGrid");
  videoGrid.innerHTML = "";

  videos.forEach(video => {
    const container = document.createElement("div");
    container.classList.add("video-container");
    container.innerHTML = `
      <img src="https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/c_fit,w_300,h_200/${video.publicId}.jpg" />
      <i class="fas fa-play-circle play-overlay"></i>
      <video controls>
        <source src="https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${video.publicId}.mp4" type="video/mp4">
      </video>
    `;
    container.addEventListener("click", () => {
      const videoElement = container.querySelector("video");
      const imageElement = container.querySelector("img");
      videoElement.style.display = "block";
      imageElement.style.display = "none";
      videoElement.play();
    });
    videoGrid.appendChild(container);
  });
}

// Kad lapa ir gatava, ielādē video
document.addEventListener("DOMContentLoaded", () => {
  loadVideos();

  document.getElementById("uploadVideoBtn").addEventListener("click", () => {
    const fileInput = document.getElementById("videoFileInput");
    fileInput.click();

    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (file) {
        const uid = prompt("Lūdzu ievadiet savu UID:");
        if (uid) {
          uploadVideo(file, uid);
        } else {
          alert("Nepieciešams UID.");
        }
      }
    };
  });
});