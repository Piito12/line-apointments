import { defineTool } from "eve/tools";

import { SERVICES } from "../lib/clinic";
import { CalendarNotConfiguredError, createBooking } from "../lib/calendar";
import { SLOT_TAKEN_MESSAGE, bookingDetails, bookingInputSchema, checkBooking } from "../lib/booking";

export default defineTool({
  description:
    "จองคิวลง Google Calendar ของคลินิก เรียกได้ก็ต่อเมื่อลูกค้ายืนยันรายละเอียดจาก review_booking แล้วเท่านั้น " +
    "ใช้ข้อมูลชุดเดียวกับที่ส่งให้ review_booking ถ้าผลเป็น ok: false ห้ามบอกลูกค้าว่าจองสำเร็จ",
  inputSchema: bookingInputSchema,
  label: {
    start: ({ service, date, time }) => `จองคิว ${SERVICES[service].label} ${date} ${time}`,
  },
  async execute(req) {
    try {
      // ตรวจซ้ำทั้งหมดก่อนจอง: เวลาอาจถูกจองไปแล้วหลังจากที่ลูกค้าดูสรุป
      const check = await checkBooking(req);
      if (!check.ok) return check;

      const result = await createBooking({
        serviceId: check.serviceId,
        startMs: check.startMs,
        nickname: req.nickname,
        phone: check.phoneDigits,
      });
      if (result.status === "conflict") {
        return { ok: false, reason: "slot_taken", message: SLOT_TAKEN_MESSAGE };
      }
      return {
        ok: true,
        bookingId: result.eventId,
        alreadyBooked: result.alreadyBooked,
        ...bookingDetails(req, check),
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
