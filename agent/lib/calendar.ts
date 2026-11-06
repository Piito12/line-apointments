// เชื่อม Google Calendar ด้วย Service Account (ดู google.ts)
//
// env ที่ต้องมีใน .env.local:
//   GOOGLE_SERVICE_ACCOUNT_KEY  JSON ทั้งก้อนของ service account key (บรรทัดเดียว)
//   GOOGLE_CALENDAR_ID          id ของ calendar ที่ share ให้ service account
//                               ด้วยสิทธิ์ "Make changes to events"

import { createHash } from "node:crypto";

import { calendar, type calendar_v3 } from "@googleapis/calendar";

import { GoogleNotConfiguredError, getServiceAccount } from "./google";
import { localToMs, type BusyInterval } from "./slots";

const EVENT_SOURCE = "clinic-appointment-agent";

/** ยังไม่ได้ตั้งค่า Google (key หรือ calendar id) ใช้ class เดียวกับ google.ts เพื่อให้ tool เช็คที่เดียว */
export { GoogleNotConfiguredError as CalendarNotConfiguredError };

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

  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const missing = [
    ...(process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? [] : ["GOOGLE_SERVICE_ACCOUNT_KEY"]),
    ...(calendarId ? [] : ["GOOGLE_CALENDAR_ID"]),
  ];
  if (missing.length > 0 || !calendarId) throw new GoogleNotConfiguredError(missing);

  cached = { api: calendar({ version: "v3", auth: getServiceAccount() }), calendarId };
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
  service: { id: string; name: string; minutes: number };
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
  const { service } = input;
  const endMs = input.startMs + service.minutes * 60_000;
  const eventId = bookingEventId(calendarId, input.startMs);

  const requestBody: calendar_v3.Schema$Event = {
    id: eventId,
    status: "confirmed",
    summary: `${service.name} - ${input.nickname}`,
    description: [
      `บริการ: ${service.name} (${service.minutes} นาที)`,
      `ชื่อเล่น: ${input.nickname}`,
      `เบอร์โทร: ${input.phone}`,
      "จองผ่าน LINE (AI agent)",
    ].join("\n"),
    start: { dateTime: new Date(input.startMs).toISOString(), timeZone: "Asia/Bangkok" },
    end: { dateTime: new Date(endMs).toISOString(), timeZone: "Asia/Bangkok" },
    extendedProperties: {
      private: { source: EVENT_SOURCE, service: service.id, phone: input.phone },
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
