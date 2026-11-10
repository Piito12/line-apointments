import { defineTool } from "eve/tools";

import { bookingDetails, bookingInputSchema, checkBooking, toolErrorResult } from "../lib/booking";
import { getConfig } from "../lib/config";

// ตรวจรายละเอียดการจองก่อนให้ลูกค้ายืนยัน: ไม่เขียนอะไรลง calendar
// ใน LINE ผลของ tool นี้จะแสดงเป็นการ์ดสรุปพร้อมปุ่ม "ยืนยันการจอง"
export default defineTool({
  description:
    "ตรวจรายละเอียดการจอง (บริการ ผู้ให้บริการ วัน เวลา ชื่อเล่น เบอร์โทร) และเช็คว่าเวลายังว่าง ก่อนให้ลูกค้ายืนยัน " +
    "เรียกเมื่อได้ข้อมูลครบแล้ว แทนการพิมพ์สรุปเอง ยังไม่จองจริง ต้องรอลูกค้ายืนยันแล้วค่อยเรียก book_appointment " +
    "ถ้าลูกค้าเลือกใครก็ได้ ผลจะบอกผู้ให้บริการที่ระบบเลือกให้ (staffName)",
  inputSchema: bookingInputSchema,
  label: {
    start: ({ service, date, time }) => `ตรวจรายละเอียดการจอง ${service} ${date} ${time}`,
  },
  async execute(req) {
    try {
      const config = await getConfig();
      const check = await checkBooking(config, req);
      if (!check.ok) return check;
      return { ok: true, readyToBook: true, ...bookingDetails(config, req, check) };
    } catch (err) {
      return toolErrorResult("review_booking", err, "ตรวจสอบการจองไม่สำเร็จ");
    }
  },
});
