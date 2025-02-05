document.addEventListener("DOMContentLoaded", function () {
    const container = document.querySelector(".glass-effect");

    // Dinamiski pievieno HTML saturu
    container.innerHTML = `
        <h1 class="title">Žēl, ka šoreiz nepievienosies</h1>
        <p>Bet ja pārdomāsi, reģistrācija vienmēr pieejama.</p>
        <video id="byeVideo" src="bye.mov" autoplay playsinline loop></video>
    `;

    const video = document.getElementById("byeVideo");

    // Pārbauda, vai video ir ielādējies bez kļūdām
    video.addEventListener("error", function () {
        console.error("Kļūda ielādējot video!");
    });
});
