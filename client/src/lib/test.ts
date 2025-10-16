import { google } from "googleapis";

console.log(process.env.AUTH_GOOGLE_REDIRECT_URL);
const oauth2client = new google.auth.OAuth2(
  process.env.AUTH_GOOGLE_ID,
  process.env.AUTH_GOOGLE_SECRET,
  process.env.AUTH_GOOGLE_REDIRECT_URL
);

export const url = oauth2client.generateAuthUrl({
  access_type: "offline",
  scope: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ],
});
