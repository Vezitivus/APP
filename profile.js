document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");

    if (!uid) {
        document.body.innerHTML = "<h1 class='error'>Kļūda: NFC ID nav atrasts!</h1>";
        return;
    }

    fetch(`https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec?uid=${uid}&action=getProfile`)
        .then(response => response.text()) // Saņem atbildi kā tekstu
        .then(text => {
            try {
                // Mēģina parsēt JSON
                const data = JSON.parse(text);
                if (data.status === "success") {
                    document.getElementById("username").innerText = data.username;
                    document.getElementById("nfc-id").innerText = data.uid;
                } else {
                    document.body.innerHTML = "<h1 class='error'>Kļūda: Lietotāja profils nav atrasts!</h1>";
                }
            } catch (error) {
                // Ja parsēšana neizdodas, pieņem, ka atbilde ir URL
                console.warn("Atbilde nav JSON, tiek pārlādēts uz:", text);
                window.location.href = text;
            }
        })
        .catch(error => {
            console.error("Kļūda fetch pieprasījumā:", error);
            document.body.innerHTML = "<h1 class='error'>Kļūda: Savienojuma problēma.</h1>";
        });
});
