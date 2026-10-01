// ข้อมูลคลินิกที่ tool ใช้คำนวณเวลาว่างและจองคิว (ข้อมูลสมมติสำหรับ PoC)
// ถ้าแก้ตรงนี้ ให้แก้ส่วน "ข้อมูลคลินิก" ใน agent/instructions.md ให้ตรงกันด้วย

/** Asia/Bangkok ไม่มี daylight saving ใช้ offset คงที่ได้ */
export const UTC_OFFSET = "+07:00";
export const UTC_OFFSET_MINUTES = 7 * 60;

/** เวลาทำการ (เวลาไทย) */
export const OPEN_TIME = "10:00";
export const CLOSE_TIME = "20:00";

/** วันที่ปิด ตามเลขวันของ Date#getUTCDay (0 = อาทิตย์, 1 = จันทร์, ...) */
export const CLOSED_WEEKDAYS: readonly number[] = [1];

/** เวลาเริ่มของแต่ละคิวต้องลงที่ทุกๆ กี่นาที เช่น 10:00, 10:30, 11:00 */
export const SLOT_STEP_MINUTES = 30;

/** จองล่วงหน้าได้สูงสุดกี่วัน นับรวมวันนี้ */
export const BOOKING_WINDOW_DAYS = 14;

/** ต้องจองก่อนเวลานัดอย่างน้อยกี่นาที */
export const MIN_LEAD_MINUTES = 60;

/** รับลูกค้าพร้อมกันได้ 1 คิว: event ใดๆ ใน calendar ถือว่าเวลานั้นไม่ว่าง */
export const SERVICES = {
  consultation: { label: "ปรึกษาแพทย์ผิวหนัง", minutes: 30 },
  facial: { label: "ทรีตเมนต์หน้าใส / Facial", minutes: 60 },
  laser: { label: "เลเซอร์ผิวหน้า", minutes: 45 },
  botox: { label: "โบท็อกซ์", minutes: 30 },
  filler: { label: "ฟิลเลอร์", minutes: 45 },
} as const;

export type ServiceId = keyof typeof SERVICES;

export const SERVICE_IDS = Object.keys(SERVICES) as [ServiceId, ...ServiceId[]];

export const THAI_WEEKDAYS = [
  "อาทิตย์",
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
] as const;
