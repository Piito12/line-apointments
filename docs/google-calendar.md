# Google Calendar setup

[← Back to README](../README.md#english) · [ภาษาไทย](google-calendar.th.md)

The agent uses one Google Calendar as the shop's booking schedule. The `get_available_slots` tool reads events to find free time, and `book_appointment` creates an event when the customer confirms. It connects with a **Service Account** (an account for the system, so nobody's Google login is needed).

### 1. Enable the Google Calendar API

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project (or use an existing one)
2. **APIs & Services → Library** → search for **Google Calendar API** → **Enable**

### 2. Create a Service Account and key

1. **APIs & Services → Credentials → Create credentials → Service account** → name it (e.g. `clinic-agent`) → **Done**. No role is needed.
2. Click the new service account → **Keys** tab → **Add key → Create new key → JSON** → a `.json` file is downloaded
3. Note the `client_email` in the file (it looks like `clinic-agent@<project>.iam.gserviceaccount.com`). You need it in step 3.

> ⚠️ The key file is the service account's password. **Never put it in the project folder or commit it.** Put its value in the env, then delete the file or keep it somewhere safe.

### 3. Create a calendar and share it with the Service Account

1. Open [Google Calendar](https://calendar.google.com/) → next to **Other calendars** click **+ → Create new calendar** → name it (e.g. `Clinic - test`). Keeping it separate from your personal calendar is recommended.
2. Open that calendar's **Settings** → **Share with specific people or groups → Add people** → enter the `client_email` from step 2 → permission **Make changes to events**
3. Scroll to **Integrate calendar** → copy the **Calendar ID** (it looks like `xxxxxxxx@group.calendar.google.com`)

### 4. Add the values to the env

```bash
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...","...":"..."}
GOOGLE_CALENDAR_ID=xxxxxxxx@group.calendar.google.com
```

- `GOOGLE_SERVICE_ACCOUNT_KEY` = the whole JSON file **on one line**. Convert it with `jq -c . key.json` (keep the `\n` in `private_key` as is).
- Locally, put them in `.env.local` and restart `npm run dev`. On Vercel, paste the JSON straight into the env value, then Redeploy.

### 5. Test

Ask the agent "is there a botox slot tomorrow?" You should get a card of free times. After booking, the calendar shows an event named `<service> - <nickname>` (the description has the service, nickname and phone number).

### Calendar rules the agent follows

- Any event not marked **Free** makes that time unavailable (one booking at a time). To block time yourself, e.g. a lunch break, just create a normal event in this calendar.
- An all-day event blocks the whole day.
- All times are Thai time (`Asia/Bangkok`). Opening hours and services are edited in the [shop-data Google Sheet](google-sheet.md).
- No double bookings: the event id is derived from the calendar + start time, so confirming twice or LINE resending an event does not create overlapping bookings.
- If you [split doctors/staff](google-sheet.md#doctors-and-staff-staff-tab), these rules apply to each person's calendar.

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| Agent says it cannot check the schedule yet | `GOOGLE_SERVICE_ACCOUNT_KEY` / `GOOGLE_CALENDAR_ID` not set, or not restarted |
| Error `ไม่ใช่ JSON ที่ถูกต้อง` (not valid JSON) | The key was pasted incompletely or has a line break inside the JSON (it must be one line) |
| Error 404 Not Found | Wrong Calendar ID, or the calendar is not shared with `client_email` |
| Error 403 | Shared as view-only (needs **Make changes to events**), or the Calendar API is not enabled |
| Free times do not match what you see | An event not marked Free is blocking, or you are looking at a different calendar from the configured ID |
