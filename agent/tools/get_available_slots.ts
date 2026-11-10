import { defineTool } from "eve/tools";
import { z } from "zod";

import { toolErrorResult, unknownServiceResult } from "../lib/booking";
import { ANY_STAFF, findService, getConfig } from "../lib/config";
import {
  DATE_PATTERN,
  TIME_PATTERN,
  bookingWindow,
  computeAvailableSlots,
  dateRangeToMs,
  isValidDate,
  mergeSlotResults,
} from "../lib/slots";
import { pickProviders, readProvidersBusy } from "../lib/staff";

export default defineTool({
  description:
    "ดูเวลาว่างของร้านสำหรับบริการที่ลูกค้าต้องการ ในช่วงวันที่ที่ระบุ (เวลาไทย) " +
    "คืนเวลาเริ่มของคิวที่ว่างแยกตามวัน ใช้ทุกครั้งก่อนเสนอเวลาให้ลูกค้า ห้ามเดาเวลาว่างเอง " +
    `ถ้าร้านแยกผู้ให้บริการ ใส่ staff เป็น id ของคนที่ลูกค้าเลือก หรือ "${ANY_STAFF}" = เวลาที่มีใครก็ได้ว่าง`,
  inputSchema: z.object({
    // รายการบริการมาจาก config ที่เปลี่ยนได้ระหว่างรัน จึงรับเป็น string แล้วตรวจใน execute
    service: z.string().trim().min(1).describe("id ของบริการ จากรายการบริการในข้อมูลร้าน"),
    staff: z
      .string()
      .trim()
      .optional()
      .describe(`id ของผู้ให้บริการ หรือ "${ANY_STAFF}" = ใครก็ได้ที่ว่าง (ร้านที่ไม่แยกผู้ให้บริการไม่ต้องใส่)`),
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
  async execute({ service: serviceId, staff, startDate, endDate, timeFrom, timeTo }) {
    const end = endDate ?? startDate;
    if (!isValidDate(startDate) || !isValidDate(end)) {
      return { ok: false, reason: "invalid_date", message: "วันที่ไม่ถูกต้อง" };
    }

    try {
      const config = await getConfig();
      const service = findService(config, serviceId);
      if (!service) return unknownServiceResult(config, serviceId);

      const pick = pickProviders(config, service, staff);
      if (!pick.ok) return pick;
      // เลือกคนเดียว → แสดงชื่อในการ์ด, ใครก็ได้/ร้านไม่แยกคน → ไม่แสดงชื่อ
      const single = pick.requested && pick.requested !== ANY_STAFF ? pick.providers[0] : undefined;

      const now = Date.now();
      const { rules } = config;
      const base = {
        serviceId: service.id,
        service: service.name,
        durationMinutes: service.minutes,
        staffId: pick.requested,
        staffName: single?.name ?? "",
        bookingWindow: bookingWindow(rules, now),
      };
      const query = { rules, durationMinutes: service.minutes, startDate, endDate: end, now, timeFrom, timeTo };

      // รอบแรกไม่มีข้อมูล calendar: ใช้หาช่วงวันที่ที่จองได้จริง เพื่อดึง event เท่าที่จำเป็น
      const window = computeAvailableSlots({ ...query, busy: [] });
      if (!window.searchedFrom || !window.searchedTo) {
        return { ok: true, ...base, ...window };
      }

      const { timeMin, timeMax } = dateRangeToMs(window.searchedFrom, window.searchedTo);
      const perProvider = await readProvidersBusy(pick.providers, timeMin, timeMax);
      const slots = mergeSlotResults(perProvider.map((p) => computeAvailableSlots({ ...query, busy: p.busy })));
      return { ok: true, ...base, ...slots };
    } catch (err) {
      return toolErrorResult("get_available_slots", err, "ตรวจสอบตารางนัดไม่สำเร็จ");
    }
  },
});
