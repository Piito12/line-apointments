// Service Account ของ Google ที่ใช้ร่วมกันระหว่าง Calendar (จองคิว) และ Sheets (อ่านข้อมูลร้าน)
//
// env (เลือกอย่างใดอย่างหนึ่ง ถ้าตั้งทั้งคู่ใช้แบบแยกตัวแปร):
//   GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY = client_email และ private_key จากไฟล์ JSON key
//   GOOGLE_SERVICE_ACCOUNT_KEY               = JSON ทั้งก้อนของ service account key (บรรทัดเดียว แบบเดิม)
// scope: calendar.events (อ่าน/สร้าง/แก้ event) + spreadsheets.readonly (อ่าน Sheet อย่างเดียว)

import { auth } from "@googleapis/calendar";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

export class GoogleNotConfiguredError extends Error {
  constructor(missing: string[]) {
    super(`ยังไม่ได้ตั้งค่า ${missing.join(", ")} ใน .env.local`);
    this.name = "GoogleNotConfiguredError";
  }
}

type ServiceAccountClient = InstanceType<typeof auth.JWT>;

let cached: ServiceAccountClient | undefined;

// private key ใน env มักมาเป็น \n แบบตัวอักษร (เช่นใน .env.local หรือ copy จาก JSON)
// หรือถูกครอบด้วยเครื่องหมายคำพูดตอนวางในหน้า Vercel แปลงให้เป็น PEM หลายบรรทัด
function normalizePrivateKey(raw: string): string {
  return raw
    .trim()
    .replace(/^(["'])([\s\S]*)\1$/, "$2")
    .replace(/\\n/g, "\n");
}

function readCredentials(): { email: string; key: string } {
  const email = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim();
  if (email || privateKey) {
    if (!email) throw new GoogleNotConfiguredError(["GOOGLE_CLIENT_EMAIL"]);
    if (!privateKey) throw new GoogleNotConfiguredError(["GOOGLE_PRIVATE_KEY"]);
    const key = normalizePrivateKey(privateKey);
    if (!key.includes("PRIVATE KEY")) {
      throw new Error("GOOGLE_PRIVATE_KEY ต้องเป็นค่า private_key ทั้งหมด ตั้งแต่ -----BEGIN PRIVATE KEY-----");
    }
    return { email, key };
  }

  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) throw new GoogleNotConfiguredError(["GOOGLE_CLIENT_EMAIL", "GOOGLE_PRIVATE_KEY"]);

  let json: { client_email?: string; private_key?: string };
  try {
    json = JSON.parse(rawKey);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY ไม่ใช่ JSON ที่ถูกต้อง");
  }
  if (!json.client_email || !json.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY ไม่มี client_email หรือ private_key");
  }
  return { email: json.client_email, key: json.private_key };
}

export function getServiceAccount(): ServiceAccountClient {
  if (cached) return cached;
  const { email, key } = readCredentials();
  cached = new auth.JWT({ email, key, scopes: SCOPES });
  return cached;
}
