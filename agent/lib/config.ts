// โหลดข้อมูลร้าน (business config)
//
//   - ไม่ได้ตั้ง CONFIG_SHEET_ID  → ใช้ DEFAULT_CONFIG (คลินิกสมมติของ PoC)
//   - ตั้ง CONFIG_SHEET_ID        → อ่านจาก Google Sheet ผ่าน service account ตัวเดียวกับ Calendar
//                                   (ต้องแชร์ Sheet ให้ client_email ของ service account อย่างน้อยสิทธิ์ Viewer
//                                    และเปิด Google Sheets API ใน Google Cloud project)
//
// เก็บค่าไว้ CACHE_TTL_MS: แก้ Sheet แล้วมีผลภายในเวลานั้น
// ถ้าอ่าน Sheet ไม่ได้หรือข้อมูลผิด จะใช้ค่าที่ถูกต้องล่าสุดต่อ (และเขียน log)
// ถ้ายังไม่เคยอ่านสำเร็จเลย จะ throw ConfigUnavailableError ให้ tool ตอบว่าระบบยังไม่พร้อม
// (ไม่ fallback เป็นข้อมูลคลินิกสมมติ เพราะจะเสนอบริการที่ร้านจริงไม่มี)

import { DEFAULT_CONFIG, SHEET_TABS, parseSheetConfig, type BusinessConfig } from "./config-schema";
import { getServiceAccount } from "./google";

export * from "./config-schema";

const CACHE_TTL_MS = 60_000;

export class ConfigUnavailableError extends Error {
  constructor(cause: unknown) {
    super(`โหลดข้อมูลร้านจาก Google Sheet ไม่สำเร็จ: ${(cause as Error)?.message ?? cause}`);
    this.name = "ConfigUnavailableError";
  }
}

let lastGood: { config: BusinessConfig; loadedAt: number } | undefined;
let inflight: Promise<BusinessConfig> | undefined;

interface BatchGetResponse {
  valueRanges?: { values?: string[][] }[];
}

async function fetchSheetConfig(sheetId: string): Promise<BusinessConfig> {
  const params = new URLSearchParams();
  params.append("ranges", SHEET_TABS.settings);
  params.append("ranges", SHEET_TABS.services);
  const res = await getServiceAccount().request<BatchGetResponse>({
    url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values:batchGet?${params}`,
  });
  const [settings, services] = res.data.valueRanges ?? [];
  return parseSheetConfig(settings?.values ?? [], services?.values ?? []);
}

export async function getConfig(): Promise<BusinessConfig> {
  const sheetId = process.env.CONFIG_SHEET_ID?.trim();
  if (!sheetId) return DEFAULT_CONFIG;

  if (lastGood && Date.now() - lastGood.loadedAt < CACHE_TTL_MS) return lastGood.config;

  // หลาย tool/turn เรียกพร้อมกัน: ยิง Sheet ครั้งเดียว
  inflight ??= fetchSheetConfig(sheetId)
    .then((config) => {
      lastGood = { config, loadedAt: Date.now() };
      return config;
    })
    .finally(() => {
      inflight = undefined;
    });

  try {
    return await inflight;
  } catch (err) {
    console.error("[config] load from Google Sheet failed", err);
    if (lastGood) {
      // เลื่อนเวลาลองใหม่ออกไปอีกรอบ จะได้ไม่ยิง Sheet ทุกข้อความระหว่างที่ Sheet มีปัญหา
      lastGood = { ...lastGood, loadedAt: Date.now() };
      return lastGood.config;
    }
    throw new ConfigUnavailableError(err);
  }
}

/** หาบริการจาก id ที่โมเดลส่งมา */
export function findService(config: BusinessConfig, id: string) {
  return config.services.find((s) => s.id === id.trim().toLowerCase());
}
