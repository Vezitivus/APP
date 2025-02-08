// Cloudinary konfigurācija
const CLOUDINARY_CLOUD_NAME = "dmkpb05ww";
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";
const CLOUDINARY_ASSET_FOLDER = "vezitivus_videos";

// Manuālais video saraksts (pielāgo ar saviem resursiem)
const videos = [
  "https://res.cloudinary.com/dmkpb05ww/video/upload/v1672930000/vezitivus_videos/video1.mp4",
  "https://res.cloudinary.com/dmkpb05ww/video/upload/v1672930000/vezitivus_videos/video2.mp4"
];

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

  // Ielādē video sarakstu
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
        videos.push(`https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${data.public_id}.mp4`);
        loadFeed(); // Atjaunina video sarakstu
      } else {
        alert("Video augšupielāde neizdevās.");
      }
    })
    .catch(error => console.error("Augšupielādes kļūda:", error));
}

// Ielādē video lentu
function loadFeed() {
  const grid = $("#videoGrid");
  grid.empty();

  videos.forEach(videoUrl => {
    const container = $("<div class='video-container'></div>");
    const videoElement = $("<video controls muted playsinline></video>").attr("src", videoUrl);

    container.append(videoElement);
    grid.append(container);
  });
}
