let user;

window.addEventListener("DOMContentLoaded", async () => {
    const userDisplay = document.getElementById("loggedInUser");

    try {
        const res = await fetch("/me");
        if (!res.ok) {
            // Hvis ikke logget ind, send til login-side
            window.location.href = "/login.html";
            return;
        }

        const data = await res.json();
        user = data.username
        userDisplay.innerText = `Logget ind som: ${data.username}`;
    } catch (err) {
        userDisplay.innerText = "Fejl ved hentning af brugerinfo";
    }
});


document.getElementById("createUserBtn").addEventListener("click", async () => {

    const name = document.getElementById("userName").value
    const start = document.getElementById("startTime").value
    const end = document.getElementById("endTime").value

    if (!name || !start || !end) {
        document.getElementById("status").innerText = "Udfyld alle felter!"
        return
    }

    const datePart = end.split('T')[0]; // "2025-10-28"
    const [year, month, day] = datePart.split('-');


    document.getElementById("status").innerText = "Opretter bruger... Vent 30 sek."

    try {
        const res = await fetch("/create-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                full_name: `${month}/${day} - ${name}`,
                starts_at: new Date(start).toISOString(),
                ends_at: new Date(end).toISOString(),
                user: user
            })
        })

        const data = await res.json()
        if (res.ok) {
            document.getElementById("status").innerText =
                `✅ Bruger oprettet. PIN: ${data.pin_code || "Genereres..."} + #`
        } else {
            document.getElementById("status").innerText =
                "❌ Fejl: " + data.error
        }
    } catch (err) {
        document.getElementById("status").innerText = "❌ Netværksfejl"
    }

})