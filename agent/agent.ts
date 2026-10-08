import { defineAgent } from "eve";

// เรียกโมเดลผ่าน Vercel AI Gateway (model ID แบบ string)
// - บน Vercel: ยืนยันตัวตนด้วย project OIDC อัตโนมัติ ไม่ต้องใส่ key
// - local: ต้องมี AI_GATEWAY_API_KEY ใน .env.local หรือรัน `eve link` เพื่อดึง OIDC token
export default defineAgent({
  model: "openai/gpt-5.6-luna",
});
