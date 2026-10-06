import { defineTool } from "eve/tools";

import { SERVICES } from "../lib/clinic";
import { CalendarNotConfiguredError } from "../lib/calendar";
import { bookingDetails, bookingInputSchema, checkBooking } from "../lib/booking";

// ตรวจรายละเอียดการจองก่อนให้ลูกค้ายืนยัน: ไม่เขียนอะไรลง calendar
// ใน LINE ผลของ tool นี้จะแสดงเป็นการ์ดสรุปพร้อมปุ่ม "ยืนยันการจอง"
export default defineTool({
  description:
    "ตรวจรายละเอียดการจอง (บริการ วัน เวลา ชื่อเล่น เบอร์โทร) และเช็คว่าเวลายังว่าง ก่อนให้ลูกค้ายืนยัน " +
    "เรียกเมื่อได้ข้อมูลครบแล้ว แทนการพิมพ์สรุปเอง ยังไม่จองจริง ต้องรอลูกค้ายืนยันแล้วค่อยเรียก book_appointment",
  inputSchema: bookingInputSchema,
  label: {
    start: ({ service, date, time }) => `ตรวจรายละเอียดการจอง ${SERVICES[service].label} ${date} ${time}`,
  },
  async execute(req) {
    try {
      const check = await checkBooking(req);
      if (!check.ok) return check;
      return { ok: true, readyToBook: true, ...bookingDetails(req, check) };
    } catch (err) {
      if (err instanceof CalendarNotConfiguredError) {
        return { ok: false, reason: "calendar_not_configured", message: "ระบบตารางนัดยังไม่พร้อมใช้งาน" };
      }
      console.error("[review_booking] calendar error", err);
      return { ok: false, reason: "calendar_error", message: "ตรวจสอบการจองไม่สำเร็จ" };
    }
  },
});
