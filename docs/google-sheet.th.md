# ตั้งค่าข้อมูลร้าน (Google Sheet)

[← กลับ README](../README.md#ภาษาไทย) · [English](google-sheet.md)


ชื่อร้าน บริการ เวลาทำการ วันปิด และกฎเฉพาะของร้าน ตั้งค่าได้ใน Google Sheet โดยไม่ต้องแก้โค้ดหรือ deploy ใหม่ agent อ่านด้วย Service Account ตัวเดียวกับ Google Calendar

### 1. สร้าง Sheet จาก template

1. ดาวน์โหลด [`templates/business-config-template.xlsx`](../templates/business-config-template.xlsx)
2. เปิด [Google Drive](https://drive.google.com/) → **New → File upload** → เลือกไฟล์ → เปิดไฟล์ → **File → Save as Google Sheets**
3. แก้ข้อมูลในแท็บ `settings`, `services`, `staff` ถ้าแยกหมอ/พนักงาน และ `closures` ถ้ามีวันปิด/เปิดพิเศษ (แท็บ `วิธีใช้` อธิบายแต่ละช่อง) **ห้ามเปลี่ยนชื่อแท็บ คอลัมน์ `key` และหัวตาราง**

| แท็บ | เก็บอะไร |
|---|---|
| `settings` | `business_name` (บังคับ), `business_type`, `contact`, `open_time`, `close_time`, `closed_weekdays` (เช่น `จันทร์, อังคาร`), `slot_step_minutes`, `booking_window_days`, `min_lead_minutes`, `holiday_calendar` (ดู [วันหยุด](google-sheet.th.md#วันหยุดและวันปิดเปิดพิเศษ-แท็บ-closures)), `extra_instructions` (กฎเฉพาะร้าน เช่น ห้ามให้คำแนะนำทางการแพทย์) ช่องตัวเลขหรือเวลาที่เว้นว่างจะใช้ค่าเริ่มต้น |
| `services` | `id` (a-z 0-9 _ - ห้ามซ้ำ ลูกค้าไม่เห็น), `name` (ชื่อที่ลูกค้าเห็น), `minutes` (ระยะเวลาต่อคิว), `choose_staff` (TRUE = ให้ลูกค้าเลือกหมอ/พนักงานเอง, FALSE = ระบบเลือกให้ เว้นว่าง = TRUE) |
| `staff` | ไม่บังคับ ดู [แยกหมอ/พนักงาน](google-sheet.th.md#แยกหมอพนักงาน-แท็บ-staff) |
| `closures` | ไม่บังคับ ดู [วันหยุดและวันปิด/เปิดพิเศษ](google-sheet.th.md#วันหยุดและวันปิดเปิดพิเศษ-แท็บ-closures) |

### 2. เปิด Google Sheets API และแชร์ Sheet

1. Google Cloud Console (project เดียวกับ Calendar) → **APIs & Services → Library** → ค้นหา **Google Sheets API** → **Enable**
2. ใน Sheet กด **Share** → ใส่ `client_email` ของ service account → สิทธิ์ **Viewer**
3. คัดลอก Sheet ID จาก URL `https://docs.google.com/spreadsheets/d/<Sheet ID>/edit`

### 3. ใส่ค่าใน env

```bash
CONFIG_SHEET_ID=<Sheet ID>
```

local ใส่ใน `.env.local` แล้ว restart `npm run dev` บน Vercel เพิ่มใน Environment Variables แล้ว Redeploy (ครั้งเดียว หลังจากนั้นแก้แค่ Sheet)

### พฤติกรรม

- แก้ Sheet แล้ว agent เห็นค่าใหม่ภายใน **1 นาที** (cache ไว้เพื่อไม่ยิง Sheet ทุกข้อความ) และใช้ค่าใหม่ทันทีแม้ในแชทเดิมที่เคยตอบค่าเก่าไปแล้ว
- ถ้ากรอกผิด เช่น เวลาปิดก่อนเวลาเปิด หรือ `minutes` ไม่ใช่ตัวเลข agent ใช้ค่าที่ถูกต้องล่าสุดต่อ และเขียนสาเหตุพร้อมเลขแถวใน log เช่น `services แถว 4 (minutes): ต้องเป็นตัวเลข (จำนวนนาที)`
- ถ้าตั้ง `CONFIG_SHEET_ID` แต่อ่าน Sheet ไม่ได้ตั้งแต่ครั้งแรก agent จะบอกลูกค้าว่าระบบขัดข้องชั่วคราว (ไม่ใช้ข้อมูลคลินิกสมมติแทน เพราะจะเสนอบริการที่ร้านไม่มี)
- persona และกฎกลาง (เช่น ห้ามแต่งเวลาว่าง) อยู่ใน `agent/instructions.md` ใช้ได้กับทุกธุรกิจ ส่วนข้อมูลร้านถูกสร้างจาก Sheet ทุก turn

### แยกหมอ/พนักงาน (แท็บ `staff`)

ไม่บังคับ ถ้าแท็บ `staff` มีแค่หัวตาราง ระบบรับจองลง `GOOGLE_CALENDAR_ID` ตัวเดียวแบบเดิม ถ้าใส่รายชื่อ ลูกค้าเลือกคนได้ใน LINE และการจองลง calendar ของคนนั้น

| คอลัมน์ | ความหมาย |
|---|---|
| `id` | a-z 0-9 _ - ห้ามซ้ำ ห้ามใช้ `any` (ลูกค้าไม่เห็น) |
| `name` | ชื่อที่ลูกค้าเห็น เช่น หมอเอ |
| `calendar_id` | Google Calendar ของคนนั้น (Google Calendar → Settings → Integrate calendar → Calendar ID) แต่ละคนต้องมี calendar ของตัวเอง |
| `services` | id บริการคั่นด้วยจุลภาค เช่น `botox, filler` หรือ `*` = ทำได้ทุกบริการ ทุกบริการต้องมีอย่างน้อย 1 คน |
| `active` | `FALSE` = พักรับจองชั่วคราว เว้นว่าง = `TRUE` |

ขั้นตอน:

1. สร้าง calendar ให้แต่ละคน แล้วแชร์ให้ `client_email` ของ service account สิทธิ์ **Make changes to events** (ถ้าลืมแชร์ คนนั้นจะไม่ถูกเสนอให้จอง และมี log `[staff] read calendar of "<id>" failed`)
2. ใส่รายชื่อในแท็บ `staff` และตั้ง `choose_staff` ในแท็บ `services`

พฤติกรรม:

- **ลูกค้าเลือกคน**: บริการที่ `choose_staff` = TRUE และมีคนทำได้มากกว่า 1 คน จะมีการ์ดปุ่มให้เลือกคน หรือ "ใครก็ได้ที่ว่าง" ถ้าเป็น FALSE หรือมีคนเดียว ระบบข้ามขั้นนี้
- **ใครก็ได้**: เสนอเวลาที่มีอย่างน้อย 1 คนว่าง ตอนจองเลือกคนที่ว่างและมีคิวน้อยสุดในวันนั้น (เท่ากันใช้ลำดับในแท็บ) ถ้าคนนั้นถูกจองตัดหน้า ระบบสลับไปคนอื่นที่ว่างให้เอง
- **เวลาทำงาน**: ทุกคนใช้เวลาเปิด-ปิดของร้าน ถ้าใครลาหรือไม่เข้างาน ให้ลง event ใน calendar ของคนนั้น ช่วงนั้นจะไม่เปิดให้จอง
- **calendar รวม**: ถ้าตั้ง `GOOGLE_CALENDAR_ID` ไว้ ทุกการจองจะถูกคัดลอกไปที่ calendar นี้ด้วย (ชื่อ event มีชื่อผู้ให้บริการ) ใช้ดูภาพรวมเท่านั้น ระบบเช็คเวลาว่างจาก calendar ของแต่ละคน **ยกเลิกหรือเลื่อนนัดต้องแก้ใน calendar ของคนนั้น** การแก้ใน calendar รวมไม่ sync กลับ

### วันหยุดและวันปิด/เปิดพิเศษ (แท็บ `closures`)

ร้านปิดตามวันหยุดนักขัตฤกษ์ไทยอัตโนมัติ (Google calendar `th.th#holiday@group.v.calendar.google.com` เฉพาะ event ที่เป็น "วันหยุดนักขัตฤกษ์" ไม่รวม "วันสำคัญ" อย่างวาเลนไทน์หรือตรุษจีน) agent จะไม่เสนอคิวและไม่รับจองในวันนั้น และบอกลูกค้าว่าปิดเพราะอะไร

`settings.holiday_calendar`: เว้นว่าง = วันหยุดไทย, `none` = ไม่ปิดตามวันหยุด, หรือใส่ Calendar ID ของร้านเอง (ทุก event ทั้งวันในนั้น = ปิด แชร์ให้ `client_email` ด้วย)

แท็บ `closures` (ไม่บังคับ) ใช้ตั้งข้อยกเว้นรายวัน 1 วัน 1 แถว:

| คอลัมน์ | ความหมาย |
|---|---|
| `date` | วันที่ `2026-12-31` (รับ `31/12/2026` หรือปี พ.ศ. ได้) |
| `type` | `closed` (ปิด) = ปิดทั้งวัน / `open` (เปิด) = เปิด แม้เป็นวันหยุดหรือวันปิดประจำสัปดาห์ |
| `open_time`, `close_time` | ใช้กับ `open` เท่านั้น ใส่ทั้งคู่ = เวลาทำการพิเศษวันนั้น (เช่น ปิดครึ่งวัน = `open 10:00 14:00`) เว้นว่าง = เวลาปกติ |
| `note` | เหตุผลที่ agent ใช้บอกลูกค้า |

ลำดับการตัดสิน (กฎแรกที่ตรงชนะ): แท็บ `closures` → วันหยุดจาก calendar → `closed_weekdays` → เวลาทำการปกติ

- วันหยุดถูก cache 6 ชั่วโมง ถ้าดึง calendar วันหยุดไม่ได้ ระบบรับจองต่อโดยไม่ปิดตามวันหยุด และเขียน log `[holidays] load holiday calendar ... failed` (แท็บ `closures` และวันปิดประจำยังมีผล)
- วันปิด/เปิดพิเศษในช่วงที่จองได้จะถูกใส่ในข้อมูลร้านให้ agent ทุก turn ลูกค้าถามว่า "สงกรานต์เปิดไหม" ได้

| อาการ | สาเหตุที่เป็นไปได้ |
|---|---|
| log `โหลดข้อมูลร้านจาก Google Sheet ไม่สำเร็จ` + 403 | ยังไม่ได้ Enable Google Sheets API หรือยังไม่ได้แชร์ Sheet ให้ `client_email` |
| log 404 / `Unable to parse range` | `CONFIG_SHEET_ID` ผิด หรือเปลี่ยนชื่อแท็บ `settings` / `services` |
| log 400 `must not be an Office file` | `CONFIG_SHEET_ID` เป็นไฟล์ .xlsx ที่ยังไม่ได้แปลง เปิดไฟล์แล้วกด **File → Save as Google Sheets** แล้วใช้ ID ของไฟล์ใหม่ |
| log `ข้อมูลร้านใน Sheet ไม่ถูกต้อง` | ดูรายการปัญหาและเลขแถวใน log แล้วแก้ใน Sheet |
| แก้ Sheet แล้วยังเห็นค่าเก่า | รอไม่เกิน 1 นาที หรือ restart server ถ้า agent ยังตอบค่าเก่าในแชทเดิม ให้พิมพ์ `เริ่มใหม่` ใน LINE |
