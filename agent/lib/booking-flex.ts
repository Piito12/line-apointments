// การ์ด Flex สรุปการจอง 2 แบบ:
//   - review:  ก่อนจอง (จาก review_booking) มีปุ่ม "ยืนยันการจอง" / "เปลี่ยนเวลา"
//   - booked:  หลังจองสำเร็จ (จาก book_appointment) เป็นใบยืนยันนัดหมาย
// ข้อความของ agent อยู่ในการ์ดด้วย เพื่อส่งครั้งเดียวด้วย Reply API (ไม่เสีย quota ของ Push)

import { serializePostbackData } from "chat-adapter-line";

import type { BookingDetails } from "./booking";
import { encodeSlotValue, formatThaiDate } from "./slot-flex";

export const CONFIRM_BOOKING_ACTION = "confirm_booking";
export const CHANGE_BOOKING_ACTION = "change_booking";

const ACCENT = "#C2185B";
const SUCCESS = "#2E7D32";

function detailRow(label: string, value: string) {
  return {
    type: "box",
    layout: "baseline",
    spacing: "md",
    margin: "sm",
    contents: [
      { type: "text", text: label, size: "sm", color: "#888888", flex: 2 },
      { type: "text", text: value, size: "sm", color: "#222222", flex: 5, wrap: true, weight: "bold" },
    ],
  };
}

function detailRows(d: BookingDetails) {
  return [
    detailRow("บริการ", `${d.service} (${d.durationMinutes} นาที)`),
    detailRow("วัน", formatThaiDate(d.date, d.weekday)),
    detailRow("เวลา", `${d.time}–${d.endTime} น.`),
    detailRow("ชื่อเล่น", d.nickname),
    detailRow("เบอร์โทร", d.phoneMasked),
  ];
}

function header(title: string, subtitle: string, color: string) {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: color,
    paddingAll: "md",
    contents: [
      { type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "md" },
      { type: "text", text: subtitle, color: "#FFFFFFCC", size: "xs" },
    ],
  };
}

/** การ์ดสรุปก่อนจอง พร้อมปุ่มยืนยัน */
export function buildReviewFlex(message: string, d: BookingDetails) {
  const slot = encodeSlotValue(d.serviceId, d.date, d.time);
  return {
    altText: message.slice(0, 400),
    contents: {
      type: "bubble",
      header: header("ตรวจสอบการจอง", "กรุณาตรวจสอบรายละเอียดก่อนยืนยัน", ACCENT),
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: message, wrap: true, size: "sm" },
          { type: "separator", margin: "lg" },
          { type: "box", layout: "vertical", margin: "lg", contents: detailRows(d) },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: ACCENT,
            action: {
              type: "postback",
              label: "ยืนยันการจอง",
              data: serializePostbackData(CONFIRM_BOOKING_ACTION, slot),
              displayText: `ยืนยันการจอง${d.service} ${formatThaiDate(d.date, d.weekday)} เวลา ${d.time} น.`,
            },
          },
          {
            type: "button",
            style: "secondary",
            action: {
              type: "postback",
              label: "เปลี่ยนวันเวลา",
              data: serializePostbackData(CHANGE_BOOKING_ACTION, slot),
              displayText: "ขอเปลี่ยนวันเวลานัด",
            },
          },
        ],
      },
    },
  };
}

/** ใบยืนยันหลังจองสำเร็จ */
export function buildBookedFlex(message: string, d: BookingDetails) {
  return {
    altText: message.slice(0, 400),
    contents: {
      type: "bubble",
      header: header("จองคิวสำเร็จ ✓", "คลินิกทำหน้า", SUCCESS),
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "box", layout: "vertical", contents: detailRows(d) },
          { type: "separator", margin: "lg" },
          { type: "text", text: message, wrap: true, size: "sm", margin: "lg" },
          {
            type: "text",
            text: "หากต้องการเลื่อนหรือยกเลิกนัด กรุณาติดต่อคลินิก",
            wrap: true,
            size: "xs",
            color: "#888888",
            margin: "md",
          },
        ],
      },
    },
  };
}
