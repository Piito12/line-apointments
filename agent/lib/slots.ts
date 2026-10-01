// คำนวณเวลาว่างจากกฎของคลินิก + ช่วงเวลาที่ไม่ว่างจาก calendar
// ไฟล์นี้ไม่เรียก network เลย จึงทดสอบได้โดยไม่ต้องมี credential ของ Google
// วันที่และเวลาทั้งหมดในไฟล์นี้เป็นเวลาไทย (Asia/Bangkok) ในรูปแบบ "YYYY-MM-DD" และ "HH:mm"

import {
  BOOKING_WINDOW_DAYS,
  CLOSE_TIME,
  CLOSED_WEEKDAYS,
  MIN_LEAD_MINUTES,
  OPEN_TIME,
  SERVICES,
  SLOT_STEP_MINUTES,
  THAI_WEEKDAYS,
  UTC_OFFSET,
  UTC_OFFSET_MINUTES,
  type ServiceId,
} from "./clinic";

const MINUTE = 60_000;

export interface BusyInterval {
  startMs: number;
  endMs: number;
}

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** แปลงวันที่ + เวลาไทยเป็น epoch ms */
export function localToMs(date: string, time: string): number {
  return Date.parse(`${date}T${time}:00${UTC_OFFSET}`);
}

/** แปลง epoch ms เป็นวันที่ เวลา และวันในสัปดาห์ตามเวลาไทย */
export function msToLocal(ms: number): { date: string; time: string; weekday: number } {
  const d = new Date(ms + UTC_OFFSET_MINUTES * MINUTE);
  const iso = d.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ ของเวลาไทย
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), weekday: d.getUTCDay() };
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function thaiWeekdayOf(date: string): string {
  return THAI_WEEKDAYS[weekdayOf(date)];
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function timeOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** วันที่ถูกต้องจริงไหม (กัน 2026-02-31) */
export function isValidDate(date: string): boolean {
  return DATE_PATTERN.test(date) && addDays(date, 0) === date;
}

/** ช่วงวันที่ที่จองได้ ณ เวลา now */
export function bookingWindow(now: number): { firstDate: string; lastDate: string } {
  const firstDate = msToLocal(now).date;
  return { firstDate, lastDate: addDays(firstDate, BOOKING_WINDOW_DAYS - 1) };
}

/** ช่วงเวลาครอบคลุมวันที่ startDate ถึง endDate ทั้งวัน สำหรับดึง event จาก calendar */
export function dateRangeToMs(startDate: string, endDate: string): { timeMin: number; timeMax: number } {
  return { timeMin: localToMs(startDate, "00:00"), timeMax: localToMs(addDays(endDate, 1), "00:00") };
}

function overlapsBusy(startMs: number, endMs: number, busy: readonly BusyInterval[]): boolean {
  return busy.some((b) => startMs < b.endMs && b.startMs < endMs);
}

export interface AvailableDay {
  date: string;
  weekday: string;
  times: string[];
}

export interface SlotQuery {
  serviceId: ServiceId;
  startDate: string;
  endDate: string;
  busy: readonly BusyInterval[];
  now: number;
  /** เฉพาะคิวที่เริ่มตั้งแต่เวลานี้ (รวม) */
  timeFrom?: string;
  /** เฉพาะคิวที่เริ่มก่อนเวลานี้ */
  timeTo?: string;
}

export interface SlotResult {
  /** ช่วงวันที่ที่ใช้ค้นจริง หลังตัดให้อยู่ในช่วงที่จองได้ */
  searchedFrom: string | null;
  searchedTo: string | null;
  days: AvailableDay[];
  closedDates: string[];
  notes: string[];
}

/** หาเวลาเริ่มของคิวที่ว่างทั้งหมดในช่วงวันที่ที่ขอ */
export function computeAvailableSlots(q: SlotQuery): SlotResult {
  const duration = SERVICES[q.serviceId].minutes;
  const { firstDate, lastDate } = bookingWindow(q.now);
  const notes: string[] = [];

  let from = q.startDate;
  let to = q.endDate < q.startDate ? q.startDate : q.endDate;
  if (from < firstDate) {
    from = firstDate;
    notes.push(`ตัดวันที่ที่ผ่านไปแล้วออก เริ่มค้นจาก ${firstDate}`);
  }
  if (to > lastDate) {
    to = lastDate;
    notes.push(`จองล่วงหน้าได้ไม่เกิน ${BOOKING_WINDOW_DAYS} วัน ค้นถึง ${lastDate}`);
  }
  if (from > to) {
    return { searchedFrom: null, searchedTo: null, days: [], closedDates: [], notes: [...notes, "ช่วงวันที่ที่ขออยู่นอกช่วงที่จองได้"] };
  }

  const open = minutesOf(OPEN_TIME);
  const close = minutesOf(CLOSE_TIME);
  const earliestStart = q.now + MIN_LEAD_MINUTES * MINUTE;
  const days: AvailableDay[] = [];
  const closedDates: string[] = [];

  for (let date = from; date <= to; date = addDays(date, 1)) {
    const weekday = weekdayOf(date);
    if (CLOSED_WEEKDAYS.includes(weekday)) {
      closedDates.push(date);
      continue;
    }
    const times: string[] = [];
    for (let m = open; m + duration <= close; m += SLOT_STEP_MINUTES) {
      const time = timeOf(m);
      if (q.timeFrom && time < q.timeFrom) continue;
      if (q.timeTo && time >= q.timeTo) continue;
      const startMs = localToMs(date, time);
      if (startMs < earliestStart) continue;
      if (overlapsBusy(startMs, startMs + duration * MINUTE, q.busy)) continue;
      times.push(time);
    }
    days.push({ date, weekday: THAI_WEEKDAYS[weekday], times });
  }

  return { searchedFrom: from, searchedTo: to, days, closedDates, notes };
}

/** ตรวจว่าเวลาเริ่มที่ขอจองเป็นไปตามกฎของคลินิกไหม คืนข้อความเหตุผลถ้าไม่ผ่าน */
export function validateBookingStart(serviceId: ServiceId, date: string, time: string, now: number): string | null {
  if (!isValidDate(date)) return `วันที่ ${date} ไม่ถูกต้อง`;
  if (!TIME_PATTERN.test(time)) return `เวลา ${time} ไม่ถูกต้อง`;

  const { firstDate, lastDate } = bookingWindow(now);
  if (date < firstDate || date > lastDate) return `จองได้เฉพาะวันที่ ${firstDate} ถึง ${lastDate}`;
  if (CLOSED_WEEKDAYS.includes(weekdayOf(date))) return `วัน${THAI_WEEKDAYS[weekdayOf(date)]}คลินิกปิด`;

  const start = minutesOf(time);
  const duration = SERVICES[serviceId].minutes;
  if (start < minutesOf(OPEN_TIME) || start + duration > minutesOf(CLOSE_TIME)) {
    return `คิว ${SERVICES[serviceId].label} (${duration} นาที) ต้องอยู่ในเวลาทำการ ${OPEN_TIME}–${CLOSE_TIME}`;
  }
  if ((start - minutesOf(OPEN_TIME)) % SLOT_STEP_MINUTES !== 0) {
    return `เวลาเริ่มต้องลงทุกๆ ${SLOT_STEP_MINUTES} นาที เช่น 10:00, 10:30`;
  }
  if (localToMs(date, time) < now + MIN_LEAD_MINUTES * MINUTE) {
    return `ต้องจองล่วงหน้าอย่างน้อย ${MIN_LEAD_MINUTES} นาที`;
  }
  return null;
}
