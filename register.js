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
                launchConfetti();
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

    function launchConfetti() {
        const confettiContainer = document.getElementById("confetti-container");
        for (let i = 0; i < 100; i++) {
            const confetti = document.createElement("div");
            confetti.classList.add("confetti");
            confetti.style.left = Math.random() * 100 + "vw";
            confetti.style.animationDuration = Math.random() * 3 + 2 + "s";
            confettiContainer.appendChild(confetti);
        }
    }
});
