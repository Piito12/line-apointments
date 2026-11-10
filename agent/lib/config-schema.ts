// โครงสร้างข้อมูลร้าน (business config) + ค่าเริ่มต้น + ตัวแปลงข้อมูลจาก Google Sheet
// ไฟล์นี้ไม่เรียก network และ import แค่ zod จึงทดสอบแยกได้
// การโหลดจริงและ cache อยู่ใน config.ts

import { z } from "zod";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
/** รูปแบบ id ของบริการและผู้ให้บริการ (ฝังใน postback ของปุ่ม LINE จึงจำกัดตัวอักษร) */
export const ID_PATTERN = /^[a-z0-9_-]{1,40}$/;

/** ค่า staff ที่แปลว่า "ใครก็ได้ที่ว่าง" (ระบบเลือกคนที่มีคิวน้อยสุดในวันนั้น) */
export const ANY_STAFF = "any";

export interface Service {
  id: string;
  name: string;
  minutes: number;
  /** ให้ลูกค้าเลือกผู้ให้บริการเองไหม (มีผลเมื่อมีคนทำบริการนี้ได้มากกว่า 1 คน) false = ระบบเลือกให้ */
  chooseStaff: boolean;
}

/** ผู้ให้บริการ (หมอ/พนักงาน) 1 คน = 1 Google Calendar */
export interface Staff {
  id: string;
  name: string;
  calendarId: string;
  /** id ของบริการที่ทำได้ หรือ "all" = ทุกบริการ */
  serviceIds: string[] | "all";
}

export interface BookingRules {
  /** เวลาเปิด-ปิด HH:mm (เวลาไทย) */
  openTime: string;
  closeTime: string;
  /** วันปิดประจำ ตามเลขวันของ Date#getUTCDay (0 = อาทิตย์, 1 = จันทร์, ...) */
  closedWeekdays: number[];
  /** เวลาเริ่มของแต่ละคิวลงทุกๆ กี่นาที เช่น 30 → 10:00, 10:30 */
  slotStepMinutes: number;
  /** จองล่วงหน้าได้สูงสุดกี่วัน นับรวมวันนี้ */
  bookingWindowDays: number;
  /** ต้องจองก่อนเวลานัดอย่างน้อยกี่นาที */
  minLeadMinutes: number;
}

export interface BusinessConfig {
  businessName: string;
  businessType: string;
  /** ช่องทางติดต่อร้าน เช่น เบอร์โทร แสดงในการ์ดยืนยันการจองและให้ agent แนะนำลูกค้า */
  contact: string;
  rules: BookingRules;
  services: Service[];
  /**
   * ผู้ให้บริการที่ active (เฉพาะคนที่เปิดรับจอง)
   * ว่าง = ร้านไม่แยกผู้ให้บริการ: รับจองลง GOOGLE_CALENDAR_ID ตัวเดียวแบบเดิม
   */
  staff: Staff[];
  /** คำสั่งเพิ่มเติมสำหรับ agent เฉพาะธุรกิจ เช่น ข้อห้าม (ต่อท้าย instructions หลัก) */
  extraInstructions: string;
}

/** ใช้เมื่อยังไม่ได้ตั้ง CONFIG_SHEET_ID: ข้อมูลคลินิกสมมติของ PoC เดิม */
export const DEFAULT_CONFIG: BusinessConfig = {
  businessName: "คลินิกทำหน้า",
  businessType: "คลินิกความงาม",
  contact: "",
  rules: {
    openTime: "10:00",
    closeTime: "20:00",
    closedWeekdays: [1],
    slotStepMinutes: 30,
    bookingWindowDays: 14,
    minLeadMinutes: 60,
  },
  services: [
    { id: "consultation", name: "ปรึกษาแพทย์ผิวหนัง", minutes: 30, chooseStaff: true },
    { id: "facial", name: "ทรีตเมนต์หน้าใส / Facial", minutes: 60, chooseStaff: true },
    { id: "laser", name: "เลเซอร์ผิวหน้า", minutes: 45, chooseStaff: true },
    { id: "botox", name: "โบท็อกซ์", minutes: 30, chooseStaff: true },
    { id: "filler", name: "ฟิลเลอร์", minutes: 45, chooseStaff: true },
  ],
  staff: [],
  extraInstructions: [
    "- ไม่วินิจฉัยหรือให้คำแนะนำทางการแพทย์ ไม่รับประกันผลลัพธ์ของการรักษา คำถามเรื่องอาการ ผลข้างเคียง หรือความเหมาะสมของทรีตเมนต์ ให้แนะนำนัดปรึกษาแพทย์",
    "- ห้ามขอประวัติการรักษาหรือข้อมูลสุขภาพ",
  ].join("\n"),
};

