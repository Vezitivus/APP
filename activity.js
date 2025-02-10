const CLOUDINARY_CLOUD_NAME = "dmkpb05ww"; // Tavs Cloudinary konta nosaukums
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus"; // Tavs Upload Preset
const GOOGLE_SHEETS_URL = "https://script.google.com/macros/s/AKfycbyDO5hMMHgqgbCfZ_AHyQRRe6_9S_7hTx420k2busDFeWIoKCI-9wEeApXiry7vv6MxWQ/exec";

// Pārbauda, vai URL satur UID (lai parādītu augšupielādes pogu)
const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get("uid");
if (uid) {
  document.getElementById("uploadSection").style.display = "block";
}

// Funkcija video augšupielādei uz Cloudinary un Public ID saglabāšanai Google Sheets
function uploadVideo(file) {
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
        saveVideoToGoogleSheets(data.public_id); // Saglabā Public ID Google Sheets
        addVideoToGrid(data.public_id); // Pievieno video galerijai
      } else {
        alert("Augšupielāde neizdevās.");
      }
    })
    .catch(error => console.error("Augšupielādes kļūda:", error));
}

// Funkcija, kas saglabā Public ID Google Sheets
function saveVideoToGoogleSheets(publicId) {
  fetch(`${GOOGLE_SHEETS_URL}?action=saveVideo&publicId=${encodeURIComponent(publicId)}`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "success") {
        console.log("Public ID saglabāts Google Sheets:", publicId);
      } else {
        console.error("Kļūda, saglabājot Google Sheets:", data.message);
      }
    })
    .catch(error => console.error("Kļūda ar Google Sheets:", error));
}

// Funkcija, kas pievieno video galerijai
function addVideoToGrid(publicId) {
  const videoGrid = document.getElementById("videoGrid");

  const container = document.createElement("div");
  container.classList.add("video-container");

  const video = document.createElement("video");
  video.setAttribute("controls", true);
  video.setAttribute(
    "poster",
    `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.jpg`
  );
  video.src = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${publicId}.mp4`;

  // Video klikšķis aktivizē palielināšanu
  video.addEventListener("click", () => {
    document.querySelectorAll(".video-container").forEach(el => {
      el.classList.remove("active");
    });
    container.classList.toggle("active");
  });

  container.appendChild(video);
  videoGrid.appendChild(container);
}

// Funkcija, kas ielādē video no Google Sheets un pievieno galerijai
function loadVideosFromGoogleSheets() {
  const loadingScreen = document.getElementById("loadingScreen");
  fetch(`${GOOGLE_SHEETS_URL}?action=getVideos`)
    .then(response => response.json())
    .then(data => {
      if (data.status === "success" && data.data) {
        data.data.forEach(video => {
          addVideoToGrid(video.publicId);
        });
      } else {
        console.error("Kļūda, ielādējot video:", data.message);
      }
    })
    .catch(error => console.error("Kļūda ar Google Sheets:", error))
    .finally(() => {
      // Slēdz loading ekrānu
      loadingScreen.style.display = "none";
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