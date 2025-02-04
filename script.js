document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");

    if (!uid) {
        document.getElementById("status").innerText = "Kļūda: NFC ID nav atrasts!";
        return;
    }

    fetch(`https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec?uid=${uid}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === "success") {
                window.location.href = data.redirectUrl;
            } else {
                document.getElementById("status").innerText = "Kļūda: " + data.message;
            }
        })
        .catch(error => {
            console.error("Kļūda:", error);
            document.getElementById("status").innerText = "Savienojuma kļūda!";
        });
});