// ---------- ค้นหา ----------

/** หาบริการจาก id ที่โมเดลส่งมา */
export function findService(config: BusinessConfig, id: string): Service | undefined {
  return config.services.find((s) => s.id === id.trim().toLowerCase());
}

export function canServe(staff: Staff, serviceId: string): boolean {
  return staff.serviceIds === "all" || staff.serviceIds.includes(serviceId);
}

/** ผู้ให้บริการที่ทำบริการนี้ได้ เรียงตามลำดับใน Sheet */
export function staffForService(config: BusinessConfig, serviceId: string): Staff[] {
  return config.staff.filter((s) => canServe(s, serviceId));
}

export function findStaff(config: BusinessConfig, id: string): Staff | undefined {
  return config.staff.find((s) => s.id === id.trim().toLowerCase());
}

// ---------- แปลงค่าจาก Sheet ----------

const WEEKDAY_NAMES: Record<string, number> = {
  อาทิตย์: 0, จันทร์: 1, อังคาร: 2, พุธ: 3, พฤหัส: 4, พฤหัสบดี: 4, ศุกร์: 5, เสาร์: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/** "จันทร์, อังคาร" / "mon,tue" / "1,2" → [1, 2] */
export function parseWeekdays(raw: string): number[] {
  const out = new Set<number>();
  for (const part of raw.split(/[,\s]+/).map((s) => s.trim().toLowerCase().replace(/^วัน/, ""))) {
    if (!part) continue;
    const n = /^[0-6]$/.test(part) ? Number(part) : WEEKDAY_NAMES[part];
    if (n === undefined) throw new Error(`ไม่รู้จักวัน "${part}" (ใช้ชื่อวันไทย เช่น จันทร์ หรือ mon)`);
    out.add(n);
  }
  return [...out].sort();
}

/** Sheet อาจแปลง 10:00 เป็นเวลาและคืน "10:00:00" หรือ "9:00" จึงปรับเป็น HH:mm */
export function normalizeTime(raw: string): string {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(raw.trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : raw.trim();
}

const TRUE_WORDS = new Set(["true", "yes", "y", "1", "ใช่", "เปิด"]);
const FALSE_WORDS = new Set(["false", "no", "n", "0", "ไม่", "ไม่ใช่", "ปิด"]);

/** ช่อง TRUE/FALSE (checkbox ของ Sheet ส่งมาเป็น "TRUE"/"FALSE") เว้นว่างใช้ fallback */
export function parseBool(raw: string, fallback: boolean): boolean {
  const s = raw.trim().toLowerCase();
  if (s === "") return fallback;
  if (TRUE_WORDS.has(s)) return true;
  if (FALSE_WORDS.has(s)) return false;
  throw new Error(`ต้องเป็น TRUE หรือ FALSE (ได้ "${raw.trim()}")`);
}

const rulesSchema = z
  .object({
    openTime: z.string().regex(TIME, "ต้องเป็นเวลา HH:mm เช่น 10:00"),
    closeTime: z.string().regex(TIME, "ต้องเป็นเวลา HH:mm เช่น 20:00"),
    closedWeekdays: z.array(z.number().int().min(0).max(6)),
    slotStepMinutes: z.number({ error: "ต้องเป็นตัวเลข" }).int().min(5).max(240),
    bookingWindowDays: z.number({ error: "ต้องเป็นตัวเลข" }).int().min(1).max(365),
    minLeadMinutes: z.number({ error: "ต้องเป็นตัวเลข" }).int().min(0).max(7 * 24 * 60),
  })
  .refine((r) => r.openTime < r.closeTime, { message: "close_time ต้องหลัง open_time", path: ["closeTime"] });

const configSchema = z.object({
  businessName: z.string().min(1, "ต้องใส่ business_name"),
  businessType: z.string(),
  contact: z.string(),
  rules: rulesSchema,
  services: z
    .array(
      z.object({
        id: z.string().regex(ID_PATTERN, "id ใช้ได้แค่ a-z 0-9 _ - (ตัวพิมพ์เล็ก)"),
        name: z.string().min(1, "ต้องใส่ชื่อบริการ"),
        minutes: z.number({ error: "ต้องเป็นตัวเลข (จำนวนนาที)" }).int().min(5, "อย่างน้อย 5 นาที").max(24 * 60),
        chooseStaff: z.boolean(),
      }),
    )
    .min(1, "ต้องมีบริการอย่างน้อย 1 รายการ")
    .refine((s) => new Set(s.map((x) => x.id)).size === s.length, "id ของบริการซ้ำกัน"),
  extraInstructions: z.string(),
});

export class ConfigInvalidError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`ข้อมูลร้านใน Sheet ไม่ถูกต้อง:\n- ${problems.join("\n- ")}`);
    this.name = "ConfigInvalidError";
    this.problems = problems;
  }
}

