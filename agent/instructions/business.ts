import { defineDynamic, defineInstructions } from "eve/instructions";

import { getConfig, type BusinessConfig } from "../lib/config";
import { getDayCalendar } from "../lib/holidays";
import { THAI_WEEKDAYS, addDays, bookingWindow, dayStatus, thaiWeekdayOf, type DayCalendar } from "../lib/slots";

// ข้อมูลร้านจาก config (Google Sheet หรือค่าเริ่มต้น) ใส่ใน prompt ทุก turn
// ทำให้ prompt กับกฎที่ tool ใช้คำนวณมาจากแหล่งเดียวกันเสมอ ไม่ต้องแก้ 2 ที่ให้ตรงกัน
// config ถูก cache ไว้ (ดู config.ts) จึงไม่ได้ยิง Sheet ทุกข้อความ

/**
 * วันในช่วงที่จองได้ที่ต่างจากตารางปกติ (วันหยุด ปิดพิเศษ เปิดทั้งที่ปกติปิด เวลาพิเศษ)
 * วันปิดประจำสัปดาห์ไม่ต้องไล่ เพราะบอกไว้ในเวลาทำการแล้ว
 */
function specialDays(c: BusinessConfig, cal: DayCalendar): string[] {
  const { firstDate, lastDate } = bookingWindow(c.rules, Date.now());
  const lines: string[] = [];
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
    const status = dayStatus(c.rules, date, cal);
    const normal = dayStatus(c.rules, date);
    const label = `  - ${date} (${thaiWeekdayOf(date)}): `;
    if (!status.open && normal.open) lines.push(label + status.reason);
    else if (status.open && (!normal.open || status.special)) {
      const note = status.note ? ` (${status.note})` : "";
      lines.push(label + `เปิด ${status.openTime}–${status.closeTime} น.${note}`);
    }
  }
  return lines;
}

function render(c: BusinessConfig, cal: DayCalendar): string {
  const r = c.rules;
  const closed = r.closedWeekdays.map((d) => THAI_WEEKDAYS[d]).join(", ");
  const lines = [
    "# ข้อมูลร้าน",
    "",
    `- ชื่อร้าน: ${c.businessName}${c.businessType ? ` (${c.businessType})` : ""}`,
    `- เวลาทำการ: ${r.openTime}–${r.closeTime} น.${closed ? ` ปิดทุกวัน${closed}` : " เปิดทุกวัน"}`,
    `- จองล่วงหน้าได้ไม่เกิน ${r.bookingWindowDays} วัน และต้องจองก่อนเวลานัดอย่างน้อย ${r.minLeadMinutes} นาที`,
    "- เขตเวลา: Asia/Bangkok (UTC+7) ใช้เวลานี้เสมอเวลาพูดถึงวันและเวลา",
    ...(c.contact ? [`- ช่องทางติดต่อร้าน: ${c.contact}`] : []),
    "- บริการ (ใช้ id ในวงเล็บเหลี่ยมเวลาเรียกเครื่องมือ ห้ามบอก id ให้ลูกค้า):",
    ...c.services.map((s) => `  - [${s.id}] ${s.name} (${s.minutes} นาที)`),
  ];
  const special = specialDays(c, cal);
  if (special.length > 0) {
    lines.push("- วันปิด/เปิดพิเศษในช่วงที่จองได้ (นอกจากนี้เป็นไปตามเวลาทำการปกติ):", ...special);
  }
  if (c.staff.length > 0) {
    const serviceName = (id: string) => c.services.find((s) => s.id === id)?.name ?? id;
    lines.push(
      "- ผู้ให้บริการ (ใช้ id ในวงเล็บเหลี่ยมเป็นค่า staff เวลาเรียกเครื่องมือ ห้ามบอก id ให้ลูกค้า):",
      ...c.staff.map(
        (p) =>
          `  - [${p.id}] ${p.name} — ${p.serviceIds === "all" ? "ทุกบริการ" : p.serviceIds.map(serviceName).join(", ")}`,
      ),
    );
  }
  if (c.extraInstructions.trim()) {
    lines.push("", "# กฎเฉพาะของร้านนี้", "", c.extraInstructions.trim());
  }
  return lines.join("\n");
}

export default defineDynamic({
  events: {
    "turn.started": async () => {
      try {
        const config = await getConfig();
        return defineInstructions({ content: render(config, await getDayCalendar(config)) });
      } catch {
        // throw ใน resolver จะทำให้ทั้ง turn ล้ม จึงบอกโมเดลแทน (error ถูก log ใน config.ts แล้ว)
        return defineInstructions({
          content:
            "# ข้อมูลร้าน\n\nตอนนี้โหลดข้อมูลร้านไม่สำเร็จ ให้แจ้งลูกค้าสุภาพๆ ว่าระบบนัดหมายขัดข้องชั่วคราว " +
            "ให้ลองใหม่ภายหลังหรือติดต่อร้านโดยตรง ห้ามเดาบริการหรือเวลาทำการเอง",
        });
      }
    },
  },
});
