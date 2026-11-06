// Service Account ของ Google ที่ใช้ร่วมกันระหว่าง Calendar (จองคิว) และ Sheets (อ่านข้อมูลร้าน)
//
// env: GOOGLE_SERVICE_ACCOUNT_KEY = JSON ทั้งก้อนของ service account key (บรรทัดเดียว)
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

export function getServiceAccount(): ServiceAccountClient {
  if (cached) return cached;

  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!rawKey) throw new GoogleNotConfiguredError(["GOOGLE_SERVICE_ACCOUNT_KEY"]);

  let key: { client_email?: string; private_key?: string };
  try {
    key = JSON.parse(rawKey);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY ไม่ใช่ JSON ที่ถูกต้อง");
  }
  if (!key.client_email || !key.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY ไม่มี client_email หรือ private_key");
  }

  cached = new auth.JWT({ email: key.client_email, key: key.private_key, scopes: SCOPES });
  return cached;
}
