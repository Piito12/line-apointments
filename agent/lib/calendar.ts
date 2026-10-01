// เชื่อม Google Calendar ด้วย Service Account
//
// env ที่ต้องมีใน .env.local:
//   GOOGLE_SERVICE_ACCOUNT_KEY  JSON ทั้งก้อนของ service account key (บรรทัดเดียว)
//   GOOGLE_CALENDAR_ID          id ของ calendar ที่ share ให้ service account
//                               ด้วยสิทธิ์ "Make changes to events"
//
// ใช้ scope calendar.events อย่างเดียว (อ่าน/สร้าง/แก้ event) ไม่ใช้ full access

import { createHash } from "node:crypto";

import { auth, calendar, type calendar_v3 } from "@googleapis/calendar";

import { SERVICES, type ServiceId } from "./clinic";
import { localToMs, type BusyInterval } from "./slots";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];
const EVENT_SOURCE = "clinic-appointment-agent";

export class CalendarNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`ยังไม่ได้ตั้งค่า ${missing.join(", ")} ใน .env.local`);
    this.name = "CalendarNotConfiguredError";
  }
}

interface CalendarContext {
  api: calendar_v3.Calendar;
  calendarId: string;
}

let cached: CalendarContext | undefined;

export function getCalendarId(): string {
  return getCalendar().calendarId;
}

function getCalendar(): CalendarContext {
  if (cached) return cached;

  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const missing = [
    ...(rawKey ? [] : ["GOOGLE_SERVICE_ACCOUNT_KEY"]),
    ...(calendarId ? [] : ["GOOGLE_CALENDAR_ID"]),
  ];
  if (!rawKey || !calendarId) throw new CalendarNotConfiguredError(missing);

  let key: { client_email?: string; private_key?: string };
  try {
    key = JSON.parse(rawKey);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY ไม่ใช่ JSON ที่ถูกต้อง");
  }
  if (!key.client_email || !key.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY ไม่มี client_email หรือ private_key");
  }

  const client = new auth.JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES });
  cached = { api: calendar({ version: "v3", auth: client }), calendarId };
  return cached;
}

function eventTimeToMs(t: calendar_v3.Schema$EventDateTime | undefined): number | null {
  if (t?.dateTime) return Date.parse(t.dateTime);
  if (t?.date) return localToMs(t.date, "00:00"); // event ทั้งวัน
  return null;
}

/**
 * ช่วงเวลาที่ไม่ว่างทั้งหมดใน calendar ระหว่าง timeMin ถึง timeMax
 * excludeEventId: ไม่นับ event นี้ (ใช้ตอนเช็คก่อนจอง เพื่อให้คำขอเดิมที่ถูกส่งซ้ำไม่ชนกับตัวเอง)
 */
export async function listBusyIntervals(
  timeMin: number,
  timeMax: number,
  excludeEventId?: string,
): Promise<BusyInterval[]> {
  const { api, calendarId } = getCalendar();
  const busy: BusyInterval[] = [];
  let pageToken: string | undefined;

  do {
    const res = await api.events.list({
      calendarId,
      timeMin: new Date(timeMin).toISOString(),
      timeMax: new Date(timeMax).toISOString(),
      singleEvents: true,
      showDeleted: false,
      maxResults: 2500,
      pageToken,
    });
    for (const ev of res.data.items ?? []) {
      // event ที่ตั้งเป็น "ว่าง" (Free) ไม่นับว่าชน
      if (ev.status === "cancelled" || ev.transparency === "transparent") continue;
      if (excludeEventId && ev.id === excludeEventId) continue;
      const startMs = eventTimeToMs(ev.start);
      const endMs = eventTimeToMs(ev.end);
      if (startMs !== null && endMs !== null) busy.push({ startMs, endMs });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return busy;
}

/**
 * event id ที่คำนวณจาก calendar + เวลาเริ่ม (รับทีละ 1 คิว จึงมีได้แค่ 1 การจองต่อเวลาเริ่ม)
 * ใช้กันจองซ้ำเมื่อ LINE ส่ง event ซ้ำ หรือ eve retry step ของ tool
 * Google ใช้ตัวอักษร base32hex (a-v, 0-9) ได้ hex จึงใช้ได้
 */
export function bookingEventId(calendarId: string, startMs: number): string {
  return createHash("sha256").update(`${calendarId}|${startMs}`).digest("hex").slice(0, 40);
}

export interface BookingInput {
  serviceId: ServiceId;
  startMs: number;
  nickname: string;
  phone: string;
}

export type BookingResult =
  | { status: "booked"; eventId: string; alreadyBooked: boolean }
  | { status: "conflict" };

function httpStatus(err: unknown): number | undefined {
  const e = err as { status?: number; code?: number | string };
  return e.status ?? (typeof e.code === "number" ? e.code : undefined);
}

/** สร้าง event การจองคิว ถ้าเวลานั้นถูกจองไปแล้วคืน conflict */
export async function createBooking(input: BookingInput): Promise<BookingResult> {
  const { api, calendarId } = getCalendar();
  const service = SERVICES[input.serviceId];
  const endMs = input.startMs + service.minutes * 60_000;
  const eventId = bookingEventId(calendarId, input.startMs);

  const requestBody: calendar_v3.Schema$Event = {
    id: eventId,
    status: "confirmed",
    summary: `${service.label} - ${input.nickname}`,
    description: [
      `บริการ: ${service.label} (${service.minutes} นาที)`,
      `ชื่อเล่น: ${input.nickname}`,
      `เบอร์โทร: ${input.phone}`,
      "จองผ่าน LINE (AI agent)",
    ].join("\n"),
    start: { dateTime: new Date(input.startMs).toISOString(), timeZone: "Asia/Bangkok" },
    end: { dateTime: new Date(endMs).toISOString(), timeZone: "Asia/Bangkok" },
    extendedProperties: {
      private: { source: EVENT_SOURCE, service: input.serviceId, phone: input.phone },
    },
  };

  try {
    await api.events.insert({ calendarId, requestBody });
    return { status: "booked", eventId, alreadyBooked: false };
  } catch (err) {
    if (httpStatus(err) !== 409) throw err;
  }

  // id นี้มีอยู่แล้ว: อาจเป็นคำขอเดิมที่ถูกส่งซ้ำ การจองของคนอื่น หรือ event ที่เคยถูกลบ
  const existing = (await api.events.get({ calendarId, eventId })).data;
  if (existing.status === "cancelled") {
    // Google เก็บ id ของ event ที่ถูกลบไว้ จึงต้อง update แทน insert
    await api.events.update({ calendarId, eventId, requestBody });
    return { status: "booked", eventId, alreadyBooked: false };
  }
  if (existing.extendedProperties?.private?.phone === input.phone) {
    return { status: "booked", eventId, alreadyBooked: true };
  }
  return { status: "conflict" };
}
