const CLOUDINARY_CLOUD_NAME = "dmkpb05ww";
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";
const CLOUDINARY_ASSET_FOLDER = "vezitivus_videos";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwX.../exec";

const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get('uid');

if (uid) {
  $('#uploadSection').show();
} else {
  $('#uploadSection').hide();
}

/**
 * Augšupielādē video uz Cloudinary
 */
function uploadVideoFile(file) {
  const cloudUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", CLOUDINARY_ASSET_FOLDER);

  fetch(cloudUrl, { method: "POST", body: formData })
    .then(response => response.json())
    .then(data => {
      console.log("Video uploaded:", data.public_id);
      if (data.public_id) {
        saveVideo(data.public_id);
      } else {
        alert("Video upload failed.");
      }
    })
    .catch(error => {
      console.error("Error uploading video:", error);
    });
}

/**
 * Saglabā video public ID Google Sheets
 */
function saveVideo(publicId) {
  if (!uid) {
    alert("Lai saglabātu video, piesakieties!");
    return;
  }

  $.post(GOOGLE_SCRIPT_URL, { action: "saveVideo", uid: uid, publicId: publicId })
    .done(response => {
      console.log("Video saved:", response);
      loadFeed();
    })
    .fail(error => {
      console.error("Failed to save video:", error);
    });
}

/**
 * Iegūst un ielādē video no Cloudinary
 */
function loadFeed() {
  $.get(GOOGLE_SCRIPT_URL, { action: "getVideos" })
    .done(response => {
      console.log("Received videos:", response);
      renderFeed(response.data);
    })
    .fail(error => {
      console.error("Error loading videos:", error);
    });
}

/**
 * Attēlo video sarakstu
 */
function renderFeed(videos) {
  const grid = $("#videoGrid");
  grid.empty();
  videos.forEach(video => {
    const container = $("<div class='video-container'></div>");
    const cloudinaryUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/${CLOUDINARY_ASSET_FOLDER}/${video.publicId}.mp4`;

    const vidEl = $("<video muted playsinline></video>");
    vidEl.attr("src", cloudinaryUrl);
    container.append(vidEl);

    grid.append(container);
  });
}

// Ielādējam video feed, kad lapa ir gatava
$(document).ready(loadFeed);
