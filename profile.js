document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");

    if (!uid) {
        document.body.innerHTML = "<h1>Kļūda: NFC ID nav atrasts!</h1>";
        return;
    }

    fetch(`https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec?uid=${uid}&action=getProfile`)
        .then(response => response.json())
        .then(data => {
            if (data.status === "success") {
                document.getElementById("username").innerText = data.username;
                document.getElementById("nfc-id").innerText = data.uid;
            } else {
                document.body.innerHTML = "<h1>Kļūda: Lietotāja profils nav atrasts!</h1>";
            }
        })
        .catch(error => {
            console.error("Kļūda:", error);
            document.body.innerHTML = "<h1>Kļūda: Savienojuma problēma.</h1>";
        });

    document.getElementById("logoutBtn").addEventListener("click", function () {
        window.location.href = "https://vezitivus.github.io/APP/";
    });
});
