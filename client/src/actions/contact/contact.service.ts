import { google, calendar_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

export class GoogleMeetService {
  private authClient: OAuth2Client | null = null;
  private calendar: calendar_v3.Calendar | null = null;

  constructor() {
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_REDIRECT_URI ||
      !process.env.GOOGLE_REFRESH_TOKEN
    ) {
      throw new Error("Missing one or more Google API environment variables.");
    }
  }
}
