document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");
    const successSound = document.getElementById("successSound");

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

        // Rāda sagatavošanas ekrānu ar "Skip video" pogu
        document.querySelector(".glass-effect").innerHTML = `
            <h1 class="title">Tavs personīgais profils tiek sagatavots</h1>
            <p>Priecāšos tevi redzēt ballītē!</p>
            <video id="celebrationVideo" src="celebration.MOV" autoplay playsinline></video>
            <button id="skipVideo" class="button">Izlaist video</button>
        `;

        // Reģistrācijas process
        fetch("https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ uid: uid, username: username })
        })
        .then(response => response.json())
        .then(result => {
            if (result.status === "success") {
                const video = document.getElementById("celebrationVideo");

                // Automātiski pāriet uz profilu pēc video beigām
                video.addEventListener("ended", () => {
                    window.location.href = result.redirectUrl;
                });

                // Pāriet uz profilu, ja nospiesta "Skip video"
                document.getElementById("skipVideo").addEventListener("click", () => {
                    window.location.href = result.redirectUrl;
                });
            } else {
                document.querySelector(".glass-effect").innerHTML = "<p>Kļūda! " + result.message + "</p>";
            }
        })
        .catch(error => {
            console.error("Kļūda:", error);
            document.querySelector(".glass-effect").innerHTML = "<p>Savienojuma kļūda!</p>";
        });
    });
});
