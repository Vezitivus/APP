// Cloudinary konfigurācija
const CLOUDINARY_CLOUD_NAME = "dmkpb05ww";
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus"; // Unsigned preset
const CLOUDINARY_ASSET_FOLDER = "vezitivus_videos";

$(document).ready(function () {
  // Aktivizē augšupielādes pogu
  $("#uploadVideoBtn").on("click", function () {
    $("#videoFileInput").click();
  });

  // Kad tiek izvēlēts fails, augšupielādē uz Cloudinary
  $("#videoFileInput").on("change", function () {
    const file = this.files[0];
    if (file) {
      uploadVideoFile(file);
    }
  });

  // Ielādē video lentu
  loadFeed();
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
        console.log(`Video URL: https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${data.public_id}.mp4`);
        // Pievieno video URL lentai
        videos.push(`https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${data.public_id}.mp4`);
        loadFeed(); // Atjauno video sarakstu
      } else {
        alert("Video augšupielāde neizdevās.");
      }
    })
    .catch(error => console.error("Augšupielādes kļūda:", error));
}

// Ielādē video lentu
function loadFeed() {
  const cloudinaryApiUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/resources/video/list/${CLOUDINARY_ASSET_FOLDER}.json`;

  fetch(cloudinaryApiUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP kļūda: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      renderFeed(data.resources);
    })
    .catch(error => console.error("Kļūda, ielādējot video:", error));
}

// Attēlo video lentu
function renderFeed(videos) {
  const grid = $("#videoGrid");
  grid.empty();

  videos.forEach(video => {
    const videoUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${video.public_id}.mp4`;

    const container = $("<div class='video-container'></div>");
    const videoElement = $("<video controls muted playsinline></video>").attr("src", videoUrl);

    container.append(videoElement);
    grid.append(container);
  });
}
