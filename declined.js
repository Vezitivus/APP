document.addEventListener("DOMContentLoaded", function () {
    const video = document.getElementById("byeVideo");
    const playButton = document.getElementById("playButton");

    // Poga, lai lietotājs uzsāktu video atskaņošanu
    playButton.addEventListener("click", function () {
        video.play()
            .then(() => {
                // Ja video veiksmīgi sākas, var paslēpt pogu
                playButton.style.display = "none";
                console.log("Video atskaņošanās uzsākta pēc lietotāja mijiedarbības.");
            })
            .catch(error => {
                console.error("Kļūda atskaņojot video:", error);
            });
    });

    // Papildu notikumu klausītāji
    video.addEventListener("play", function () {
        console.log("Video veiksmīgi sākts!");
    });

    video.addEventListener("ended", function () {
        console.log("Video beidzās un tiks atskaņots no jauna.");
    });

    video.addEventListener("error", function () {
        console.error("Kļūda ielādējot video! Pārbaudiet faila ceļu un formātu.");
    });
});