// สร้าง LINE Flex message สำหรับให้ลูกค้ากดเลือกเวลานัด
// ใช้ผลลัพธ์จาก tool get_available_slots โดยตรง (ไม่ให้โมเดลสร้าง JSON เอง)
// ปุ่มเวลาแต่ละปุ่มเป็น postback: กดแล้ว LINE ส่ง webhook กลับมา → line.ts → bot.onAction

import { serializePostbackData } from "chat-adapter-line";

import { SERVICES, type ServiceId } from "./clinic";

export const SELECT_SLOT_ACTION = "select_slot";

const MAX_DAYS = 3;
const MAX_TIMES_PER_DAY = 12;
const BUTTONS_PER_ROW = 3;
const ACCENT = "#C2185B";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

/** ผลลัพธ์ของ get_available_slots ส่วนที่ใช้สร้างการ์ด */
export interface SlotPickerData {
  serviceId: ServiceId;
  days: { date: string; weekday: string; times: string[] }[];
}

export function formatThaiDate(date: string, weekday: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${weekday} ${d} ${THAI_MONTHS[m - 1]}`;
}

/** ค่าที่ฝังใน postback ของปุ่ม: "serviceId|YYYY-MM-DD|HH:mm" */
export function encodeSlotValue(serviceId: ServiceId, date: string, time: string): string {
  return `${serviceId}|${date}|${time}`;
}

export function decodeSlotValue(value: string | undefined): { serviceId: ServiceId; date: string; time: string } | null {
  const [serviceId, date, time] = (value ?? "").split("|");
  if (!(serviceId in SERVICES) || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !/^\d{2}:\d{2}$/.test(time ?? "")) {
    return null;
  }
  return { serviceId: serviceId as ServiceId, date, time };
}

/** มีเวลาว่างให้แสดงไหม (ถ้าไม่มี ส่งเป็นข้อความธรรมดา) */
export function hasSelectableSlots(data: SlotPickerData): boolean {
  return data.days.some((d) => d.times.length > 0);
}

/**
 * การ์ดเดียว (bubble): ข้อความของ agent อยู่บนสุด ตามด้วยปุ่มเวลาแยกตามวัน
 * รวมไว้ในการ์ดเดียวเพื่อส่งครั้งเดียวด้วย Reply API (ไม่เสีย quota ของ Push API)
 */
export function buildSlotPickerFlex(message: string, data: SlotPickerData) {
  const service = SERVICES[data.serviceId];
  const days = data.days.filter((d) => d.times.length > 0);
  const shownDays = days.slice(0, MAX_DAYS);
  const truncated = days.length > MAX_DAYS || shownDays.some((d) => d.times.length > MAX_TIMES_PER_DAY);

  const daySections = shownDays.flatMap((day) => {
    const dateLabel = formatThaiDate(day.date, day.weekday);
    const times = day.times.slice(0, MAX_TIMES_PER_DAY);
    const rows = [];
    for (let i = 0; i < times.length; i += BUTTONS_PER_ROW) {
      const rowTimes = times.slice(i, i + BUTTONS_PER_ROW);
      rows.push({
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        margin: "sm",
        contents: [
          ...rowTimes.map((time) => ({
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "postback",
              label: time,
              data: serializePostbackData(SELECT_SLOT_ACTION, encodeSlotValue(data.serviceId, day.date, time)),
              displayText: `ขอจอง${service.label} ${dateLabel} เวลา ${time} น.`,
            },
          })),
          // เติมช่องว่างให้ปุ่มแถวสุดท้ายกว้างเท่าแถวอื่น
          ...Array.from({ length: BUTTONS_PER_ROW - rowTimes.length }, () => ({ type: "filler" })),
        ],
      });
    }
    return [
      { type: "text", text: dateLabel, weight: "bold", size: "sm", color: ACCENT, margin: "lg" },
      ...rows,
    ];
  });

  return {
    altText: message.slice(0, 400),
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: ACCENT,
        paddingAll: "md",
        contents: [
          { type: "text", text: "เลือกเวลานัด", color: "#FFFFFF", weight: "bold", size: "md" },
          { type: "text", text: `${service.label} · ${service.minutes} นาที`, color: "#FFFFFFCC", size: "xs" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: message, wrap: true, size: "sm" },
          { type: "separator", margin: "lg" },
          ...daySections,
          ...(truncated
            ? [{ type: "text", text: "ยังมีเวลาอื่นอีก พิมพ์บอกช่วงที่สะดวกได้เลยค่ะ", size: "xs", color: "#888888", margin: "lg", wrap: true }]
            : []),
        ],
      },
    },
  };
}
