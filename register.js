document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");
    const audio = new Audio("success.mp3");

    if (!uid) {
        document.getElementById("status").innerText = "NFC ID nav atrasts!";
        return;
    }

    document.getElementById("registerBtn").addEventListener("click", function () {
        const username = document.getElementById("username").value.trim();
        if (username === "") {
            document.getElementById("status").innerText = "Lūdzu, ievadi savu vārdu!";
            return;
        }

        document.getElementById("status").innerText = "Saglabāju...";

        fetch("https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ uid: uid, username: username })
        })
        .then(response => response.json())
        .then(result => {
            if (result.status === "success") {
                document.getElementById("status").innerText = "Reģistrācija veiksmīga!";
                audio.play();
                setTimeout(() => {
                    window.location.href = result.redirectUrl;
                }, 3000);
            } else {
                document.getElementById("status").innerText = "Kļūda! " + result.message;
            }
        })
        .catch(error => {
            console.error("Kļūda:", error);
            document.getElementById("status").innerText = "Savienojuma kļūda!";
        });
    });
});
