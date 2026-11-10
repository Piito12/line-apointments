import { defineTool } from "eve/tools";
import { z } from "zod";

import { toolErrorResult, unknownServiceResult } from "../lib/booking";
import { ANY_STAFF, findService, getConfig, staffForService } from "../lib/config";

// รายชื่อผู้ให้บริการของบริการหนึ่ง ใน LINE ผลของ tool นี้แสดงเป็นการ์ดปุ่มเลือกคน (เมื่อ chooseStaff เป็น true)
export default defineTool({
  description:
    "ดูรายชื่อผู้ให้บริการ (หมอ/พนักงาน) ที่ทำบริการนี้ได้ เรียกหลังรู้ว่าลูกค้าต้องการบริการอะไร ถ้าข้อมูลร้านมีรายชื่อผู้ให้บริการ " +
    "ผลบอกว่าต้องให้ลูกค้าเลือกไหม (chooseStaff) ถ้าไม่ต้องเลือก ให้ใช้ค่า staff ที่ผลแนะนำ (useStaff) ต่อได้เลย",
  inputSchema: z.object({
    service: z.string().trim().min(1).describe("id ของบริการ จากรายการบริการในข้อมูลร้าน"),
  }),
  label: {
    start: ({ service }) => `ดูผู้ให้บริการ ${service}`,
  },
  async execute({ service: serviceId }) {
    try {
      const config = await getConfig();
      const service = findService(config, serviceId);
      if (!service) return unknownServiceResult(config, serviceId);

      const staff = staffForService(config, service.id).map((s) => ({ id: s.id, name: s.name }));
      const base = { ok: true as const, serviceId: service.id, service: service.name, staff };
      if (staff.length === 0) {
        return { ...base, chooseStaff: false, message: "ร้านนี้ไม่ได้แยกผู้ให้บริการ ถามวันเวลาต่อได้เลย ไม่ต้องใส่ staff" };
      }
      if (service.chooseStaff && staff.length > 1) {
        return {
          ...base,
          chooseStaff: true,
          message: `ระบบแสดงปุ่มให้ลูกค้าเลือกผู้ให้บริการแล้ว ถามสั้นๆ ว่าสะดวกกับใคร หรือ "ใครก็ได้" (staff: "${ANY_STAFF}")`,
        };
      }
      const useStaff = staff.length === 1 ? staff[0].id : ANY_STAFF;
      return {
        ...base,
        chooseStaff: false,
        useStaff,
        message: `ไม่ต้องให้ลูกค้าเลือกผู้ให้บริการ ใช้ staff: "${useStaff}" ในเครื่องมือถัดไป แล้วถามวันเวลาต่อได้เลย`,
      };
    } catch (err) {
      return toolErrorResult("list_staff", err, "ดูรายชื่อผู้ให้บริการไม่สำเร็จ");
    }
  },
});
