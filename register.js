document.addEventListener("DOMContentLoaded", function () {
    const inviteBtn = document.getElementById("openInvite");
    const usernameField = document.getElementById("username");
    const registerBtn = document.getElementById("registerBtn");
    const loadingScreen = document.getElementById("loadingScreen");
    const celebrationVideo = document.getElementById("celebrationVideo");
    const skipButton = document.getElementById("skipButton");

    let redirectUrl = ""; // Mainīgais, lai saglabātu nākamās lapas URL

    // Ielūguma atvēršana
    inviteBtn.addEventListener("click", function () {
        window.location.href = "invitation.html";
    });

    // Reģistrācijas pogas nospiešana
    registerBtn.addEventListener("click", function () {
        const username = usernameField.value.trim();

        if (!username) {
            alert("Lūdzu ievadi savu vārdu!");
            return;
        }

        const uid = new URLSearchParams(window.location.search).get("uid") || "VZ001"; // Noklusējuma UID

        // Nosūta datus uz Google Sheets
        fetch("https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                uid: uid,
                username: username
            })
        })
            .then(response => response.json())
            .then(result => {
                if (result.status === "success") {
                    // Saglabā profila URL, kas atrodas Google Sheets D kolonnā
                    redirectUrl = result.redirectUrl;

                    // Parāda loading ekrānu un slēpj reģistrācijas formu
                    document.querySelector(".register-container").style.display = "none";
                    loadingScreen.classList.remove("hidden");

                    // Pēc īsa aizkaves sāk video atskaņošanu
                    setTimeout(() => {
                        celebrationVideo.muted = false;
                        celebrationVideo.play();
                    }, 1000);

                    // Kad video beidzas, pāradresē uz Google Sheets saglabāto URL
                    celebrationVideo.onended = function () {
                        window.location.href = redirectUrl;
                    };

                    // Skip poga pāradresē uz Google Sheets saglabāto URL
                    skipButton.addEventListener("click", function () {
                        window.location.href = redirectUrl;
                    });
                } else {
                    alert("Reģistrācijas kļūda: " + result.message);
                }
            })
            .catch(error => {
                console.error("Kļūda reģistrācijas laikā:", error);
                alert("Neizdevās sazināties ar serveri. Pārbaudiet interneta savienojumu.");
            });
    });
});