/** ชื่อ field ในโค้ด → ชื่อ key ในแท็บ settings (ใช้ในข้อความ error ให้ร้านหาเจอ) */
const SETTING_KEYS: Record<string, string> = {
  businessName: "business_name",
  businessType: "business_type",
  contact: "contact",
  extraInstructions: "extra_instructions",
  openTime: "open_time",
  closeTime: "close_time",
  closedWeekdays: "closed_weekdays",
  slotStepMinutes: "slot_step_minutes",
  bookingWindowDays: "booking_window_days",
  minLeadMinutes: "min_lead_minutes",
};

/** ชื่อแท็บใน Sheet (ต้องตรงกับ template) staff ไม่บังคับ */
export const SHEET_TABS = { settings: "settings", services: "services", staff: "staff" } as const;

type Rows = string[][];

function toNumber(raw: string | undefined, fallback: number): number {
  const s = (raw ?? "").trim();
  return s === "" ? fallback : Number(s);
}

function headerIndex(rows: Rows): (name: string) => number {
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  return (name) => header.indexOf(name);
}

/** แถวที่มีข้อมูล (ข้ามหัวตารางและแถวว่าง) พร้อมเลขแถวจริงใน Sheet สำหรับข้อความ error */
function dataRows(rows: Rows): { row: string[]; sheetRow: number }[] {
  return rows
    .map((row, i) => ({ row, sheetRow: i + 1 }))
    .slice(1)
    .filter(({ row }) => row.some((c) => (c ?? "").trim() !== ""));
}

/**
 * แท็บ staff: หัวตาราง id | name | calendar_id | services | active
 *   services: id บริการคั่นด้วยจุลภาค หรือ * = ทุกบริการ
 *   active:   FALSE = พักรับจอง (ไม่ต้องลบแถว) เว้นว่าง = TRUE
 * ไม่มีแท็บ หรือมีแค่หัวตาราง → [] (ร้านไม่แยกผู้ให้บริการ)
 */
