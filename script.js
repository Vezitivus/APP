document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");
    const beepSound = new Audio("beep.mp3");

    if (uid) {
        document.getElementById("status").innerText = "Loading...";
        beepSound.play();

        fetch(`https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec?uid=${uid}`)
            .then(response => response.text())
            .then(url => {
                setTimeout(() => {
                    window.location.href = url;
                }, 1500);
            })
            .catch(error => {
                console.error("Kļūda:", error);
                document.getElementById("status").innerText = "Kļūda, mēģiniet vēlreiz.";
            });
    }
});
