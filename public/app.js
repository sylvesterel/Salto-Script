let user;
const statusFragment = document.createDocumentFragment();

const statusList = document.querySelector('#user-list')

const userInfo = document.querySelector('.user-info')

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

async function updateStatus(info) {

    const newInfoElement = document.createElement('li')
    const now = new Date();

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const statusTime = `${hours}.${minutes}.${seconds}`

    newInfoElement.textContent = `${statusTime} | ${info}`
    statusList.appendChild(newInfoElement)
}


document.getElementById("createUserBtn").addEventListener("click", async () => {

    const name = document.getElementById("userName").value
    const start = document.getElementById("startTime").value
    const end = document.getElementById("endTime").value



    if (!name || !start || !end) {
        document.getElementById("status").innerText = "Udfyld alle felter!"
        return
    }

    userInfo.style.display = 'block';

    const datePart = end.split('T')[0]; // "2025-10-28"
    const [year, month, day] = datePart.split('-');


    document.getElementById("status").innerText = "Opretter bruger... Vent 30 sek."
    await updateStatus(`Opretter bruger`)

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

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                const text = decoder.decode(value);
                text.split("\n").forEach((line) => {
                    if (line.trim()) updateStatus(line.trim());
                });
            }
        }

    } catch (err) {
        updateStatus(`Intern serverfejl. Kontakt administrator`)
    }

})