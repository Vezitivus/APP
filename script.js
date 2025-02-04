document.addEventListener("DOMContentLoaded", function () {
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");

    if (uid) {
        fetch(`https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec?uid=${uid}`)
            .then(response => response.text())
            .then(url => {
                document.getElementById("status").innerText = "Novirzīšana...";
                window.location.href = url; // Pāradresācija uz profilu / reģistrāciju
            })
            .catch(error => {
                console.error("Kļūda:", error);
                document.getElementById("status").innerText = "Kļūda, mēģiniet vēlreiz.";
            });
    } else {
        document.getElementById("status").innerText = "UID nav atrasts.";
    }
});
