import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import { Seam } from "seam";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 8080;

// ========================
// Middleware
// ========================
app.use(bodyParser.json());
app.use(session({
	secret: process.env.SECRET,
	resave: false,
	saveUninitialized: true
}));

// Kun offentlige filer (login, JS, CSS)
app.use(express.static(path.join(process.cwd(), "public")));

// ========================
// Simpel login
// ========================
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

// Middleware til beskyttede sider
const authMiddleware = (req, res, next) => {
	if (req.session.user) return next();
	return res.redirect("/login.html");
};

app.get("/me", (req, res) => {
	if (!req.session.user) {
		return res.status(401).json({ error: "Ikke logget ind" });
	}
	res.json({ username: req.session.user.username });
});

// ========================
// SEAM KONFIGURATION
// ========================
const seam = new Seam({ apiKey: process.env.SEAM_API });
const acsSystemId = process.env.SEAM_ACS_SYSTEM_ID;
const accessGroupId = process.env.SEAM_ACCESS_GROUP;

// ========================
// Beskyttet route
// ========================
app.get("/", authMiddleware, (req, res) => {
	res.sendFile(path.join(process.cwd(), "protected", "index.html"));
});

// ========================
// Opret bruger + credential
// ========================
app.post("/create-user", authMiddleware, async (req, res) => {
	try {
		const { full_name, starts_at, ends_at, user } = req.body;

		res.setHeader("Content-Type", "text/plain; charset=utf-8");
		res.setHeader("Transfer-Encoding", "chunked");

		res.write(`${user} Opretter bruger ${full_name}` + "\n")

		const today = new Date();

		const acsUser = await seam.acs.users.create({
			full_name,
			acs_system_id: acsSystemId,
			access_schedule: { starts_at: today, ends_at },
		});

		res.write(`Bruger oprettet med ID ${acsUser.acs_user_id}` + "\n");

		await seam.acs.users.addToAccessGroup({
			acs_user_id: acsUser.acs_user_id,
			acs_access_group_id: accessGroupId,
		});

		res.write(`Tilføjer til access group` + "\n");

		const credential = await seam.acs.credentials.create({
			acs_user_id: acsUser.acs_user_id,
			access_method: "code",
		});

		res.write(`Anmoder om pinkode.` + "\n");

		let pin = null;
		const startTime = Date.now();
		res.write(`Starter pinkode loop. Gns. 30 sek. / Timeout: 5 min.` + "\n");

		while (!pin && Date.now() - startTime < 300000) {
			const userCred = await seam.acs.credentials.get({
				acs_credential_id: credential.acs_credential_id,
			});
			if (userCred.code !== null) {
				pin = userCred.code
			} else {
				await new Promise((r) => setTimeout(r, 5000));
			}
		}

		if (pin === null) {
			res.write(`SEAM-FEJL-500` + "\n");

		} else {
			res.write(`Pinkode generet: <b>${pin}+ #</b>` + "\n");

			console.log(`${user} oprettede pinkode til ${full_name}`)

			await seam.acs.users.update({
				acs_user_id: acsUser.acs_user_id,
				access_schedule: {
					starts_at: starts_at,
					ends_at: ends_at,
				},
			});
		}

		res.end()


	} catch (err) {
		console.error(err);
		res.write(`Seam.co's API endpoint fejlede` + "\n");
		res.end();
	}
});


// ========================
// Bloker unsubscribed brugere
// ========================
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

// ========================
// START SERVER
// ========================
app.listen(port, () => console.log(`Server kører på port ${port}`));
