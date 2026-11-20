# Shop data (Google Sheet)

[← Back to README](../README.md#english) · [ภาษาไทย](google-sheet.th.md)

The shop name, services, opening hours, closed days and shop-specific rules are set in a Google Sheet, with no code changes or redeploys. The agent reads it with the same Service Account as Google Calendar.

### 1. Create the Sheet from the template

1. Download [`templates/business-config-template.xlsx`](../templates/business-config-template.xlsx)
2. Open [Google Drive](https://drive.google.com/) → **New → File upload** → pick the file → open it → **File → Save as Google Sheets**
3. Edit the `settings` and `services` tabs, `staff` if you split doctors/staff, and `closures` if you have special closed/open days (the `วิธีใช้` (how to use) tab explains every field). **Do not rename the tabs, the `key` column or the table headers.**

| Tab | Holds |
|---|---|
| `settings` | `business_name` (required), `business_type`, `contact`, `open_time`, `close_time`, `closed_weekdays` (Thai day names, e.g. `จันทร์, อังคาร` = Monday, Tuesday), `slot_step_minutes`, `booking_window_days`, `min_lead_minutes`, `holiday_calendar` (see [Holidays](#holidays-and-special-closedopen-days-closures-tab)), `extra_instructions` (shop rules, e.g. no medical advice). Empty number or time fields use the defaults |
| `services` | `id` (a-z 0-9 _ -, unique, not shown to customers), `name` (shown to customers), `minutes` (length of one booking), `choose_staff` (TRUE = the customer picks a doctor/staff member, FALSE = the system picks; empty = TRUE) |
| `staff` | Optional. See [Doctors and staff](#doctors-and-staff-staff-tab) |
| `closures` | Optional. See [Holidays and special closed/open days](#holidays-and-special-closedopen-days-closures-tab) |

### 2. Enable the Google Sheets API and share the Sheet

1. Google Cloud Console (same project as Calendar) → **APIs & Services → Library** → search for **Google Sheets API** → **Enable**
2. In the Sheet click **Share** → enter the service account's `client_email` → permission **Viewer**
3. Copy the Sheet ID from the URL `https://docs.google.com/spreadsheets/d/<Sheet ID>/edit`

### 3. Add the value to the env

```bash
CONFIG_SHEET_ID=<Sheet ID>
```

Locally, put it in `.env.local` and restart `npm run dev`. On Vercel, add it in Environment Variables and Redeploy (once; after that you only edit the Sheet).

### Behaviour

- The agent sees Sheet edits within **1 minute** (cached so the Sheet is not called on every message), and uses the new values right away, even in a chat where it already answered with the old ones.
- If a value is wrong, e.g. closing time before opening time or `minutes` not a number, the agent keeps using the last valid values and logs the reason with the row number, e.g. `services แถว 4 (minutes): ต้องเป็นตัวเลข (จำนวนนาที)` (row 4: must be a number of minutes).
- If `CONFIG_SHEET_ID` is set but the Sheet cannot be read on the first load, the agent tells customers the system is temporarily unavailable (it does not fall back to the made-up clinic, which would offer services the shop does not have).
- The persona and shared rules (e.g. never invent free times) live in `agent/instructions.md` and work for any business. The shop data is built from the Sheet every turn.

### Doctors and staff (`staff` tab)

Optional. If the `staff` tab has only the header row, bookings go into the single `GOOGLE_CALENDAR_ID` as before. If you list people, customers can pick one in LINE and the booking goes into that person's calendar.

| Column | Meaning |
|---|---|
| `id` | a-z 0-9 _ -, unique, not `any` (not shown to customers) |
| `name` | The name customers see, e.g. Dr. A |
| `calendar_id` | That person's Google Calendar (Google Calendar → Settings → Integrate calendar → Calendar ID). Each person needs their own calendar |
| `services` | Service ids separated by commas, e.g. `botox, filler`, or `*` = every service. Every service needs at least 1 person |
| `active` | `FALSE` = temporarily not taking bookings. Empty = `TRUE` |

Steps:

1. Create a calendar for each person and share it with the service account's `client_email` with **Make changes to events** (if you forget, that person is never offered and the log shows `[staff] read calendar of "<id>" failed`)
2. List the people in the `staff` tab and set `choose_staff` in the `services` tab

Behaviour:

- **The customer picks a person:** for a service with `choose_staff` = TRUE and more than 1 person who can do it, a card of buttons lets the customer pick a person or "anyone available". If FALSE, or only one person, this step is skipped.
- **Anyone:** offers times when at least 1 person is free. At booking time it picks the free person with the fewest bookings that day (ties go by order in the tab). If that person gets booked first, it switches to another free person automatically.
- **Working hours:** everyone uses the shop's opening hours. If someone is on leave, add an event in their calendar and that time is not offered.
- **Combined calendar:** if `GOOGLE_CALENDAR_ID` is set, every booking is copied there too (the event name includes the provider's name). It is for overview only: free times are checked in each person's calendar. **Cancel or move a booking in that person's calendar.** Edits in the combined calendar do not sync back.

### Holidays and special closed/open days (`closures` tab)

The shop closes on Thai public holidays automatically (Google calendar `th.th#holiday@group.v.calendar.google.com`, only events that are "วันหยุดนักขัตฤกษ์" (public holiday), not observances such as Valentine's Day or Chinese New Year). On those days the agent offers no slots, takes no bookings, and tells customers why the shop is closed.

`settings.holiday_calendar`: empty = Thai holidays, `none` = do not close for holidays, or your own Calendar ID (every all-day event in it = closed; share it with `client_email` too).

The `closures` tab (optional) sets per-day exceptions, one row per day:

| Column | Meaning |
|---|---|
| `date` | Date `2026-12-31` (also accepts `31/12/2026` or a Buddhist-era year) |
| `type` | `closed` (or `ปิด`) = closed all day / `open` (or `เปิด`) = open, even on a holiday or a weekly closed day |
| `open_time`, `close_time` | `open` only. Both set = special hours that day (e.g. half day = `open 10:00 14:00`). Empty = normal hours |
| `note` | The reason the agent gives customers |

Order of rules (the first match wins): `closures` tab → holiday calendar → `closed_weekdays` → normal opening hours

- Holidays are cached for 6 hours. If the holiday calendar cannot be loaded, bookings continue without holiday closures and the log shows `[holidays] load holiday calendar ... failed` (the `closures` tab and weekly closed days still apply).
- Special closed/open days within the booking window are added to the shop data every turn, so customers can ask "are you open on Songkran?".

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| Log `โหลดข้อมูลร้านจาก Google Sheet ไม่สำเร็จ` (could not load shop data) + 403 | Google Sheets API not enabled, or the Sheet is not shared with `client_email` |
| Log 404 / `Unable to parse range` | Wrong `CONFIG_SHEET_ID`, or the `settings` / `services` tab was renamed |
| Log 400 `must not be an Office file` | `CONFIG_SHEET_ID` points to an unconverted .xlsx. Open it, click **File → Save as Google Sheets**, and use the new file's ID |
| Log `ข้อมูลร้านใน Sheet ไม่ถูกต้อง` (shop data in the Sheet is invalid) | Read the listed problems and row numbers in the log and fix them in the Sheet |
| Old values after editing the Sheet | Wait up to 1 minute or restart the server. If the agent still uses old values in an existing chat, type `เริ่มใหม่` (start over) in LINE |
