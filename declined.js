document.addEventListener("DOMContentLoaded", function () {
    const byeVideo = document.getElementById("byeVideo");

    // Kad video beidzas, izpilda šo funkciju
    byeVideo.addEventListener("ended", function () {
        console.log("Video ir beidzies");
        // Šeit vari pievienot darbību, piemēram, novirzīšanu vai ziņojumu
    });

    // Ja video ielāde rada kļūdu
    byeVideo.addEventListener("error", function () {
        console.error("Kļūda ielādējot video!");
    });
});
