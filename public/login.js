document.getElementById("loginBtn").addEventListener("click", async () => {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const status = document.getElementById("status");

    if (!username || !password) {
        status.innerText = "Udfyld begge felter!";
        return;
    }

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            window.location.href = "/"; // Send til index
        } else {
            status.innerText = "❌ " + data.error;
        }
    } catch {
        status.innerText = "❌ Netværksfejl";
    }
});