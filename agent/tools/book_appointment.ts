import { defineTool } from "eve/tools";
import { z } from "zod";

import { SERVICE_IDS, SERVICES } from "../lib/clinic";
import {
  CalendarNotConfiguredError,
  bookingEventId,
  createBooking,
  getCalendarId,
  listBusyIntervals,
} from "../lib/calendar";
import { DATE_PATTERN, TIME_PATTERN, thaiWeekdayOf, localToMs, validateBookingStart } from "../lib/slots";

/** เบอร์โทรไทย: ตัดขีดและช่องว่างออก ต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  return /^0\d{8,9}$/.test(digits) ? digits : null;
}

export default defineTool({
  description:
    "จองคิวลง Google Calendar ของคลินิก เรียกได้ก็ต่อเมื่อลูกค้ายืนยันบริการ วัน เวลา ชื่อเล่น และเบอร์โทรแล้วเท่านั้น " +
    "เวลาต้องเป็นเวลาที่ได้จาก get_available_slots ถ้าผลเป็น ok: false ห้ามบอกลูกค้าว่าจองสำเร็จ",
  inputSchema: z.object({
    service: z.enum(SERVICE_IDS),
    date: z.string().regex(DATE_PATTERN).describe("วันที่นัด YYYY-MM-DD (เวลาไทย)"),
    time: z.string().regex(TIME_PATTERN).describe("เวลาเริ่ม HH:mm (เวลาไทย)"),
    nickname: z.string().trim().min(1).max(50).describe("ชื่อเล่นของลูกค้า"),
    phone: z.string().trim().min(9).max(15).describe("เบอร์โทรของลูกค้า"),
  }),
  label: {
    start: ({ service, date, time }) => `จองคิว ${SERVICES[service].label} ${date} ${time}`,
  },
  async execute({ service, date, time, nickname, phone }) {
    const phoneDigits = normalizePhone(phone);
    if (!phoneDigits) {
      return { ok: false, reason: "invalid_phone", message: "เบอร์โทรไม่ถูกต้อง ต้องเป็นเบอร์ไทย 9–10 หลักขึ้นต้นด้วย 0" };
    }

    const invalid = validateBookingStart(service, date, time, Date.now());
    if (invalid) return { ok: false, reason: "invalid_time", message: invalid };

    const startMs = localToMs(date, time);
    const endMs = startMs + SERVICES[service].minutes * 60_000;

    try {
      // เช็คอีกรอบก่อนจอง: เวลาอาจถูกจองไปแล้วหลังจากที่ลูกค้าดูเวลาว่าง
      // ไม่นับ event ของคำขอนี้เอง เพื่อให้คำขอที่ถูกส่งซ้ำได้ผลเดิม
      const ownId = bookingEventId(getCalendarId(), startMs);
      const busy = await listBusyIntervals(startMs, endMs, ownId);
      if (busy.some((b) => startMs < b.endMs && b.startMs < endMs)) {
        return { ok: false, reason: "slot_taken", message: "เวลานี้ถูกจองไปแล้ว ให้เสนอเวลาอื่นจาก get_available_slots" };
      }

      const result = await createBooking({ serviceId: service, startMs, nickname, phone: phoneDigits });
      if (result.status === "conflict") {
        return { ok: false, reason: "slot_taken", message: "เวลานี้ถูกจองไปแล้ว ให้เสนอเวลาอื่นจาก get_available_slots" };
      }
      return {
        ok: true,
        bookingId: result.eventId,
        alreadyBooked: result.alreadyBooked,
        service: SERVICES[service].label,
        date,
        weekday: thaiWeekdayOf(date),
        time,
        durationMinutes: SERVICES[service].minutes,
        nickname,
      };
    } catch (err) {
      if (err instanceof CalendarNotConfiguredError) {
        return { ok: false, reason: "calendar_not_configured", message: "ระบบตารางนัดยังไม่พร้อมใช้งาน" };
      }
      console.error("[book_appointment] calendar error", err);
      return { ok: false, reason: "calendar_error", message: "จองคิวไม่สำเร็จ" };
    }
  },
});
