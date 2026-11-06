import { createMemoryState } from "@chat-adapter/state-memory";
import { createLineAdapter, linePostable, type LinePostableFlex } from "chat-adapter-line";
import type { Session } from "eve/channels";
import { chatSdkChannel } from "eve/channels/chat-sdk";

import type { BookingDetails } from "../lib/booking";
import {
  CHANGE_BOOKING_ACTION,
  CONFIRM_BOOKING_ACTION,
  buildBookedFlex,
  buildReviewFlex,
} from "../lib/booking-flex";
import { findService, getConfig } from "../lib/config";
import {
  SELECT_SLOT_ACTION,
  buildSlotPickerFlex,
  decodeSlotValue,
  formatThaiDate,
  hasSelectableSlots,
  type SlotPickerData,
} from "../lib/slot-flex";
import { thaiWeekdayOf } from "../lib/slots";

// LINE channel ผ่าน Vercel Chat SDK + community adapter `chat-adapter-line`
//
// credential อ่านจาก env (ใส่ใน .env.local) — ต้องมีทั้งสองค่า ไม่งั้น dev server จะเปิดไม่ขึ้น:
//   LINE_CHANNEL_SECRET        ใช้ตรวจลายเซ็น webhook (x-line-signature)
//   LINE_CHANNEL_ACCESS_TOKEN  ใช้ส่งข้อความกลับ
// (ลองทำให้ปิด channel อัตโนมัติเมื่อไม่มีค่าแล้ว แต่ eve compile channel แบบ static
//  จึงใช้ default export แบบมีเงื่อนไขไม่ได้ — ทั้ง disableRoute() และ channel เปล่า)
//
// Webhook URL ที่ต้องตั้งใน LINE Developers Console:
//   https://<โดเมน หรือ tunnel>/eve/v1/line
//
// adapter จัดการให้แล้ว: ตรวจลายเซ็น, ตอบด้วย Reply API ก่อน (ฟรี)
// แล้ว fallback เป็น Push API (นับ quota) เมื่อ reply token ใช้ไม่ได้, Flex message และ postback
type PendingCard =
  | { kind: "slots"; data: SlotPickerData }
  | { kind: "review"; data: BookingDetails }
  | { kind: "booked"; data: BookingDetails };

/** เลือกการ์ดจากผลของ tool: แสดงเฉพาะเมื่อ tool ทำงานสำเร็จ (ok: true) */
function cardFromToolResult(result: { toolName?: string; output?: unknown }): PendingCard | null {
  const output = result.output as ({ ok?: boolean } & Record<string, unknown>) | undefined;
  if (!output?.ok) return null;
  switch (result.toolName) {
    case "get_available_slots":
      return Array.isArray(output.days) ? { kind: "slots", data: output as unknown as SlotPickerData } : null;
    case "review_booking":
      return { kind: "review", data: output as unknown as BookingDetails };
    case "book_appointment":
      return { kind: "booked", data: output as unknown as BookingDetails };
    default:
      return null;
  }
}

function buildCard(message: string, card: PendingCard) {
  switch (card.kind) {
    case "slots":
      return hasSelectableSlots(card.data) ? buildSlotPickerFlex(message, card.data) : null;
    case "review":
      return buildReviewFlex(message, card.data);
    case "booked":
      return buildBookedFlex(message, card.data);
  }
}

export const { bot, channel, send } = chatSdkChannel({
  userName: "ผู้ช่วยนัดหมาย",
  adapters: {
    line: createLineAdapter(),
  },
  // PoC: เก็บ state ใน memory (หายเมื่อ restart)
  // production ต้องเปลี่ยนเป็น durable state เช่น Redis/Upstash ตามที่ eve docs แนะนำ
  state: createMemoryState(),
  // LINE แก้ไขข้อความที่ส่งไปแล้วไม่ได้ จึงต้องปิด streaming แบบ post-then-edit
  // และส่งคำตอบทีเดียวตอนจบ
  streaming: false,
  events: {
    // จำผลของ tool ล่าสุดที่ต้องแสดงเป็นการ์ด ไว้ใน state ของแชทนี้ แล้วใช้ตอน agent ตอบ
    // (handler ที่เขียนเองจะแทนที่ default ของ event นั้น: action.result ไม่มี default ให้ทับ)
    "action.result"(event, ch) {
      const card = cardFromToolResult(event.result as { toolName?: string; output?: unknown });
      if (card) ch.state.pendingCard = card;
    },

    // แทนที่ default: ส่งคำตอบเป็น Flex ถ้ามีการ์ดค้างไว้ ไม่งั้นส่งข้อความธรรมดา
    async "message.completed"(event, ch) {
      // ข้อความระหว่างเรียก tool (เช่น "ขอเช็คตารางก่อนนะคะ") ไม่ส่ง
      // เพื่อเก็บ reply token ไว้ใช้กับคำตอบสุดท้าย (ส่งด้วย Reply API ฟรี ไม่ต้องใช้ Push)
      if (event.finishReason === "tool-calls" || !event.message || !ch.thread) return;

      const card = ch.state.pendingCard as PendingCard | null | undefined;
      ch.state.pendingCard = null;
      const flex = card ? buildCard(event.message, card) : null;
      if (flex) {
        await ch.thread.post(linePostable({ flex: flex as LinePostableFlex["flex"] }));
        return;
      }
      await ch.thread.post({ markdown: event.message });
    },
  },
});

