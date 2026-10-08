import { defineAgent } from "eve";
import { anthropic } from "eve/models/anthropic";
import { chatgpt, openai } from "eve/models/openai";

// เลือกโมเดลตาม API key ที่มีใน environment (เช็กตามลำดับ ตัวแรกที่เจอชนะ)
//   1. ANTHROPIC_API_KEY            → Anthropic โดยตรง      (ค่าเริ่มต้น claude-sonnet-5)
//   2. OPENAI_API_KEY               → OpenAI โดยตรง         (ค่าเริ่มต้น gpt-5.6-luna)
//   3. AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN หรือรันบน Vercel → AI Gateway (ค่าเริ่มต้น openai/gpt-5.6-luna)
//   4. ไม่มี key เลย                 → ChatGPT subscription ผ่าน /login (ใช้ได้เฉพาะ local)
// ตั้ง AI_MODEL เพื่อเปลี่ยนรุ่นภายใน provider ที่ถูกเลือก เช่น claude-haiku-5.5, gpt-5.6-sol,
// หรือ anthropic/claude-sonnet-5 (สำหรับ Gateway ต้องมี prefix provider/)
const modelId = process.env.AI_MODEL;

function selectModel() {
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

export default defineAgent({
  model: selectModel(),
});
