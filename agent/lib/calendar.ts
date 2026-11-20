// เชื่อม Google Calendar ด้วย Service Account (ดู google.ts)
//
// env ที่ต้องมีใน .env.local:
//   GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY (หรือ GOOGLE_SERVICE_ACCOUNT_KEY แบบเดิม) ดู ./google.ts
//   GOOGLE_CALENDAR_ID          calendar ของร้าน ที่ share ให้ service account ด้วยสิทธิ์ "Make changes to events"
//                                 - ร้านไม่แยกผู้ให้บริการ (ไม่มีแท็บ staff): รับจองและเช็คเวลาว่างจาก calendar นี้
//                                 - ร้านแยกผู้ให้บริการ: เป็น calendar รวม เก็บสำเนาการจองให้เจ้าของดูภาพรวม
//                                   (ไม่ใช้เช็คเวลาว่าง) ไม่ใส่ก็ได้
// calendar ของแต่ละคนอยู่ในแท็บ staff ของ Google Sheet (ดู config-schema.ts)

import { createHash } from "node:crypto";

import { calendar, type calendar_v3 } from "@googleapis/calendar";

import { GoogleNotConfiguredError, getServiceAccount } from "./google";
import { addDays, localToMs, type BusyInterval } from "./slots";

const EVENT_SOURCE = "clinic-appointment-agent";

/** ยังไม่ได้ตั้งค่า Google (key หรือ calendar id) ใช้ class เดียวกับ google.ts เพื่อให้ tool เช็คที่เดียว */
export { GoogleNotConfiguredError as CalendarNotConfiguredError };

let cachedApi: calendar_v3.Calendar | undefined;

function getApi(): calendar_v3.Calendar {
  cachedApi ??= calendar({ version: "v3", auth: getServiceAccount() });
  return cachedApi;
}

/** calendar ของร้าน (GOOGLE_CALENDAR_ID) ถ้าตั้งไว้ */
export function shopCalendarId(): string | undefined {
  return process.env.GOOGLE_CALENDAR_ID?.trim() || undefined;
}

export function requireShopCalendarId(): string {
  const id = shopCalendarId();
  if (!id) throw new GoogleNotConfiguredError(["GOOGLE_CALENDAR_ID"]);
  return id;
}

function eventTimeToMs(t: calendar_v3.Schema$EventDateTime | undefined): number | null {
  if (t?.dateTime) return Date.parse(t.dateTime);
  if (t?.date) return localToMs(t.date, "00:00"); // event ทั้งวัน
  return null;
}

/** event การจองของลูกค้าคนนี้เอง: ไม่นับว่าชน เพื่อให้คำขอเดิมที่ถูกส่งซ้ำได้ผลเดิม */
export interface OwnBooking {
  eventId: string;
  phone: string;
}

export interface BusyResult {
  busy: BusyInterval[];
  /** เจอ event การจองเดิมของลูกค้าคนนี้ (ตาม own) ใน calendar นี้ */
  hasOwnBooking: boolean;
}

/**
 * ช่วงเวลาที่ไม่ว่างทั้งหมดใน calendar ระหว่าง timeMin ถึง timeMax
 * own: event ที่ id และเบอร์ตรงกันจะไม่นับ (event id เดียวกันแต่เบอร์อื่น = คนอื่นจองไปแล้ว ยังนับว่าชน)
 */
export async function listBusyIntervals(
  calendarId: string,
  timeMin: number,
  timeMax: number,
  own?: OwnBooking,
): Promise<BusyResult> {
  const api = getApi();
  const busy: BusyInterval[] = [];
  let hasOwnBooking = false;
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
      if (own && ev.id === own.eventId && ev.extendedProperties?.private?.phone === own.phone) {
        hasOwnBooking = true;
        continue;
      }
      const startMs = eventTimeToMs(ev.start);
      const endMs = eventTimeToMs(ev.end);
      if (startMs !== null && endMs !== null) busy.push({ startMs, endMs });
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return { busy, hasOwnBooking };
}

/** calendar วันหยุดของ Google ปน "วันสำคัญ" (เช่น วาเลนไทน์ ตรุษจีน) ที่ไม่ใช่วันหยุดมาด้วย ดูได้จาก description */
const OBSERVANCE = /วันสำคัญ|observance/i;

/**
 * วันหยุด (event ทั้งวัน) ใน calendar ระหว่าง fromDate ถึง toDate (YYYY-MM-DD รวมทั้งสองวัน) → วันที่ → ชื่อวันหยุด
 * calendar วันหยุดของ Google จะตัดวันสำคัญออก calendar ที่ร้านสร้างเองนับทุก event
 */
