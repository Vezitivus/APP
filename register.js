document.addEventListener("DOMContentLoaded", function () {
    const openInviteButton = document.getElementById("openInvite");
    const registerButton = document.getElementById("registerBtn");
    const usernameField = document.getElementById("username");
    const loadingScreen = document.getElementById("loadingScreen");
    const celebrationVideo = document.getElementById("celebrationVideo");
    const skipButton = document.getElementById("skipButton");

    // Iegūst UID no URL parametriem
    const urlParams = new URLSearchParams(window.location.search);
    const uid = urlParams.get("uid") || "VZ001"; // Noklusējuma UID, ja nav norādīts

    // Atver ielūguma lapu
    openInviteButton.addEventListener("click", function () {
        window.location.href = "invitation.html?uid=" + uid;
    });

    // Aktivizē reģistrācijas pogu, ja ievadīts vārds
    usernameField.addEventListener("input", function () {
        registerButton.disabled = usernameField.value.trim() === "";
    });

    // Reģistrē lietotāju un atjauno Google Sheets datus
    registerButton.addEventListener("click", function () {
        const username = usernameField.value.trim();
        if (!username) {
            alert("Lūdzu ievadi savu vārdu!");
            return;
        }

        // Nosūta datus uz Google Sheets
fetch("https://script.google.com/macros/s/YOUR_GOOGLE_SCRIPT_URL/exec", {
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
        // Noslēpj reģistrācijas lapu un atver celebration video
        document.querySelector(".register-container").classList.add("hidden");
        loadingScreen.classList.remove("hidden");

        celebrationVideo.muted = false;
        celebrationVideo.play();

        celebrationVideo.onended = function () {
            window.location.href = result.redirectUrl;
        };
    } else {
        alert("Reģistrācijas kļūda: " + result.message);
    }
})
.catch(error => {
    console.error("Kļūda reģistrācijas laikā:", error);
    alert("Neizdevās sazināties ar serveri. Pārbaudiet interneta savienojumu.");
});

        .catch(error => {
            console.error("Kļūda reģistrācijas laikā:", error);
            alert("Neizdevās sazināties ar serveri. Pārbaudiet interneta savienojumu.");
        });
    });

    // Padara reģistrācijas pogu aktīvu sākumā
    registerButton.disabled = false;
});
