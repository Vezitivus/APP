document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");

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

        // Rāda sagatavošanas ekrānu ar video un "Izlaist" pogu
        document.querySelector(".glass-effect").innerHTML = `
            <h1 class="title">Tavs personīgais profils tiek sagatavots</h1>
            <p>Priecāšos tevi redzēt ballītē!</p>
            <video id="celebrationVideo" src="celebration.MOV" autoplay playsinline></video>
            <button id="skipButton" class="button">Izlaist</button>
        `;

        const video = document.getElementById("celebrationVideo");
        const skipButton = document.getElementById("skipButton");

        // Kad video beidzas, pāriet uz profilu
        video.addEventListener("ended", function () {
            redirectToProfile(uid, username);
        });

        // Poga "Izlaist" ļauj pāriet uz profilu
        skipButton.addEventListener("click", function () {
            redirectToProfile(uid, username);
        });

        // Saglabā lietotāja vārdu un ģenerē profila URL
        fetch("https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ uid: uid, username: username })
        })
        .then(response => response.json())
        .then(result => {
            if (result.status === "success") {
                video.dataset.redirectUrl = result.redirectUrl; // Saglabā URL video datā
            } else {
                document.querySelector(".glass-effect").innerHTML = "<p>Kļūda! " + result.message + "</p>";
            }
        })
        .catch(error => {
            console.error("Kļūda:", error);
            document.querySelector(".glass-effect").innerHTML = "<p>Savienojuma kļūda!</p>";
        });
    });

    // Funkcija profila novirzīšanai
    function redirectToProfile(uid, username) {
        const video = document.getElementById("celebrationVideo");
        const redirectUrl = video.dataset.redirectUrl || `https://vezitivus.github.io/APP/profile.html?uid=${uid}`;
        window.location.href = redirectUrl;
    }
});
