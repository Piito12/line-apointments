// ตรวจข้อมูลการจองที่ใช้ร่วมกันระหว่าง review_booking (ตรวจก่อนยืนยัน) และ book_appointment (จองจริง)

import { z } from "zod";

import { CalendarNotConfiguredError, bookingEventId } from "./calendar";
import { ANY_STAFF, ConfigUnavailableError, findService, type BusinessConfig, type Service } from "./config";
import { getDayCalendar } from "./holidays";
import {
  DATE_PATTERN,
  TIME_PATTERN,
  dateRangeToMs,
  localToMs,
  msToLocal,
  thaiWeekdayOf,
  validateBookingStart,
} from "./slots";
import { chooseProvider, pickProviders, readProvidersBusy, type Provider } from "./staff";

export const bookingInputSchema = z.object({
  service: z.string().trim().min(1).describe("id ของบริการ จากรายการบริการในข้อมูลร้าน"),
  staff: z
    .string()
    .trim()
    .optional()
    .describe(`id ของผู้ให้บริการ หรือ "${ANY_STAFF}" = ใครก็ได้ที่ว่าง (ร้านที่ไม่แยกผู้ให้บริการไม่ต้องใส่)`),
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

export function unknownServiceResult(config: BusinessConfig, id: string) {
  return {
    ok: false as const,
    reason: "unknown_service" as const,
    message: `ไม่มีบริการ id "${id}" ใช้ id จากรายการนี้เท่านั้น: ${config.services.map((s) => s.id).join(", ")}`,
  };
}

export type BookingCheck =
  | {
      ok: false;
      reason: "invalid_phone" | "invalid_time" | "slot_taken" | "unknown_service" | "unknown_staff";
      message: string;
    }
  | {
      ok: true;
      service: Service;
      /** คนที่ได้รับคิวนี้ (ถ้าลูกค้าเลือกใครก็ได้ ระบบเลือกให้แล้ว) */
      provider: Provider;
      /** สิ่งที่ลูกค้าขอ: id ของคน / "any" / "" (ร้านไม่แยกผู้ให้บริการ) */
      requestedStaff: string;
      startMs: number;
      endMs: number;
      phoneDigits: string;
    };

/**
 * ตรวจบริการ ผู้ให้บริการ เบอร์ กฎของร้าน และเช็คว่าเวลายังว่างใน calendar
 * ถ้าลูกค้าเลือกใครก็ได้ เลือกคนที่ว่างและมีคิวน้อยสุดในวันนั้น
 * ไม่นับ event การจองเดิมของลูกค้าคนนี้ เพื่อให้คำขอที่ถูกส่งซ้ำได้ผลเดิม
 * (อาจ throw CalendarNotConfiguredError หรือ error จาก Google ให้ tool จัดการ)
 */
export async function checkBooking(
  config: BusinessConfig,
  req: BookingRequest,
  /** id ของคนที่ไม่ต้องพิจารณา (เช่น calendar ของคนนั้นเขียนไม่ได้) ใช้เฉพาะตอนลูกค้าเลือกใครก็ได้ */
  skipStaff: ReadonlySet<string> = new Set(),
): Promise<BookingCheck> {
  const service = findService(config, req.service);
  if (!service) return unknownServiceResult(config, req.service);

  const phoneDigits = normalizePhone(req.phone);
  if (!phoneDigits) {
    return { ok: false, reason: "invalid_phone", message: "เบอร์โทรไม่ถูกต้อง ต้องเป็นเบอร์ไทย 9–10 หลักขึ้นต้นด้วย 0" };
  }

  const invalid = validateBookingStart(config.rules, service, req.date, req.time, Date.now(), await getDayCalendar(config));
  if (invalid) return { ok: false, reason: "invalid_time", message: invalid };

  const pick = pickProviders(config, service, req.staff);
  if (!pick.ok) return pick;
  const providers = pick.providers.filter((p) => !skipStaff.has(p.id));
  if (providers.length === 0) return { ok: false, reason: "slot_taken", message: SLOT_TAKEN_MESSAGE };

  const startMs = localToMs(req.date, req.time);
  const endMs = startMs + service.minutes * 60_000;
  // อ่านทั้งวัน: ใช้ทั้งเช็คว่าเวลานี้ว่าง และนับคิวของแต่ละคนในวันนั้น
  const { timeMin, timeMax } = dateRangeToMs(req.date, req.date);
  const busy = await readProvidersBusy(providers, timeMin, timeMax, (p) => ({
    eventId: bookingEventId(p.calendarId, startMs),
    phone: phoneDigits,
  }));
  const free = busy.filter((b) => !b.busy.some((i) => startMs < i.endMs && i.startMs < endMs));
  if (free.length === 0) return { ok: false, reason: "slot_taken", message: SLOT_TAKEN_MESSAGE };

  return {
    ok: true,
    service,
    provider: chooseProvider(free).provider,
    requestedStaff: pick.requested,
    startMs,
    endMs,
    phoneDigits,
  };
}

/** รายละเอียดการจองสำหรับส่งกลับให้โมเดลและใช้สร้างการ์ด (เบอร์ถูกซ่อนบางส่วน) */
export interface BookingDetails {
  businessName: string;
  contact: string;
  serviceId: string;
  service: string;
  /** id ของผู้ให้บริการที่ได้คิว ("" = ร้านไม่แยกผู้ให้บริการ) */
  staffId: string;
  staffName: string;
  date: string;
  weekday: string;
  time: string;
  endTime: string;
  durationMinutes: number;
  nickname: string;
  phoneMasked: string;
}

export function bookingDetails(
  config: BusinessConfig,
  req: BookingRequest,
  check: Extract<BookingCheck, { ok: true }>,
): BookingDetails {
  return {
    businessName: config.businessName,
    contact: config.contact,
    serviceId: check.service.id,
    service: check.service.name,
    staffId: check.provider.id,
    staffName: check.provider.name,
    date: req.date,
    weekday: thaiWeekdayOf(req.date),
    time: req.time,
    endTime: msToLocal(check.endMs).time,
    durationMinutes: check.service.minutes,
    nickname: req.nickname,
    phoneMasked: maskPhone(check.phoneDigits),
  };
}

/**
 * แปลง error ที่เกิดใน tool เป็นผลลัพธ์ ok: false ให้โมเดลบอกลูกค้าได้
 * (error ที่ไม่รู้จักเขียน log ไว้ดูภายหลัง ไม่ส่งรายละเอียดทางเทคนิคให้โมเดล)
 */
export function toolErrorResult(tool: string, err: unknown, failMessage: string) {
  if (err instanceof ConfigUnavailableError) {
    console.error(`[${tool}]`, err.message);
    return { ok: false as const, reason: "config_unavailable" as const, message: "โหลดข้อมูลร้านไม่สำเร็จ ระบบยังไม่พร้อมใช้งาน" };
  }
  if (err instanceof CalendarNotConfiguredError) {
    return { ok: false as const, reason: "calendar_not_configured" as const, message: "ระบบตารางนัดยังไม่พร้อมใช้งาน" };
  }
  console.error(`[${tool}] calendar error`, err);
  return { ok: false as const, reason: "calendar_error" as const, message: failMessage };
}
