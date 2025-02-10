const CLOUDINARY_CLOUD_NAME = "dmkpb05ww"; 
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbyDO5hMMHgqgbCfZ_AHyQRRe6_9S_7hTx420k2busDFeWIoKCI-9wEeApXiry7vv6MxWQ/exec";

// Pārbauda, vai URL satur UID (lai parādītu augšupielādes pogu)
const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get("uid");
if (uid) {
  document.getElementById("uploadSection").style.display = "block";
}

// Funkcija video augšupielādei uz Cloudinary un Public ID + UID saglabāšanai Google Sheets
function uploadVideo(file) {
  document.getElementById("uploadLoadingScreen").style.display = "flex"; // Parāda augšupielādes ekrānu
  document.getElementById("uploadVideoBtn").disabled = true; // Deaktivizē pogu

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
      document.getElementById("uploadLoadingScreen").style.display = "none"; // Paslēpj augšupielādes ekrānu
      document.getElementById("uploadVideoBtn").disabled = false; // Atkal aktivizē pogu
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
function addVideoToGrid(publicId, isNew = false) {
  const videoGrid = document.getElementById("videoGrid");

  const container = document.createElement("div");
  container.classList.add("video-container");

  const video = document.createElement("video");
  video.setAttribute("controls", true);
  video.setAttribute("poster", `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.jpg`);
  video.src = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.mp4`;

  video.addEventListener("click", () => {
    document.querySelectorAll(".video-container").forEach(el => el.classList.remove("active"));
    container.classList.toggle("active");
  });

  container.appendChild(video);
  if (isNew) {
    videoGrid.prepend(container); // Jaunākais video augšpusē
  } else {
    videoGrid.appendChild(container);
  }
}

// Funkcija, kas ielādē video no Google Sheets un pievieno galerijai
function loadVideosFromGoogleSheets() {
  const loadingScreen = document.getElementById("loadingScreen");
  fetch(`${GOOGLE_SHEETS_URL}?action=getVideos`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "success" && data.data) {
        data.data.reverse().forEach(video => {
          addVideoToGrid(video.publicId);
        }); 
      } else {
        console.error("Kļūda, ielādējot video:", data.message);
      }
    })
    .catch(error => console.error("Kļūda ar Google Sheets:", error))
    .finally(() => {
      loadingScreen.style.display = "none"; // Paslēpj ielādes ekrānu
    });
}

// Kad lapa ielādējas, ielādē video no Google Sheets
document.addEventListener("DOMContentLoaded", loadVideosFromGoogleSheets);

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
