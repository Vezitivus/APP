document.addEventListener("DOMContentLoaded", function () {
    const video = document.getElementById("byeVideo");

    // Kad video sākas
    video.addEventListener("play", function () {
        console.log("Video veiksmīgi sākts!");
    });

    // Kad video beidzas, tas automātiski sākas no jauna (cilpošanas funkcija)
    video.addEventListener("ended", function () {
        console.log("Video beidzās un tiks atskaņots no jauna.");
    });

    // Kļūdu apstrāde
    video.addEventListener("error", function () {
        console.error("Kļūda ielādējot video! Pārbaudiet faila ceļu un formātu.");
    });
});
