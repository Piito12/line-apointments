// ตรวจข้อมูลการจองที่ใช้ร่วมกันระหว่าง review_booking (ตรวจก่อนยืนยัน) และ book_appointment (จองจริง)

import { z } from "zod";

import { SERVICE_IDS, SERVICES, type ServiceId } from "./clinic";
import { bookingEventId, getCalendarId, listBusyIntervals } from "./calendar";
import { DATE_PATTERN, TIME_PATTERN, localToMs, msToLocal, thaiWeekdayOf, validateBookingStart } from "./slots";

export const bookingInputSchema = z.object({
  service: z.enum(SERVICE_IDS),
  date: z.string().regex(DATE_PATTERN).describe("วันที่นัด YYYY-MM-DD (เวลาไทย)"),
  time: z.string().regex(TIME_PATTERN).describe("เวลาเริ่ม HH:mm (เวลาไทย)"),
  nickname: z.string().trim().min(1).max(50).describe("ชื่อเล่นของลูกค้า"),
  phone: z.string().trim().min(9).max(15).describe("เบอร์โทรของลูกค้า"),
});

export type BookingRequest = z.infer<typeof bookingInputSchema>;

/** เบอร์โทรไทย: ตัดขีดและช่องว่างออก ต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  return /^0\d{8,9}$/.test(digits) ? digits : null;
}

/** ซ่อนเบอร์บางส่วนเวลาแสดงกลับในแชท เช่น 0812345678 → 081-xxx-5678 */
export function maskPhone(digits: string): string {
  return `${digits.slice(0, 3)}-xxx-${digits.slice(-4)}`;
}

export const SLOT_TAKEN_MESSAGE = "เวลานี้ถูกจองไปแล้ว ให้เสนอเวลาอื่นจาก get_available_slots";

export type BookingCheck =
  | { ok: false; reason: "invalid_phone" | "invalid_time" | "slot_taken"; message: string }
  | { ok: true; serviceId: ServiceId; startMs: number; endMs: number; phoneDigits: string };

/**
 * ตรวจเบอร์ ตรวจกฎของคลินิก และเช็คว่าเวลายังว่างใน calendar
 * ไม่นับ event ที่มี id ของการจองนี้เอง เพื่อให้คำขอที่ถูกส่งซ้ำได้ผลเดิม
 * (อาจ throw CalendarNotConfiguredError หรือ error จาก Google ให้ tool จัดการ)
 */
export async function checkBooking(req: BookingRequest): Promise<BookingCheck> {
  const phoneDigits = normalizePhone(req.phone);
  if (!phoneDigits) {
    return { ok: false, reason: "invalid_phone", message: "เบอร์โทรไม่ถูกต้อง ต้องเป็นเบอร์ไทย 9–10 หลักขึ้นต้นด้วย 0" };
  }

  const invalid = validateBookingStart(req.service, req.date, req.time, Date.now());
  if (invalid) return { ok: false, reason: "invalid_time", message: invalid };

  const startMs = localToMs(req.date, req.time);
  const endMs = startMs + SERVICES[req.service].minutes * 60_000;
  const busy = await listBusyIntervals(startMs, endMs, bookingEventId(getCalendarId(), startMs));
  if (busy.some((b) => startMs < b.endMs && b.startMs < endMs)) {
    return { ok: false, reason: "slot_taken", message: SLOT_TAKEN_MESSAGE };
  }
  return { ok: true, serviceId: req.service, startMs, endMs, phoneDigits };
}

/** รายละเอียดการจองสำหรับส่งกลับให้โมเดลและใช้สร้างการ์ด (เบอร์ถูกซ่อนบางส่วน) */
export interface BookingDetails {
  serviceId: ServiceId;
  service: string;
  date: string;
  weekday: string;
  time: string;
  endTime: string;
  durationMinutes: number;
  nickname: string;
  phoneMasked: string;
}

export function bookingDetails(req: BookingRequest, check: Extract<BookingCheck, { ok: true }>): BookingDetails {
  return {
    serviceId: req.service,
    service: SERVICES[req.service].label,
    date: req.date,
    weekday: thaiWeekdayOf(req.date),
    time: req.time,
    endTime: msToLocal(check.endMs).time,
    durationMinutes: SERVICES[req.service].minutes,
    nickname: req.nickname,
    phoneMasked: maskPhone(check.phoneDigits),
  };
}
