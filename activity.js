// Cloudinary un Google Web App konfigurācija
const CLOUDINARY_CLOUD_NAME = "dmkpb05ww";
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";
const CLOUDINARY_ASSET_FOLDER = "vezitivus_videos";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyDO5hMMHgqgbCfZ_AHyQRRe6_9S_7hTx420k2busDFeWIoKCI-9wEeApXiry7vv6MxWQ/exec";

// URL parametru pārbaude
const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get('uid');

// Aktīva/neaktīva augšupielādes poga atkarībā no UID
$(document).ready(function () {
  if (uid) {
    $("#uploadVideoBtn").prop("disabled", false);
  }

  $("#uploadVideoBtn").on("click", function () {
    if (!$(this).prop("disabled")) {
      $("#videoFileInput").click();
    }
  });

  $("#videoFileInput").on("change", function () {
    const file = this.files[0];
    if (file) {
      uploadVideoFile(file);
    }
  });

  loadFeed(); // Ielādē video lentu
});

// Video augšupielāde uz Cloudinary
function uploadVideoFile(file) {
  const cloudUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", CLOUDINARY_ASSET_FOLDER);

  fetch(cloudUrl, { method: "POST", body: formData })
    .then(response => response.json())
    .then(data => {
      if (data.public_id) {
        saveVideo(data.public_id);
      } else {
        alert("Video augšupielāde neizdevās.");
      }
    })
    .catch(error => console.error("Augšupielādes kļūda:", error));
}

// Saglabā video public ID Google Sheets
function saveVideo(publicId) {
  if (!uid) {
    alert("Lai saglabātu video, piesakieties!");
    return;
  }

  $.post(GOOGLE_SCRIPT_URL, { action: "saveVideo", uid: uid, publicId: publicId })
    .done(response => {
      console.log("Video saglabāts:", response);
      loadFeed();
    })
    .fail(error => console.error("Saglabāšanas kļūda:", error));
}

// Iegūst video sarakstu no Google Sheets
function loadFeed() {
  $.get(GOOGLE_SCRIPT_URL, { action: "getVideos" })
    .done(response => {
      renderFeed(response.data);
    })
    .fail(error => console.error("Kļūda, ielādējot video:", error));
}

// Attēlo video lentu
function renderFeed(videos) {
  const grid = $("#videoGrid");
  grid.empty();

  videos.forEach(video => {
    const cloudinaryUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${CLOUDINARY_ASSET_FOLDER}/${video.publicId}.mp4`;

    const container = $("<div class='video-container'></div>");
    const videoElement = $("<video muted playsinline></video>").attr("src", cloudinaryUrl);

    container.append(videoElement);
    grid.append(container);
  });
}