// คำสั่งล้างประวัติแชท: พิมพ์ใน LINE แล้ว agent จะลืมบทสนทนาก่อนหน้า
// ข้อความนี้ไม่ถูกส่งให้โมเดล จึงไม่เสียค่าโมเดลและ agent ไม่ตอบเอง
const CLEAR_COMMANDS = new Set(["เริ่มใหม่", "ล้างแชท", "/clear"]);

// session ล่าสุดของแต่ละแชท (thread.id → session ของ eve) ได้มาจาก send()
// เพราะ chatSdkChannel ไม่มีคำสั่งล้าง session ให้โดยตรง
// เก็บใน memory: ถ้า restart dev server แล้วพิมพ์คำสั่งล้างก่อนข้อความอื่น จะยังไม่รู้จัก session
const sessions = new Map<string, Session>();

// แชท 1:1 กับ LINE OA: handler นี้ทำงานกับทุกข้อความใน DM
// ก่อน onSubscribedMessage/onNewMention จึงไม่ต้อง subscribe thread
// ข้อความจาก userId เดิมจะวนกลับเข้า eve session เดิม (thread = continuation address)
bot.onDirectMessage(async (thread, message) => {
  if (CLEAR_COMMANDS.has(message.text.trim())) {
    const session = sessions.get(thread.id);
    if (!session) {
      await thread.post("ยังล้างประวัติไม่ได้ค่ะ ลองพิมพ์ข้อความอื่นก่อน 1 ครั้ง แล้วพิมพ์ \"เริ่มใหม่\" อีกครั้งนะคะ");
      return;
    }
    const result = await session.clear();
    console.info("[line] cleared session", session.id, result);
    await thread.post("ล้างประวัติการสนทนาแล้วค่ะ เริ่มคุยใหม่ได้เลยนะคะ");
    return;
  }

  sessions.set(thread.id, await send(message.text, { thread }));
});

/** ชื่อบริการสำหรับข้อความที่ส่งเข้า agent แทนลูกค้า (ถ้าโหลด config ไม่ได้ ใช้ id แทน agent ยังเข้าใจได้) */
async function serviceName(serviceId: string): Promise<string> {
  try {
    return findService(await getConfig(), serviceId)?.name ?? serviceId;
  } catch {
    return serviceId;
  }
}

// ลูกค้ากดปุ่มเวลาใน Flex: ส่งเวลาที่เลือกเข้า agent เหมือนลูกค้าพิมพ์บอกเอง
// agent จะขอชื่อเล่น/เบอร์ และให้ยืนยันก่อนจองตาม instructions
bot.onAction(SELECT_SLOT_ACTION, async (event) => {
  const slot = decodeSlotValue(event.value);
  if (!event.thread || !slot) return;
  const text = `ขอจอง${await serviceName(slot.serviceId)} ${formatThaiDate(slot.date, thaiWeekdayOf(slot.date))} (${slot.date}) เวลา ${slot.time} น.`;
  // ActionEvent.thread มี type กว้างกว่าที่ send() รับ แต่เป็น thread ของ adapter เดียวกัน
  const thread = event.thread as Parameters<typeof send>[1]["thread"];
  sessions.set(event.thread.id, await send(text, { thread }));
});

// ลูกค้ากด "ยืนยันการจอง" บนการ์ดสรุป: ส่งคำยืนยันพร้อมรายละเอียดเข้า agent
// ใส่บริการ/วัน/เวลาในข้อความด้วย ถ้าลูกค้ากดปุ่มของการ์ดเก่า agent จะรู้ว่ายืนยันรายการไหน
bot.onAction(CONFIRM_BOOKING_ACTION, async (event) => {
  const slot = decodeSlotValue(event.value);
  if (!event.thread || !slot) return;
  const text = `ยืนยันการจอง${await serviceName(slot.serviceId)} ${formatThaiDate(slot.date, thaiWeekdayOf(slot.date))} (${slot.date}) เวลา ${slot.time} น.`;
  const thread = event.thread as Parameters<typeof send>[1]["thread"];
  sessions.set(event.thread.id, await send(text, { thread }));
});

bot.onAction(CHANGE_BOOKING_ACTION, async (event) => {
  if (!event.thread) return;
  const thread = event.thread as Parameters<typeof send>[1]["thread"];
  sessions.set(event.thread.id, await send("ขอเปลี่ยนวันเวลานัดค่ะ", { thread }));
});

export default channel;
