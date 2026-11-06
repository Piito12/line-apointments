import { defineTool } from "eve/tools";
import { z } from "zod";

import { toolErrorResult, unknownServiceResult } from "../lib/booking";
import { listBusyIntervals } from "../lib/calendar";
import { findService, getConfig } from "../lib/config";
import {
  DATE_PATTERN,
  TIME_PATTERN,
  bookingWindow,
  computeAvailableSlots,
  dateRangeToMs,
  isValidDate,
} from "../lib/slots";

export default defineTool({
  description:
    "ดูเวลาว่างของร้านสำหรับบริการที่ลูกค้าต้องการ ในช่วงวันที่ที่ระบุ (เวลาไทย) " +
    "คืนเวลาเริ่มของคิวที่ว่างแยกตามวัน ใช้ทุกครั้งก่อนเสนอเวลาให้ลูกค้า ห้ามเดาเวลาว่างเอง",
  inputSchema: z.object({
    // รายการบริการมาจาก config ที่เปลี่ยนได้ระหว่างรัน จึงรับเป็น string แล้วตรวจใน execute
    service: z.string().trim().min(1).describe("id ของบริการ จากรายการบริการในข้อมูลร้าน"),
    startDate: z.string().regex(DATE_PATTERN).describe("วันแรกที่ต้องการ YYYY-MM-DD (เวลาไทย)"),
    endDate: z
      .string()
      .regex(DATE_PATTERN)
      .optional()
      .describe("วันสุดท้ายที่ต้องการ YYYY-MM-DD ถ้าถามวันเดียวไม่ต้องใส่"),
    timeFrom: z
      .string()
      .regex(TIME_PATTERN)
      .optional()
      .describe("เฉพาะคิวที่เริ่มตั้งแต่เวลานี้ HH:mm เช่น ช่วงบ่าย = 13:00"),
    timeTo: z
      .string()
      .regex(TIME_PATTERN)
      .optional()
      .describe("เฉพาะคิวที่เริ่มก่อนเวลานี้ HH:mm เช่น ช่วงเช้า = 12:00"),
  }),
  label: {
    start: ({ service, startDate }) => `ดูเวลาว่าง ${service} ${startDate}`,
  },
  async execute({ service: serviceId, startDate, endDate, timeFrom, timeTo }) {
    const end = endDate ?? startDate;
    if (!isValidDate(startDate) || !isValidDate(end)) {
      return { ok: false, reason: "invalid_date", message: "วันที่ไม่ถูกต้อง" };
    }

    try {
      const config = await getConfig();
      const service = findService(config, serviceId);
      if (!service) return unknownServiceResult(config, serviceId);

      const now = Date.now();
      const { rules } = config;
      const base = {
        serviceId: service.id,
        service: service.name,
        durationMinutes: service.minutes,
        bookingWindow: bookingWindow(rules, now),
      };
      const query = { rules, durationMinutes: service.minutes, startDate, endDate: end, now, timeFrom, timeTo };

      // รอบแรกไม่มีข้อมูล calendar: ใช้หาช่วงวันที่ที่จองได้จริง เพื่อดึง event เท่าที่จำเป็น
      const window = computeAvailableSlots({ ...query, busy: [] });
      if (!window.searchedFrom || !window.searchedTo) {
        return { ok: true, ...base, ...window };
      }

      const { timeMin, timeMax } = dateRangeToMs(window.searchedFrom, window.searchedTo);
      const busy = await listBusyIntervals(timeMin, timeMax);
      return { ok: true, ...base, ...computeAvailableSlots({ ...query, busy }) };
    } catch (err) {
      return toolErrorResult("get_available_slots", err, "ตรวจสอบตารางนัดไม่สำเร็จ");
    }
  },
});
