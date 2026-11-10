import { defineTool } from "eve/tools";

import { createBooking, isCalendarAccessError } from "../lib/calendar";
import { SLOT_TAKEN_MESSAGE, bookingDetails, bookingInputSchema, checkBooking, toolErrorResult } from "../lib/booking";
import { ANY_STAFF, getConfig } from "../lib/config";
import { copyToShopCalendar } from "../lib/staff";

export default defineTool({
  description:
    "จองคิวลง Google Calendar ของร้าน เรียกได้ก็ต่อเมื่อลูกค้ายืนยันรายละเอียดจาก review_booking แล้วเท่านั้น " +
    "ใช้ข้อมูลชุดเดียวกับที่ส่งให้ review_booking (รวม staff) ถ้าผลเป็น ok: false ห้ามบอกลูกค้าว่าจองสำเร็จ " +
    "ถ้าลูกค้าเลือกใครก็ได้ ให้ใช้ชื่อผู้ให้บริการตามผลของเครื่องมือนี้ (อาจต่างจากตอน review ถ้าคนเดิมเพิ่งถูกจองไป)",
  inputSchema: bookingInputSchema,
  label: {
    start: ({ service, date, time }) => `จองคิว ${service} ${date} ${time}`,
  },
  async execute(req) {
    try {
      const config = await getConfig();
      // ลูกค้าเลือกใครก็ได้: ถ้าคนที่ระบบเลือกถูกจองตัดหน้า หรือ calendar ของคนนั้นเขียนไม่ได้
      // (ร้านแชร์สิทธิ์ผิด/ลบ calendar) ให้ตัดคนนั้นออกแล้วหาคนอื่นที่ว่างแทน
      // ลูกค้าเลือกคนเอง: ไม่สลับคน ตอบตามจริง
      const skip = new Set<string>();
      for (;;) {
        // ตรวจซ้ำทั้งหมดก่อนจอง: เวลาอาจถูกจองไปแล้วหลังจากที่ลูกค้าดูสรุป
        const check = await checkBooking(config, req, skip);
        if (!check.ok) return check;

        const { provider } = check;
        const canSwitch = check.requestedStaff === ANY_STAFF;
        const input = {
          service: check.service,
          startMs: check.startMs,
          nickname: req.nickname,
          phone: check.phoneDigits,
          ...(provider.id ? { staff: { id: provider.id, name: provider.name } } : {}),
        };

        let result;
        try {
          result = await createBooking(provider.calendarId, input);
        } catch (err) {
          if (!canSwitch || !isCalendarAccessError(err)) throw err;
          console.error(`[book_appointment] cannot write calendar of "${provider.id}", trying another staff`, err);
          skip.add(provider.id);
          continue;
        }
        if (result.status === "conflict") {
          if (!canSwitch) return { ok: false, reason: "slot_taken", message: SLOT_TAKEN_MESSAGE };
          skip.add(provider.id);
          continue;
        }

        await copyToShopCalendar(provider, input);
        return {
          ok: true,
          bookingId: result.eventId,
          alreadyBooked: result.alreadyBooked,
          ...bookingDetails(config, req, check),
        };
      }
    } catch (err) {
      return toolErrorResult("book_appointment", err, "จองคิวไม่สำเร็จ");
    }
  },
});
