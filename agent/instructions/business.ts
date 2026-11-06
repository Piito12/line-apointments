import { defineDynamic, defineInstructions } from "eve/instructions";

import { getConfig, type BusinessConfig } from "../lib/config";
import { THAI_WEEKDAYS } from "../lib/slots";

// ข้อมูลร้านจาก config (Google Sheet หรือค่าเริ่มต้น) ใส่ใน prompt ทุก turn
// ทำให้ prompt กับกฎที่ tool ใช้คำนวณมาจากแหล่งเดียวกันเสมอ ไม่ต้องแก้ 2 ที่ให้ตรงกัน
// config ถูก cache ไว้ (ดู config.ts) จึงไม่ได้ยิง Sheet ทุกข้อความ

function render(c: BusinessConfig): string {
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
  if (c.extraInstructions.trim()) {
    lines.push("", "# กฎเฉพาะของร้านนี้", "", c.extraInstructions.trim());
  }
  return lines.join("\n");
}

export default defineDynamic({
  events: {
    "turn.started": async () => {
      try {
        return defineInstructions({ content: render(await getConfig()) });
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
