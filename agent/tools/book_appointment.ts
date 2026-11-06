import { defineTool } from "eve/tools";

import { createBooking } from "../lib/calendar";
import { SLOT_TAKEN_MESSAGE, bookingDetails, bookingInputSchema, checkBooking, toolErrorResult } from "../lib/booking";
import { getConfig } from "../lib/config";

export default defineTool({
  description:
    "จองคิวลง Google Calendar ของร้าน เรียกได้ก็ต่อเมื่อลูกค้ายืนยันรายละเอียดจาก review_booking แล้วเท่านั้น " +
    "ใช้ข้อมูลชุดเดียวกับที่ส่งให้ review_booking ถ้าผลเป็น ok: false ห้ามบอกลูกค้าว่าจองสำเร็จ",
  inputSchema: bookingInputSchema,
  label: {
    start: ({ service, date, time }) => `จองคิว ${service} ${date} ${time}`,
  },
  async execute(req) {
    try {
      const config = await getConfig();
      // ตรวจซ้ำทั้งหมดก่อนจอง: เวลาอาจถูกจองไปแล้วหลังจากที่ลูกค้าดูสรุป
      const check = await checkBooking(config, req);
      if (!check.ok) return check;

      const result = await createBooking({
        service: check.service,
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
        ...bookingDetails(config, req, check),
      };
    } catch (err) {
      return toolErrorResult("book_appointment", err, "จองคิวไม่สำเร็จ");
    }
  },
});
