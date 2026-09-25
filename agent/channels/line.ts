import { createMemoryState } from "@chat-adapter/state-memory";
import { createLineAdapter } from "chat-adapter-line";
import { chatSdkChannel } from "eve/channels/chat-sdk";

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
export const { bot, channel, send } = chatSdkChannel({
  userName: "คลินิกทำหน้า",
  adapters: {
    line: createLineAdapter(),
  },
  // PoC: เก็บ state ใน memory (หายเมื่อ restart)
  // production ต้องเปลี่ยนเป็น durable state เช่น Redis/Upstash ตามที่ eve docs แนะนำ
  state: createMemoryState(),
  // LINE แก้ไขข้อความที่ส่งไปแล้วไม่ได้ จึงต้องปิด streaming แบบ post-then-edit
  // และส่งคำตอบทีเดียวตอนจบ
  streaming: false,
});

// แชท 1:1 กับ LINE OA: handler นี้ทำงานกับทุกข้อความใน DM
// ก่อน onSubscribedMessage/onNewMention จึงไม่ต้อง subscribe thread
// ข้อความจาก userId เดิมจะวนกลับเข้า eve session เดิม (thread = continuation address)
bot.onDirectMessage(async (thread, message) => {
  await send(message.text, { thread });
});

export default channel;
