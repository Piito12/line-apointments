// เลือกผู้ให้บริการ (หมอ/พนักงาน) และ calendar ที่ใช้รับจอง
//
// "provider" = calendar ที่ใช้เช็คเวลาว่างและลงการจอง 1 อัน
//   - ร้านไม่แยกผู้ให้บริการ (config.staff ว่าง): provider เดียวคือ calendar ของร้าน (GOOGLE_CALENDAR_ID)
//   - ร้านแยกผู้ให้บริการ: provider ละ 1 คน ใช้ calendar ของคนนั้น
// tool จึงเขียน logic เดียวใช้ได้ทั้ง 2 แบบ

import {
  copyBookingToCalendar,
  listBusyIntervals,
  requireShopCalendarId,
  shopCalendarId,
  type BookingInput,
  type BusyResult,
  type OwnBooking,
} from "./calendar";
import { ANY_STAFF, staffForService, type BusinessConfig, type Service } from "./config";

export interface Provider {
  /** id ของผู้ให้บริการ ("" = calendar ของร้าน ไม่แยกคน) */
  id: string;
  name: string;
  calendarId: string;
}

export type ProviderPick =
  | {
      ok: true;
      providers: Provider[];
      /** สิ่งที่ลูกค้าขอ: id ของคน หรือ "any" ("" = ร้านไม่แยกผู้ให้บริการ) */
      requested: string;
    }
  | { ok: false; reason: "unknown_staff"; message: string };

/** ผู้ให้บริการที่ใช้ได้สำหรับบริการนี้ ตามที่ลูกค้าขอ (id ของคน / any / ไม่ระบุ = any) */
export function pickProviders(config: BusinessConfig, service: Service, staff?: string): ProviderPick {
  if (config.staff.length === 0) {
    return { ok: true, requested: "", providers: [{ id: "", name: "", calendarId: requireShopCalendarId() }] };
  }
  const eligible = staffForService(config, service.id).map((s) => ({ id: s.id, name: s.name, calendarId: s.calendarId }));
  const wanted = (staff ?? "").trim().toLowerCase();
  if (!wanted || wanted === ANY_STAFF) return { ok: true, requested: ANY_STAFF, providers: eligible };

  const one = eligible.find((p) => p.id === wanted);
  if (!one) {
    return {
      ok: false,
      reason: "unknown_staff",
      message: `ผู้ให้บริการ "${wanted}" ไม่ได้ทำบริการ ${service.name} ใช้ได้เฉพาะ: ${eligible.map((p) => p.id).join(", ")} หรือ ${ANY_STAFF}`,
    };
  }
  return { ok: true, requested: one.id, providers: [one] };
}

export interface ProviderBusy extends BusyResult {
  provider: Provider;
}

/**
 * อ่านช่วงไม่ว่างของหลายคนพร้อมกัน
 * คนที่อ่าน calendar ไม่ได้ (เช่น ร้านลืมแชร์ให้ service account) ถูกข้ามพร้อม log ระบบยังรับจองคนอื่นได้
 * ถ้าอ่านไม่ได้เลยสักคน throw error แรก ให้ tool ตอบว่าตรวจตารางไม่ได้
 */
export async function readProvidersBusy(
  providers: Provider[],
  timeMin: number,
  timeMax: number,
  ownFor?: (p: Provider) => OwnBooking,
): Promise<ProviderBusy[]> {
  if (providers.length === 0) throw new Error("ไม่มีผู้ให้บริการสำหรับบริการนี้");
  const results = await Promise.allSettled(
    providers.map((p) => listBusyIntervals(p.calendarId, timeMin, timeMax, ownFor?.(p))),
  );
  const ok: ProviderBusy[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") ok.push({ provider: providers[i], ...r.value });
    else console.error(`[staff] read calendar of "${providers[i].id || "shop"}" failed`, r.reason);
  });
  if (ok.length === 0) throw (results[0] as PromiseRejectedResult).reason;
  return ok;
}

/**
 * เลือก 1 คนจากคนที่ว่าง: การจองเดิมของลูกค้าคนนี้ (คำขอที่ถูกส่งซ้ำ) มาก่อน
 * ไม่งั้นคนที่มีคิวน้อยสุดในวันนั้น ถ้าเท่ากันใช้ลำดับใน Sheet
 */
export function chooseProvider(free: ProviderBusy[]): ProviderBusy {
  return free.find((f) => f.hasOwnBooking) ?? free.reduce((best, f) => (f.busy.length < best.busy.length ? f : best));
}

/**
 * ร้านที่แยกผู้ให้บริการ: เขียนสำเนาลง calendar รวม (GOOGLE_CALENDAR_ID) ถ้าตั้งไว้
 * calendar ของคนเป็นตัวจริง ถ้าเขียนสำเนาไม่สำเร็จแค่ log ไม่ทำให้การจองล้ม
 */
export async function copyToShopCalendar(provider: Provider, input: BookingInput): Promise<void> {
  const shop = shopCalendarId();
  if (!provider.id || !shop || shop === provider.calendarId) return;
  try {
    await copyBookingToCalendar(shop, { ...input, staff: { id: provider.id, name: provider.name } });
  } catch (err) {
    console.error("[staff] copy booking to shop calendar failed", err);
  }
}
