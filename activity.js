// Cloudinary konfigurācija
const CLOUDINARY_CLOUD_NAME = "dmkpb05ww";
const CLOUDINARY_UPLOAD_PRESET = "Vezitivus";
const CLOUDINARY_ASSET_FOLDER = "samples/ecommerce";

// URL parametru apstrāde, piemēram: activity.html?uid=VZ001
const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get('uid');
if (uid) {
  $('#uploadSection').show();
} else {
  $('#uploadSection').hide();
}

// Funkcija, kas augšupielādē video failu uz Cloudinary, izmantojot unsigned upload API
function uploadVideoFile(file) {
  const cloudUrl = "https://api.cloudinary.com/v1_1/" + CLOUDINARY_CLOUD_NAME + "/video/upload";
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", CLOUDINARY_ASSET_FOLDER);

  fetch(cloudUrl, {
    method: "POST",
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    console.log("Video augšupielādēts:", data.secure_url);
    if (data.secure_url) {
      saveVideo(data.secure_url);
    } else {
      alert("Video augšupielāde neizdevās.");
    }
  })
  .catch(error => {
    console.error("Kļūda video augšupielādē:", error);
  });
}

// Poga "Augšupielādēt video" – aktivizē paslēpto faila ievades lauku
$("#uploadVideoBtn").on("click", function(){
  if (uid) {
    $("#videoFileInput").click();
  } else {
    alert("Lai augšupielādētu video, piesakieties savā profilā!");
  }
});

$("#videoFileInput").on("change", function(){
  const file = this.files[0];
  if (file) {
    uploadVideoFile(file);
  }
});

// Google Apps Script servisa URL
const googleScriptUrl = "https://script.google.com/macros/s/AKfycbyDO5hMMHgqgbCfZ_AHyQRRe6_9S_7hTx420k2busDFeWIoKCI-9wEeApXiry7vv6MxWQ/exec";

// Saglabā video, izsaucot Google Apps Script (action=saveVideo)
function saveVideo(videoUrl) {
  if (!uid) {
    alert("Lai saglabātu video, piesakieties savā profilā!");
    return;
  }
  $.post(googleScriptUrl, { action: "saveVideo", uid: uid, videoUrl: videoUrl })
    .done(function(response) {
      console.log("Video saglabāts:", response);
      loadFeed();
    })
    .fail(function(error) {
      console.error("Neizdevās saglabāt video:", error);
    });
}

// Iegūst video feed, izmantojot JSONP, lai apietu CORS ierobežojumus
function loadFeed() {
  $.ajax({
    url: googleScriptUrl,
    dataType: "jsonp",
    jsonp: "callback",               // Parametra nosaukums, kuru sagaida GAS
    jsonpCallback: "callbackFunction", // Fiksēts callback funkcijas nosaukums
    data: { action: "getVideos" },
    success: function(response) {
      console.log("Iegūtie video:", response);
      renderFeed(response.data);
    },
    error: function(jqxhr, textStatus, error) {
      console.error("Kļūda, iegūstot video:", textStatus, error);
    },
    complete: function() {
      $("#loader").hide();
    }
  });
}

// Attēlo video ierakstus
function renderFeed(videos) {
  const grid = $("#videoGrid");
  grid.empty();
  videos.forEach(function(video) {
    const container = $("<div class='video-container'></div>");
    container.attr("data-video-url", video.videoUrl);
    
    // Video elements – sākumā statisks attēls; video neatspēlē automātiski
    const vidEl = $("<video muted playsinline></video>");
    vidEl.attr("src", video.videoUrl);
    container.append(vidEl);
    
    // Like skaita rādītājs
    const likeCount = $("<div class='like-count'></div>").text(video.likes ? video.likes.length : 0);
    container.append(likeCount);
    
    // Like poga – sirds ikona
    const likeButton = $("<button class='like-button'><i class='fa-regular fa-heart'></i></button>");
    if (!uid) {
      likeButton.prop("disabled", true);
    } else {
      likeButton.on("click", function(e) {
        e.stopPropagation();
        likeVideo(video.videoUrl, container, likeCount);
      });
    }
    container.append(likeButton);
    
    // Klikšķa apstrāde – video tiek palaists tikai tad, kad lietotājs uzklikšķina uz konteinerā
    container.on("click", function() {
      if (container.hasClass("selected")) {
        container.removeClass("selected");
        vidEl[0].pause();
        container.css("height", "160px");
      } else {
        $(".video-container").not(container).removeClass("selected").each(function(){
          $(this).css("height", "160px");
          $(this).find("video")[0].pause();
        });
        container.addClass("selected");
        container.css("height", window.innerWidth * 0.9 + "px");
        vidEl[0].play();
      }
    });
    
    grid.append(container);
  });
}

// Reģistrē like darbību
function likeVideo(videoUrl, container, likeCountElement) {
  if (!uid) {
    alert("Lūdzu piesakieties, lai varētu likot video.");
    return;
  }
  $.post(googleScriptUrl, { action: "likeVideo", uid: uid, videoUrl: videoUrl })
    .done(function(response) {
      console.log("Video like reģistrēts:", response);
      let currentLikes = parseInt(likeCountElement.text());
      likeCountElement.text(currentLikes + 1);
    })
    .fail(function(error) {
      console.error("Kļūda, saglabājot like:", error);
    });
}

// Ielādējam video feed, kad lapa ir gatava
$(document).ready(function(){
  loadFeed();
});
