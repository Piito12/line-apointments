// การ์ด Flex ให้ลูกค้าเลือกผู้ให้บริการ (หมอ/พนักงาน) จากผลของ tool list_staff
// ปุ่มเป็น postback: กดแล้ว LINE ส่ง webhook กลับมา → line.ts → bot.onAction(SELECT_STAFF_ACTION)

import { serializePostbackData } from "chat-adapter-line";

import { ANY_STAFF } from "./config-schema";

export const SELECT_STAFF_ACTION = "select_staff";

const ACCENT = "#C2185B";
const ID = /^[a-z0-9_-]{1,40}$/;

/** ผลลัพธ์ของ list_staff ส่วนที่ใช้สร้างการ์ด */
export interface StaffPickerData {
  serviceId: string;
  service: string;
  staff: { id: string; name: string }[];
}

/** ค่าที่ฝังใน postback: "serviceId|staffId" (staffId = id ของคน หรือ "any") */
export function encodeStaffValue(serviceId: string, staffId: string): string {
  return `${serviceId}|${staffId}`;
}

export function decodeStaffValue(value: string | undefined): { serviceId: string; staffId: string } | null {
  const [serviceId, staffId] = (value ?? "").split("|");
  if (!ID.test(serviceId ?? "") || !ID.test(staffId ?? "")) return null;
  return { serviceId, staffId };
}

export function buildStaffPickerFlex(message: string, data: StaffPickerData) {
  const button = (label: string, staffId: string, displayText: string, style: "primary" | "secondary") => ({
    type: "button",
    style,
    height: "sm",
    margin: "sm",
    ...(style === "primary" ? { color: ACCENT } : {}),
    action: {
      type: "postback",
      // LINE จำกัด label ปุ่มไม่เกิน 40 ตัวอักษร
      label: label.slice(0, 40),
      data: serializePostbackData(SELECT_STAFF_ACTION, encodeStaffValue(data.serviceId, staffId)),
      displayText,
    },
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
          { type: "text", text: "เลือกผู้ให้บริการ", color: "#FFFFFF", weight: "bold", size: "md" },
          { type: "text", text: data.service, color: "#FFFFFFCC", size: "xs", wrap: true },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: message, wrap: true, size: "sm" },
          { type: "separator", margin: "lg" },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            contents: [
              ...data.staff.map((s) => button(s.name, s.id, `ขอ${data.service}กับ${s.name}`, "primary")),
              button("ใครก็ได้ที่ว่าง", ANY_STAFF, `ขอ${data.service} ใครก็ได้ที่ว่าง`, "secondary"),
            ],
          },
        ],
      },
    },
  };
}
