document.addEventListener("DOMContentLoaded", function () {
    const video = document.getElementById("byeVideo");

    // Kad lietotājs klikšķina uz video, tas pārslēdzas starp atskaņošanu un pauzi
    video.addEventListener("click", function () {
        if (video.paused) {
            video.play()
                .then(() => {
                    console.log("Video sākts pēc lietotāja mijiedarbības.");
                })
                .catch(error => {
                    console.error("Kļūda atskaņojot video:", error);
                });
        } else {
            video.pause();
            console.log("Video apturēts.");
        }
    });

    video.addEventListener("play", function () {
        console.log("Video atskaņo.");
    });

    video.addEventListener("pause", function () {
        console.log("Video pauzēts.");
    });

    video.addEventListener("ended", function () {
        console.log("Video beidzās un atkārtosies.");
    });

    video.addEventListener("error", function () {
        console.error("Kļūda ielādējot video! Pārbaudiet faila ceļu un formātu.");
    });
});