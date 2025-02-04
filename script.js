document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");

    if (uid) {
        fetch(`https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec?uid=${uid}`)
            .then(response => response.text())
            .then(url => {
                if (url.includes("register")) {
                    document.getElementById("status").innerText = "Nepieciešama reģistrācija...";
                    window.location.href = url;
                } else {
                    document.getElementById("status").innerText = "Atver profilu...";
                    window.location.href = url;
                }
            })
            .catch(error => {
                console.error("Kļūda:", error);
                document.getElementById("status").innerText = "Kļūda, mēģiniet vēlreiz.";
            });
    } else {
        document.getElementById("status").innerText = "UID nav atrasts.";
    }
});
