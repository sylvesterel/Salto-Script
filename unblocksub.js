import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import { Seam } from "seam";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 8080;

const seam = new Seam({ apiKey: process.env.SEAM_API });
const acsSystemId = process.env.SEAM_ACS_SYSTEM_ID;
const accessGroupId = process.env.SEAM_ACCESS_GROUP;

async function unblockSubcribedUsers() {
    try {
        const users = await seam.acs.users.list({ acs_system_id: acsSystemId });

        for (const user of users) {
            if (user.is_suspended) {
                if (user.access_schedule) {
                    const start = new Date(user.access_schedule.starts_at)
                    const end = new Date(user.access_schedule.ends_at)
                    const today = new Date();
                    if (today > start && today < end) {
                        console.log(`${user.display_name} skal unblockeres - ${user.acs_user_id}`)
                        await seam.acs.users.unsuspend({
                            acs_user_id: user.acs_user_id,
                        });
                    }
                }

            }

        }
    } catch (err) {
        console.error("Fejl i funktion unblockSubcribedUsers:", err);
    }
}

unblockSubcribedUsers();