let user;
const statusList = document.querySelector('#user-list');
const userInfo = document.querySelector('.user-info');
const createBtn = document.querySelector('#createUserBtn');
const statusText = document.querySelector('#status');

window.addEventListener("DOMContentLoaded", async () => {
    const userDisplay = document.getElementById("loggedInUser");

    try {
        const res = await fetch("/me");
        if (!res.ok) {
            window.location.href = "/login.html";
            return;
        }
        const data = await res.json();
        user = data.username;
        userDisplay.innerText = `Logget ind som: ${data.username}`;
    } catch (err) {
        userDisplay.innerText = "Fejl ved hentning af brugerinfo";
    }
});

function updateStatus(info, clear) {
    const newInfoElement = document.createElement('li');
    const now = new Date();
    const statusTime = `${now.getHours()}.${now.getMinutes()}.${now.getSeconds()}`;
    if (clear) while (statusList.firstChild) statusList.removeChild(statusList.firstChild);
    newInfoElement.innerHTML = `${statusTime} | ${info}`;
    statusList.appendChild(newInfoElement);
}

// Enter på inputfelter
const inputs = document.querySelectorAll("#userName, #startTime, #endTime");
inputs.forEach(input => input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        createBtn.click();
    }
}));

createBtn.addEventListener("click", async () => {
    const name = document.getElementById("userName").value;
    const start = document.getElementById("startTime").value;
    const end = document.getElementById("endTime").value;

    const datePart = end.split('T')[0]; // "2025-10-28"
    const [year, month, day] = datePart.split('-');

    createBtn.disabled = true;
    if (!name || !start || !end) {
        statusText.textContent = "Udfyld alle felter!";
        createBtn.style.block = "none";
        setTimeout(() => {
            statusText.textContent = "";
            createBtn.style.block = '';
        }, 3000);
        createBtn.disabled = false;
        return;
    }

    createBtn.title = `Opretter bruger ${name}, vent venligst.`;
    userInfo.style.display = 'block';
    statusText.textContent = "Vent venligst";
    createBtn.style.block = "none";

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
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let credentialId = null;

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;
            if (value) {
                const text = decoder.decode(value);
                text.split("\n").forEach(line => {
                    if (!line.trim()) return;

                    if (line.startsWith("CREDENTIAL_ID:")) {
                        credentialId = line.replace("CREDENTIAL_ID:", "").trim();
                        pollPin(credentialId);
                    } else {
                        updateStatus(line.trim());
                    }
                });
            }
        }

    } catch (err) {
        updateStatus(err, true);
    } finally {
        createBtn.disabled = false;
        createBtn.style.block = '';
        statusText.textContent = '';
        createBtn.title = '';
    }
});

// Polling funktion for pinkode
async function pollPin(credentialId) {
    let attempts = 0;
    const interval = setInterval(async () => {
        attempts++;
        if (attempts > 60) { // max 5 min
            updateStatus("❌ Pinkode timeout");
            clearInterval(interval);
            return;
        }

        try {
            const res = await fetch(`/check-pin?credential_id=${credentialId}`);
            const data = await res.json();
            if (data.pin) {
                updateStatus(`Pinkode generet: <b>${data.pin}+ #</b>`);
                clearInterval(interval);
            }
        } catch (err) {
            updateStatus("❌ Fejl ved hentning af pinkode");
            clearInterval(interval);
        }

    }, 5000);
}
