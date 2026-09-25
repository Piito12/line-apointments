import { defineAgent } from "eve";
import { chatgpt } from "eve/models/openai";

// ช่วงทดสอบ: ใช้ ChatGPT subscription ผ่าน /login ใน dev TUI (ไม่ต้องใช้ API key)
// ค่าเริ่มต้นของ helper คือ gpt-6-luna-fast
// ⚠️ ใช้ได้เฉพาะ local (eve dev) deploy ไม่ได้ ตอนขึ้น production ต้องเปลี่ยนเป็น
//   API key จริง เช่น import { anthropic } from "eve/models/anthropic";  model: anthropic(),
export default defineAgent({
  model: chatgpt("gpt-5.6-luna"),
});
