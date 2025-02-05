document.addEventListener("DOMContentLoaded", function () {
    const inviteBtn = document.getElementById("openInvite");
    const usernameField = document.getElementById("username");
    const registerBtn = document.getElementById("registerBtn");
    const loadingScreen = document.getElementById("loadingScreen");
    const celebrationVideo = document.getElementById("celebrationVideo");
    const skipButton = document.getElementById("skipButton");

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
        fetch("https://script.google.com/macros/s/YOUR_GOOGLE_SCRIPT_URL/exec", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                uid: uid,
                username: username,
                profileID: `profile-${uid}` // Unikāls profile ID
            })
        })
            .then(response => response.json())
            .then(result => {
                if (result.status === "success") {
                    // Parāda loading ekrānu un slēpj reģistrācijas formu
                    document.querySelector(".register-container").style.display = "none";
                    loadingScreen.classList.remove("hidden");

                    // Atskaņo "celebration" video
                    celebrationVideo.muted = false;
                    celebrationVideo.play();

                    // Kad video beidzas, pāradresē uz profilu
                    celebrationVideo.onended = function () {
                        window.location.href = result.redirectUrl;
                    };

                    // Skip poga pāradresē uz profilu
                    skipButton.addEventListener("click", function () {
                        window.location.href = result.redirectUrl;
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
