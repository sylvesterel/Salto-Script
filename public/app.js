let user;
const statusFragment = document.createDocumentFragment();

const statusList = document.querySelector('#user-list')

const userInfo = document.querySelector('.user-info')
const createBtn = document.querySelector('#createUserBtn');
const statusText = document.querySelector('#status')

window.addEventListener("DOMContentLoaded", async () => {
    const userDisplay = document.getElementById("loggedInUser");

    try {
        const res = await fetch("/me");
        if (!res.ok) {
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

function updateStatus(info, clear) {

    const newInfoElement = document.createElement('li')
    const now = new Date();

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    const statusTime = `${hours}.${minutes}.${seconds}`

    if (clear) {
        while (statusList.firstChild) {
            console.log(statusList.firstChild);
            statusList.removeChild(statusList.firstChild);
        }
        if (info === "SEAM-FEJL-500") {
            info = "API'en mellem Salto og Tourcare er timeout i forsøg på at hente pinkode. Sylle kender fejlen, og er ved at få den udredet med Salto :). For nu, gå til app.salto.com, og manuelt opret en bruger eller kom tilbage senere. Sletter forespurgte bruger."
        }
        newInfoElement.textContent = `${statusTime} | ${info}`
    }

    newInfoElement.textContent = `${statusTime} | ${info}`
    statusList.appendChild(newInfoElement)
}


createBtn.addEventListener("click", async () => {

    const name = document.getElementById("userName").value
    const start = document.getElementById("startTime").value
    const end = document.getElementById("endTime").value

    createBtn.disabled = true

    if (!name || !start || !end) {
        statusText.textContent = "Udfyld alle felter!"
        createBtn.style.display = 'none';

        await setTimeout(() => {
            createBtn.style.display = ''
            statusText.textContent = ""
        }, 3000)
        createBtn.disabled = false
        return
    }
    createBtn.title = `Opretter bruger ${name}, vent venligst.`;

    userInfo.style.display = 'block';

    const datePart = end.split('T')[0]; // "2025-10-28"
    const [year, month, day] = datePart.split('-');

    statusText.textContent = "Vent venligst"
    createBtn.style.display = 'none';

    updateStatus(`Opretter bruger`)
    
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
        updateStatus(err, true)

    } finally {
        createBtn.style.display = ''
        statusText.textContent = ""
        createBtn.disabled = false
    }
    
})