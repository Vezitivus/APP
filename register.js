document.addEventListener("DOMContentLoaded", function () {
    const inviteBtn = document.getElementById("openInvite");
    const formSection = document.getElementById("formSection");
    const registerBtn = document.getElementById("registerBtn");
    const usernameField = document.getElementById("username");
    const loadingScreen = document.getElementById("loadingScreen");
    const celebrationVideo = document.getElementById("celebrationVideo");
    const skipButton = document.getElementById("skipButton");

    inviteBtn.addEventListener("click", function () {
        window.location.href = "invitation.html";
    });

    if (localStorage.getItem("inviteAccepted") === "true") {
        inviteBtn.innerText = "Ielūgums apstiprināts";
        inviteBtn.classList.remove("dark");
        formSection.classList.remove("hidden");
        usernameField.disabled = false;
        registerBtn.disabled = false;
    }

    registerBtn.addEventListener("click", function () {
        const username = usernameField.value.trim();
        if (!username) {
            alert("Lūdzu ievadi savu vārdu!");
            return;
        }

        // Nosūtīt datus uz Google Sheets
        fetch("https://script.google.com/macros/s/YOUR_GOOGLE_SCRIPT_URL/exec", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ uid: "VZ001", username: username })
        }).then(response => response.json()).then(result => {
            if (result.status === "success") {
                document.querySelector(".register-container").style.display = "none";
                loadingScreen.classList.remove("hidden");
                celebrationVideo.muted = false;
                celebrationVideo.play();

                celebrationVideo.onended = function () {
                    window.location.href = result.redirectUrl;
                };

                skipButton.addEventListener("click", function () {
                    window.location.href = result.redirectUrl;
                });
            } else {
                alert("Reģistrācijas kļūda. Mēģini vēlreiz.");
            }
        });
    });
});
