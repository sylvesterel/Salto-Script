import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import { Seam } from "seam";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 8080;

// Middleware
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true
}));

app.use(express.static(path.join(process.cwd(), "public")));

// Simpel login
let USERS;
try {
    USERS = JSON.parse(process.env.USERS || '[]');
} catch (err) {
    console.error('Kunne ikke parse USERS fra .env:', err);
    USERS = [];
}

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const user = USERS.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ error: "Ugyldigt login" });
    req.session.user = { username };
    res.json({ success: true });
});

const authMiddleware = (req, res, next) => {
    if (req.session.user) return next();
    return res.redirect("/login.html");
};

app.get("/me", (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Ikke logget ind" });
    res.json({ username: req.session.user.username });
});

app.get("/", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "index.html"));
});

// SEAM
const seam = new Seam({ apiKey: process.env.SEAM_API });
const acsSystemId = process.env.SEAM_ACS_SYSTEM_ID;
const accessGroupId = process.env.SEAM_ACCESS_GROUP;

app.post("/create-user", authMiddleware, async (req, res) => {
    try {
        const { full_name, starts_at, ends_at, user } = req.body;

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Transfer-Encoding", "chunked");
        const writeStatus = msg => res.write(msg + "\n");

        writeStatus(`${user} Opretter bruger ${full_name}`);

        const today = new Date();

        const acsUser = await seam.acs.users.create({
            full_name,
            acs_system_id: acsSystemId,
            access_schedule: { starts_at: today, ends_at },
        });
        writeStatus(`Bruger oprettet med ID ${acsUser.acs_user_id}`);

        await seam.acs.users.addToAccessGroup({
            acs_user_id: acsUser.acs_user_id,
            acs_access_group_id: accessGroupId,
        });
        writeStatus(`Tilføjet til access group`);

        const credential = await seam.acs.credentials.create({
            acs_user_id: acsUser.acs_user_id,
            access_method: "code",
        });
        writeStatus(`Credential oprettet. Start polling for pinkode...`);

        writeStatus(`CREDENTIAL_ID:${credential.acs_credential_id}`);

        res.end();

    } catch (err) {
        console.error(err);
        res.write("SEAM API fejlede");
        res.end();
    }
});

app.get("/check-pin", authMiddleware, async (req, res) => {
    try {
        const { credential_id } = req.query;
        if (!credential_id) return res.status(400).json({ error: "Ingen credential_id" });

        const userCred = await seam.acs.credentials.get({ acs_credential_id: credential_id });
        if (userCred.code !== null) {
            res.json({ pin: userCred.code });
        } else {
            res.json({ pin: null });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Fejl ved hentning af pinkode" });
    }
});


async function blockUnsubscribedUsers() {
	try {
		const users = await seam.acs.users.list({ acs_system_id: acsSystemId });

		for (const user of users) {
			const notSubscribedWarning = user.warnings?.find(
				w => w.warning_code === "salto_ks_user_not_subscribed"
			);

			if (notSubscribedWarning && user.is_suspended === false) {
				console.log(`${user.full_name} er suspened`)
				if (user.access_schedule) {
					const end = new Date(user.access_schedule.ends_at)
					const today = new Date();
					if (today > end) {
						console.log(`Blokerer unsubscribed bruger: ${user.full_name}`);
						await seam.acs.users.suspend({ acs_user_id: user.acs_user_id });
					}
				} else {
					console.log(`Blokerer unsubscribed bruger: ${user.full_name}`);
					await seam.acs.users.suspend({ acs_user_id: user.acs_user_id });
					console.log(`${user.full_name} er nu blokeret`);
				}
			}
		}
	} catch (err) {
		console.error("Fejl i funktion blockUnsubscribedUsers:", err);
	}
}

blockUnsubscribedUsers();

setInterval(blockUnsubscribedUsers, 60 * 1000);

app.listen(port, () => console.log(`Server kører på port ${port}`));
