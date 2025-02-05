document.addEventListener("DOMContentLoaded", function () {
    const inviteSection = document.getElementById("inviteSection");
    const formSection = document.getElementById("formSection");
    const openInviteButton = document.getElementById("openInvite");
    const registerButton = document.getElementById("registerBtn");
    const usernameField = document.getElementById("username");
    const loadingScreen = document.getElementById("loadingScreen");
    const celebrationVideo = document.getElementById("celebrationVideo");
    const skipButton = document.getElementById("skipButton");

    // Iegūst UID no URL parametriem
    const urlParams = new URLSearchParams(window.location.search);
    const uid = urlParams.get("uid");

    // Pārbauda, vai ielūgums ir apstiprināts
    if (localStorage.getItem("inviteAccepted") === "true" && uid) {
        inviteSection.classList.add("hidden");
        formSection.classList.remove("hidden");
    }

    // Atver ielūguma lapu
    openInviteButton.addEventListener("click", function () {
        window.location.href = "invitation.html";
    });

    // Reģistrē lietotāju
    registerButton.addEventListener("click", function () {
        const username = usernameField.value.trim();
        if (!username) {
            alert("Lūdzu ievadi savu vārdu!");
            return;
        }

        // Nosūtīt datus uz Google Sheets
        fetch("https://script.google.com/macros/s/YOUR_GOOGLE_SCRIPT_URL/exec", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ uid: uid, username: username })
        }).then(response => response.json()).then(result => {
            if (result.status === "success") {
                formSection.classList.add("hidden");
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
