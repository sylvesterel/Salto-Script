document.getElementById("createUserBtn").addEventListener("click", async () => {
    const name = document.getElementById("userName").value
    const start = document.getElementById("startTime").value
    const end = document.getElementById("endTime").value

    if (!name || !start || !end) {
        document.getElementById("status").innerText = "Udfyld alle felter!"
        return
    }

    document.getElementById("status").innerText = "Opretter bruger..."

    try {
        const res = await fetch("/create-user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                full_name: name,
                starts_at: new Date(start).toISOString(),
                ends_at: new Date(end).toISOString()
            })
        })

        const data = await res.json()
        if (res.ok) {
            document.getElementById("status").innerText =
                `✅ Bruger oprettet. PIN: ${data.pin_code || "Genereres..."}`
        } else {
            document.getElementById("status").innerText =
                "❌ Fejl: " + data.error
        }
    } catch (err) {
        document.getElementById("status").innerText = "❌ Netværksfejl"
    }
})