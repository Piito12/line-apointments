import { defineTool } from "eve/tools";
import { z } from "zod";

import { SERVICE_IDS, SERVICES } from "../lib/clinic";
import { CalendarNotConfiguredError, listBusyIntervals } from "../lib/calendar";
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
    "ดูเวลาว่างของคลินิกสำหรับบริการที่ลูกค้าต้องการ ในช่วงวันที่ที่ระบุ (เวลาไทย) " +
    "คืนเวลาเริ่มของคิวที่ว่างแยกตามวัน ใช้ทุกครั้งก่อนเสนอเวลาให้ลูกค้า ห้ามเดาเวลาว่างเอง",
  inputSchema: z.object({
    service: z.enum(SERVICE_IDS).describe(
      Object.entries(SERVICES)
        .map(([id, s]) => `${id} = ${s.label} (${s.minutes} นาที)`)
        .join(", "),
    ),
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
    start: ({ service, startDate }) => `ดูเวลาว่าง ${SERVICES[service].label} ${startDate}`,
  },
  async execute({ service, startDate, endDate, timeFrom, timeTo }) {
    const end = endDate ?? startDate;
    if (!isValidDate(startDate) || !isValidDate(end)) {
      return { ok: false, reason: "invalid_date", message: "วันที่ไม่ถูกต้อง" };
    }

    const now = Date.now();
    const base = { service: SERVICES[service].label, durationMinutes: SERVICES[service].minutes, bookingWindow: bookingWindow(now) };

    // รอบแรกไม่มีข้อมูล calendar: ใช้หาช่วงวันที่ที่จองได้จริง เพื่อดึง event เท่าที่จำเป็น
    const window = computeAvailableSlots({ serviceId: service, startDate, endDate: end, busy: [], now, timeFrom, timeTo });
    if (!window.searchedFrom || !window.searchedTo) {
      return { ok: true, ...base, ...window };
    }

    try {
      const { timeMin, timeMax } = dateRangeToMs(window.searchedFrom, window.searchedTo);
      const busy = await listBusyIntervals(timeMin, timeMax);
      const result = computeAvailableSlots({ serviceId: service, startDate, endDate: end, busy, now, timeFrom, timeTo });
      return { ok: true, ...base, ...result };
    } catch (err) {
      if (err instanceof CalendarNotConfiguredError) {
        return { ok: false, reason: "calendar_not_configured", message: "ระบบตารางนัดยังไม่พร้อมใช้งาน" };
      }
      console.error("[get_available_slots] calendar error", err);
      return { ok: false, reason: "calendar_error", message: "ตรวจสอบตารางนัดไม่สำเร็จ" };
    }
  },
});
