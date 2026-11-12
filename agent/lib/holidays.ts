// วันปิด/เปิดของร้านรายวัน: วันหยุดจาก calendar (settings.holiday_calendar) + ข้อยกเว้นในแท็บ closures
//
// วันหยุดดึงครั้งเดียวครอบคลุมทั้งช่วงที่จองได้ แล้ว cache ไว้ HOLIDAY_TTL_MS (วันหยุดแทบไม่เปลี่ยน)
// ถ้าดึงไม่ได้ (API ล่ม / ไม่มีสิทธิ์) จะรับจองต่อโดยไม่ปิดตามวันหยุด และเขียน log
// (ใช้ค่าที่ดึงสำเร็จล่าสุดถ้ามี) ข้อยกเว้นจากแท็บ closures และวันปิดประจำสัปดาห์ยังมีผลตามปกติ

import { listHolidayDates } from "./calendar";
import type { BusinessConfig } from "./config-schema";
import { addDays, msToLocal, type DayCalendar } from "./slots";

const HOLIDAY_TTL_MS = 6 * 60 * 60_000;
/** ดึงไม่สำเร็จ: รอเท่านี้ก่อนลองใหม่ จะได้ไม่ยิง API ทุกข้อความระหว่างที่มีปัญหา */
const RETRY_AFTER_FAIL_MS = 10 * 60_000;
/** ดึงล่วงหน้ากี่วัน (ครอบคลุม booking_window_days สูงสุด 365) */
const RANGE_DAYS = 400;

interface CacheEntry {
  holidays: Map<string, string>;
  fromDate: string;
  toDate: string;
  /** เวลาที่ควรดึงใหม่ */
  refreshAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Map<string, string>>>();

async function load(calendarId: string, today: string): Promise<Map<string, string>> {
  const prev = cache.get(calendarId);
  const toDate = addDays(today, RANGE_DAYS);
  try {
    const holidays = await listHolidayDates(calendarId, today, toDate);
    cache.set(calendarId, { holidays, fromDate: today, toDate, refreshAt: Date.now() + HOLIDAY_TTL_MS });
    return holidays;
  } catch (err) {
    console.error(`[holidays] load holiday calendar "${calendarId}" failed, accepting bookings on holidays for now`, err);
    const holidays = prev?.holidays ?? new Map<string, string>();
    cache.set(calendarId, {
      holidays,
      fromDate: prev?.fromDate ?? today,
      toDate: prev?.toDate ?? toDate,
      refreshAt: Date.now() + RETRY_AFTER_FAIL_MS,
    });
    return holidays;
  }
}

/** วันหยุดใน calendar นี้ (วันที่ → ชื่อ) ไม่ throw: ดึงไม่ได้คืนค่าเดิมหรือว่าง */
export async function getHolidays(calendarId: string): Promise<ReadonlyMap<string, string>> {
  const today = msToLocal(Date.now()).date;
  const entry = cache.get(calendarId);
  if (entry && Date.now() < entry.refreshAt && entry.fromDate <= today) return entry.holidays;

  let p = inflight.get(calendarId);
  if (!p) {
    p = load(calendarId, today).finally(() => inflight.delete(calendarId));
    inflight.set(calendarId, p);
  }
  return p;
}

/** วันหยุด + ข้อยกเว้นของร้าน สำหรับส่งให้ computeAvailableSlots / validateBookingStart */
export async function getDayCalendar(config: BusinessConfig): Promise<DayCalendar> {
  return {
    overrides: new Map(config.dateOverrides.map((o) => [o.date, o])),
    holidays: config.holidayCalendarId ? await getHolidays(config.holidayCalendarId) : new Map(),
  };
}