export async function listHolidayDates(calendarId: string, fromDate: string, toDate: string): Promise<Map<string, string>> {
  const api = getApi();
  const isGoogleHolidays = calendarId.endsWith("#holiday@group.v.calendar.google.com");
  const out = new Map<string, string>();
  let pageToken: string | undefined;
  do {
    const res = await api.events.list({
      calendarId,
      timeMin: new Date(localToMs(fromDate, "00:00")).toISOString(),
      timeMax: new Date(localToMs(addDays(toDate, 1), "00:00")).toISOString(),
      singleEvents: true,
      maxResults: 2500,
      pageToken,
    });
    for (const ev of res.data.items ?? []) {
      if (ev.status === "cancelled" || !ev.start?.date || !ev.end?.date) continue; // นับเฉพาะ event ทั้งวัน
      if (isGoogleHolidays && OBSERVANCE.test(ev.description ?? "")) continue;
      const name = (ev.summary ?? "").replace(/​/g, "").trim() || "วันหยุด";
      // end.date ของ event ทั้งวันเป็นวันถัดจากวันสุดท้าย (exclusive)
      for (let d = ev.start.date; d < ev.end.date; d = addDays(d, 1)) {
        if (!out.has(d)) out.set(d, name);
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

function hashId(parts: (string | number)[]): string {
  // Google ใช้ตัวอักษร base32hex (a-v, 0-9) ได้ hex จึงใช้ได้
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);
}

/**
 * event id ที่คำนวณจาก calendar + เวลาเริ่ม (1 calendar รับได้ 1 การจองต่อเวลาเริ่ม)
 * ใช้กันจองซ้ำเมื่อ LINE ส่ง event ซ้ำ หรือ eve retry step ของ tool
 * ผู้ให้บริการคนละคนใช้คนละ calendar จึงรับคิวเวลาเดียวกันได้
 */
export function bookingEventId(calendarId: string, startMs: number): string {
  return hashId([calendarId, startMs]);
}

export interface BookingInput {
  service: { id: string; name: string; minutes: number };
  startMs: number;
  nickname: string;
  phone: string;
  /** ผู้ให้บริการ (ไม่มี = ร้านไม่แยกผู้ให้บริการ) */
  staff?: { id: string; name: string };
}

export type BookingResult =
  | { status: "booked"; eventId: string; alreadyBooked: boolean }
  | { status: "conflict" };

function httpStatus(err: unknown): number | undefined {
  const e = err as { status?: number; code?: number | string };
  return e.status ?? (typeof e.code === "number" ? e.code : undefined);
}

/** service account ไม่มีสิทธิ์เขียน calendar นี้ (403) หรือมองไม่เห็น/ถูกลบ (404) */
export function isCalendarAccessError(err: unknown): boolean {
  const status = httpStatus(err);
  return status === 403 || status === 404;
}

function eventBody(id: string, input: BookingInput): calendar_v3.Schema$Event {
  const { service, staff } = input;
  const endMs = input.startMs + service.minutes * 60_000;
  return {
    id,
    status: "confirmed",
    summary: [service.name, staff?.name, input.nickname].filter(Boolean).join(" - "),
    description: [
      `บริการ: ${service.name} (${service.minutes} นาที)`,
      ...(staff ? [`ผู้ให้บริการ: ${staff.name}`] : []),
      `ชื่อเล่น: ${input.nickname}`,
      `เบอร์โทร: ${input.phone}`,
      "จองผ่าน LINE (AI agent)",
    ].join("\n"),
    start: { dateTime: new Date(input.startMs).toISOString(), timeZone: "Asia/Bangkok" },
    end: { dateTime: new Date(endMs).toISOString(), timeZone: "Asia/Bangkok" },
    extendedProperties: {
      private: {
        source: EVENT_SOURCE,
        service: service.id,
        phone: input.phone,
        ...(staff ? { staff: staff.id } : {}),
      },
    },
  };
}

/** สร้าง event การจองคิวใน calendar ที่ระบุ ถ้าเวลานั้นถูกจองไปแล้วคืน conflict */
export async function createBooking(calendarId: string, input: BookingInput): Promise<BookingResult> {
  const api = getApi();
  const eventId = bookingEventId(calendarId, input.startMs);
  const requestBody = eventBody(eventId, input);

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

/**
 * สำเนาการจองลง calendar รวมของร้าน (เฉพาะร้านที่แยกผู้ให้บริการ)
 * id รวม staff ด้วย เพื่อให้คิวเวลาเดียวกันของคนละคนไม่ทับกัน ถ้ามีอยู่แล้ว (ส่งซ้ำ/เคยถูกลบ) เขียนทับ
 */
export async function copyBookingToCalendar(calendarId: string, input: BookingInput & { staff: { id: string; name: string } }) {
  const api = getApi();
  const eventId = hashId([calendarId, input.staff.id, input.startMs]);
  const requestBody = eventBody(eventId, input);
  try {
    await api.events.insert({ calendarId, requestBody });
  } catch (err) {
    if (httpStatus(err) !== 409) throw err;
    await api.events.update({ calendarId, eventId, requestBody });
  }
}
