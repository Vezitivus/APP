// Cloudinary konfigurācija
const CLOUDINARY_CLOUD_NAME = "dmkpb05ww";
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";
const CLOUDINARY_ASSET_FOLDER = "vezitivus_videos";

// URL parametru pārbaude
const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get('uid');

$(document).ready(function () {
  // Aktivizē augšupielādes pogu, ja UID ir URL
  if (uid) {
    $("#uploadVideoBtn").on("click", function () {
      $("#videoFileInput").click();
    });

    $("#videoFileInput").on("change", function () {
      const file = this.files[0];
      if (file) {
        uploadVideoFile(file);
      }
    });
  }
});

// Augšupielādē video uz Cloudinary
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
        alert("Video veiksmīgi augšupielādēts!");
        loadFeed(); // Atjaunina video sarakstu
      } else {
        alert("Video augšupielāde neizdevās.");
      }
    })
    .catch(error => console.error("Augšupielādes kļūda:", error));
}

// Ielādē video lentu no Cloudinary
function loadFeed() {
  const cloudinaryApiUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/list/${CLOUDINARY_ASSET_FOLDER}.json`;

  $.get(cloudinaryApiUrl)
    .done(response => {
      renderFeed(response.resources);
    })
    .fail(error => console.error("Kļūda, ielādējot video:", error));
}

// Attēlo video lentu
function renderFeed(videos) {
  const grid = $("#videoGrid");
  grid.empty();

  videos.forEach(video => {
    const cloudinaryUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${video.public_id}.mp4`;

    const container = $("<div class='video-container'></div>");
    const videoElement = $("<video controls muted playsinline></video>").attr("src", cloudinaryUrl);

    container.append(videoElement);
    grid.append(container);
  });
}
