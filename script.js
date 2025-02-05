document.addEventListener("DOMContentLoaded", function () {
    const statusElement = document.getElementById("status");

    // Iegūst URL parametru (uid)
    const params = new URLSearchParams(window.location.search);
    const uid = params.get("uid");

    if (!uid) {
        statusElement.textContent = "Kļūda: Nav norādīts UID!";
        return;
    }

    // Nosūta pieprasījumu uz Google Apps Script
    fetch(`https://script.google.com/macros/s/AKfycbxoRm6W_JmWjCw8RaXwWmKDMbIgZN8jYQtKEQMxKPCg1mVRFPp3HnJ8E8b2xTaHopDo/exec?uid=${uid}`)
        .then(response => response.text())
        .then(url => {
            // Pāradresē lietotāju uz reģistrācijas vai profila lapu
            window.location.href = url;
        })
        .catch(error => {
            console.error("Kļūda:", error);
            statusElement.textContent = "Radās kļūda, mēģiniet vēlreiz.";
        });
});
