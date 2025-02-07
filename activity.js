// Cloudinary iestatījumi
const CLOUDINARY_CLOUD_NAME = "dmkpb05ww";
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";

// URL parametru apstrāde
const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get('uid');

// Parādīt augšupielādes pogu, ja `uid` ir definēts
if (uid) {
  $('#uploadSection').show();
}

// Funkcija augšupielādēšanai uz Cloudinary
function uploadVideoFile(file) {
  const cloudUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  fetch(cloudUrl, { method: "POST", body: formData })
    .then(response => response.json())
    .then(data => {
      if (data.secure_url) {
        saveVideo(data.secure_url);
      } else {
        alert("Augšupielāde neizdevās.");
      }
    })
    .catch(error => console.error("Augšupielādes kļūda:", error));
}

// Kad lietotājs izvēlas failu
$("#uploadVideoBtn").on("click", function(){
  $("#videoFileInput").click();
});

$("#videoFileInput").on("change", function(){
  const file = this.files[0];
  if (file) {
    uploadVideoFile(file);
  }
});

// Google Apps Script URL
const googleScriptUrl = "https://script.google.com/macros/s/AKfycbyDO5hMMHgqgbCfZ_AHyQRRe6_9S_7hTx420k2busDFeWIoKCI-9wEeApXiry7vv6MxWQ/exec";

// Saglabāt video URL Google Sheets
function saveVideo(videoUrl) {
  if (!uid) {
    alert("Nepieciešams UID!");
    return;
  }
  $.post(googleScriptUrl, { action: "saveVideo", uid: uid, videoUrl: videoUrl })
    .done(() => loadFeed())
    .fail(error => console.error("Neizdevās saglabāt video:", error));
}

// Ielādēt video feed
function loadFeed() {
  $.ajax({
    url: googleScriptUrl,
    dataType: "jsonp",
    jsonp: "callback",
    jsonpCallback: "callbackFunction",
    data: { action: "getVideos" },
    success: function(response) {
      renderFeed(response.data);
    },
    error: function(jqxhr, textStatus, error) {
      console.error("Kļūda, iegūstot video:", textStatus, error);
    }
  });
}

// Parāda video feed kā thumbnails
function renderFeed(videos) {
  const grid = $("#videoGrid");
  grid.empty();
  
  videos.forEach(function(video) {
    const videoContainer = $(`
      <div class="video-container">
        <img class="video-thumbnail" src="${video.videoUrl}.jpg" />
        <i class="fas fa-play-circle play-overlay"></i>
      </div>
    `);

    videoContainer.on("click", function() {
      $(this).html(`
        <video controls autoplay playsinline width="100%">
          <source src="${video.videoUrl}" type="video/mp4">
        </video>
      `);
    });

    grid.append(videoContainer);
  });
}

// Kad lapa ielādējas
$(document).ready(function() {
  loadFeed();
});
