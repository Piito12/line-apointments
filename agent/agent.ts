import { defineAgent, defineDynamic } from "eve";
import { anthropic } from "eve/models/anthropic";
import { chatgpt, openai } from "eve/models/openai";

// เลือกโมเดล 2 แบบ
//
// ก. AI_PROVIDER + AI_API_KEY (ปุ่ม Deploy บังคับกรอก 2 ช่องนี้)
//    anthropic → Claude โดยตรง (ค่าเริ่มต้น claude-sonnet-5)
//    openai    → OpenAI โดยตรง (ค่าเริ่มต้น gpt-5.6-luna)
//    gateway   → Vercel AI Gateway หลายเจ้าด้วย key เดียว (ค่าเริ่มต้น openai/gpt-5.6-luna)
//
// ข. ไม่ตั้ง AI_PROVIDER → เลือกจาก key ที่มี (ตัวแรกที่เจอชนะ)
//    1. ANTHROPIC_API_KEY  2. OPENAI_API_KEY
//    3. AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN หรือรันบน Vercel → AI Gateway
//    4. ไม่มี key เลย → ChatGPT subscription ผ่าน /login (ใช้ได้เฉพาะ local)
//
// AI_MODEL เปลี่ยนรุ่นภายใน provider ที่ถูกเลือก (Gateway ต้องมี prefix provider/ เช่น anthropic/claude-sonnet-5)
//
// eve ประเมินไฟล์นี้ตอน compile และ import ใหม่ตอน runtime เฉพาะเมื่อคืน LanguageModel
// (anthropic() / openai()) หรือ defineDynamic ทุกทางที่ใช้ AI_API_KEY จึงคืนแบบนั้น
// ไม่ใช่ string ของ Gateway ตรงๆ ไม่งั้นโค้ดด้านล่างจะไม่ถูกรันบน server และ key จะไม่ถูกส่งต่อ
const modelId = process.env.AI_MODEL?.trim() || undefined;
const PROVIDERS = ["anthropic", "openai", "gateway"] as const;
const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || undefined;
const apiKey = process.env.AI_API_KEY?.trim() || undefined;

if (provider && !(PROVIDERS as readonly string[]).includes(provider)) {
  throw new Error(`AI_PROVIDER must be one of ${PROVIDERS.join(", ")} (got "${provider}")`);
}

// helper ของ eve และ AI Gateway อ่าน key จากชื่อตัวแปรตายตัวตอนเรียกโมเดล จึงคัดลอก AI_API_KEY ไปไว้ที่ชื่อนั้น
// (ไม่ทับค่าที่ตั้งไว้แล้ว)
if (apiKey) {
  if (provider === "anthropic") process.env.ANTHROPIC_API_KEY ||= apiKey;
  if (provider === "openai") process.env.OPENAI_API_KEY ||= apiKey;
  if (provider === "gateway") process.env.AI_GATEWAY_API_KEY ||= apiKey;
}

function selectModel() {
  if (provider === "anthropic") return anthropic(modelId ?? "claude-sonnet-5");
  if (provider === "openai") return openai(modelId ?? "gpt-5.6-luna");

  if (process.env.ANTHROPIC_API_KEY) return anthropic(modelId ?? "claude-sonnet-5");
  if (process.env.OPENAI_API_KEY) return openai(modelId ?? "gpt-5.6-luna");
  if (
    process.env.AI_GATEWAY_API_KEY ||
    process.env.VERCEL_OIDC_TOKEN ||
    process.env.VERCEL
  ) {
    return modelId ?? "openai/gpt-5.6-luna";
  }
  return chatgpt(modelId ?? "gpt-5.6-luna");
}

// AI_PROVIDER=gateway คืน Gateway id ผ่าน defineDynamic: eve รู้ context window ของ id นี้
// (createGateway() build ไม่ผ่านเพราะ compaction ไม่มี metadata) และ dynamic ทำให้ไฟล์นี้ถูก import
// ตอน runtime ด้วย บรรทัดที่คัดลอก key ด้านบนจึงทำงานบน server
const gatewayId = modelId ?? "openai/gpt-5.6-luna";

export default provider === "gateway"
  ? defineAgent({ model: defineDynamic({ events: { "session.started": () => gatewayId } }) })
  : defineAgent({ model: selectModel() });