export function parseStaff(staffRows: Rows, serviceIds: string[]): { staff: Staff[]; problems: string[] } {
  const problems: string[] = [];
  const staff: Staff[] = [];
  const col = headerIndex(staffRows);
  const [idCol, nameCol, calCol, svcCol, activeCol] = ["id", "name", "calendar_id", "services", "active"].map(col);
  // นับเป็นแถวข้อมูลเฉพาะเมื่อคอลัมน์ข้อมูลมีค่า (คอลัมน์คำอธิบายข้างๆ ไม่ทำให้แถวว่างกลายเป็นคนใหม่)
  const dataCols = [idCol, nameCol, calCol, svcCol].filter((c) => c >= 0);
  const rows = dataRows(staffRows).filter(({ row }) => dataCols.length < 4 || dataCols.some((c) => (row[c] ?? "").trim() !== ""));
  if (rows.length === 0) return { staff, problems };

  if (idCol < 0 || nameCol < 0 || calCol < 0 || svcCol < 0) {
    problems.push(`แท็บ ${SHEET_TABS.staff} ต้องมีหัวคอลัมน์ id, name, calendar_id, services ในแถวแรก`);
    return { staff, problems };
  }

  const knownServices = new Set(serviceIds);
  const seenIds = new Set<string>();
  const seenCalendars = new Set<string>();
  for (const { row, sheetRow } of rows) {
    const where = `${SHEET_TABS.staff} แถว ${sheetRow}`;
    const cell = (c: number) => (c >= 0 ? (row[c] ?? "") : "").trim();

    let active: boolean;
    try {
      active = parseBool(cell(activeCol), true);
    } catch (err) {
      problems.push(`${where} (active): ${(err as Error).message}`);
      continue;
    }
    if (!active) continue;

    const id = cell(idCol).toLowerCase();
    const name = cell(nameCol);
    const calendarId = cell(calCol);
    const rawServices = cell(svcCol);
    const rowProblems: string[] = [];

    if (!ID_PATTERN.test(id) || id === ANY_STAFF) rowProblems.push(`(id) ใช้ได้แค่ a-z 0-9 _ - (ตัวพิมพ์เล็ก) และห้ามใช้คำว่า ${ANY_STAFF}`);
    else if (seenIds.has(id)) rowProblems.push(`(id) "${id}" ซ้ำกับแถวก่อนหน้า`);
    if (!name) rowProblems.push("(name) ต้องใส่ชื่อ");
    if (!calendarId) rowProblems.push("(calendar_id) ต้องใส่ calendar ID");
    // calendar เดียวกันใช้ 2 คนไม่ได้: คิวเวลาเดียวกันของ 2 คนจะชนกันเอง
    else if (seenCalendars.has(calendarId)) rowProblems.push("(calendar_id) ซ้ำกับคนอื่น แต่ละคนต้องมี calendar ของตัวเอง");

    let ids: string[] | "all" = "all";
    if (rawServices !== "*") {
      ids = [...new Set(rawServices.split(/[,\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
      if (ids.length === 0) rowProblems.push("(services) ต้องใส่ id บริการ หรือ * = ทุกบริการ");
      const unknown = ids.filter((s) => !knownServices.has(s));
      if (unknown.length > 0) rowProblems.push(`(services) ไม่มีบริการ id: ${unknown.join(", ")}`);
    }

    seenIds.add(id);
    if (calendarId) seenCalendars.add(calendarId);
    if (rowProblems.length > 0) {
      problems.push(...rowProblems.map((p) => `${where} ${p}`));
      continue;
    }
    staff.push({ id, name, calendarId, serviceIds: ids });
  }

  if (problems.length === 0) {
    if (staff.length === 0) {
      problems.push(`แท็บ ${SHEET_TABS.staff} ไม่มีผู้ให้บริการที่ active เลย (ถ้าไม่แยกผู้ให้บริการ ให้ลบแถวข้อมูลออกให้เหลือแค่หัวตาราง)`);
    } else {
      for (const serviceId of serviceIds) {
        if (!staff.some((s) => canServe(s, serviceId))) {
          problems.push(`บริการ "${serviceId}" ยังไม่มีผู้ให้บริการที่ active ในแท็บ ${SHEET_TABS.staff}`);
        }
      }
    }
  }
  return { staff, problems };
}

/**
 * แปลงค่าจากแท็บต่างๆ เป็น BusinessConfig
 *   settings: แถวแรกเป็นหัวตาราง จากนั้นคอลัมน์ A = key, B = value (คอลัมน์อื่นเป็นคำอธิบาย ไม่อ่าน)
 *   services: แถวแรกเป็นหัวตาราง id | name | minutes | choose_staff (อ่านตามชื่อหัวคอลัมน์ ลำดับสลับได้)
 *   staff:    ไม่บังคับ ดู parseStaff
 * ค่าที่เว้นว่างใน settings ใช้ค่าเริ่มต้นของ DEFAULT_CONFIG.rules
 */
export function parseSheetConfig(settingsRows: Rows, serviceRows: Rows, staffRows: Rows = []): BusinessConfig {
  const problems: string[] = [];
  const settings = new Map<string, string>();
  for (const row of settingsRows.slice(1)) {
    const key = (row[0] ?? "").trim();
    if (key) settings.set(key, (row[1] ?? "").trim());
  }
  const get = (key: string) => settings.get(key) ?? "";
  const d = DEFAULT_CONFIG.rules;

  let closedWeekdays = d.closedWeekdays;
  if (settings.has("closed_weekdays")) {
    try {
      closedWeekdays = parseWeekdays(get("closed_weekdays"));
    } catch (err) {
      problems.push(`settings.closed_weekdays: ${(err as Error).message}`);
    }
  }

  const col = headerIndex(serviceRows);
  const [idCol, nameCol, minCol, chooseCol] = [col("id"), col("name"), col("minutes"), col("choose_staff")];
  if (idCol < 0 || nameCol < 0 || minCol < 0) {
    problems.push(`แท็บ ${SHEET_TABS.services} ต้องมีหัวคอลัมน์ id, name, minutes ในแถวแรก`);
  }
  const serviceRowsWithData = dataRows(serviceRows);
  const services = serviceRowsWithData.map(({ row, sheetRow }) => {
    let chooseStaff = true;
    try {
      chooseStaff = parseBool(chooseCol >= 0 ? (row[chooseCol] ?? "") : "", true);
    } catch (err) {
      problems.push(`${SHEET_TABS.services} แถว ${sheetRow} (choose_staff): ${(err as Error).message}`);
    }
    return {
      id: (row[idCol] ?? "").trim().toLowerCase(),
      name: (row[nameCol] ?? "").trim(),
      minutes: toNumber(row[minCol], NaN),
      chooseStaff,
    };
  });

  const candidate = {
    businessName: get("business_name"),
    businessType: get("business_type"),
    contact: get("contact"),
    rules: {
      openTime: settings.get("open_time") ? normalizeTime(get("open_time")) : d.openTime,
      closeTime: settings.get("close_time") ? normalizeTime(get("close_time")) : d.closeTime,
      closedWeekdays,
      slotStepMinutes: toNumber(settings.get("slot_step_minutes"), d.slotStepMinutes),
      bookingWindowDays: toNumber(settings.get("booking_window_days"), d.bookingWindowDays),
      minLeadMinutes: toNumber(settings.get("min_lead_minutes"), d.minLeadMinutes),
    },
    services,
    extraInstructions: get("extra_instructions"),
  };

  const parsed = configSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [first, index, field] = issue.path;
      const where =
        first === "services"
          ? typeof index === "number"
            ? `${SHEET_TABS.services} แถว ${serviceRowsWithData[index]?.sheetRow}${field ? ` (${String(field)})` : ""}`
            : `แท็บ ${SHEET_TABS.services}`
          : `${SHEET_TABS.settings}.${SETTING_KEYS[issue.path.map(String).reverse().find((k) => k in SETTING_KEYS) ?? ""] ?? issue.path.join(".")}`;
      problems.push(`${where}: ${issue.message}`);
    }
  }

  const staff = parseStaff(staffRows, services.map((s) => s.id).filter((id) => ID_PATTERN.test(id)));
  problems.push(...staff.problems);

  if (problems.length > 0 || !parsed.success) throw new ConfigInvalidError(problems);
  return { ...parsed.data, staff: staff.staff };
}
