# ตั้งค่า Google Calendar

[← กลับ README](../README.md#ภาษาไทย) · [English](google-calendar.md)


agent ใช้ Google Calendar 1 ปฏิทินเป็นตารางคิวของคลินิก tool `get_available_slots` อ่าน event เพื่อหาเวลาว่าง และ `book_appointment` สร้าง event เมื่อลูกค้ากดยืนยัน เชื่อมต่อด้วย **Service Account** (บัญชีสำหรับระบบ ไม่ต้อง login Google ของใคร)

### 1. เปิด Google Calendar API

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/) → สร้าง project ใหม่ (หรือใช้ project เดิม)
2. **APIs & Services → Library** → ค้นหา **Google Calendar API** → **Enable**

### 2. สร้าง Service Account และ key

1. **APIs & Services → Credentials → Create credentials → Service account** → ตั้งชื่อ (เช่น `clinic-agent`) → **Done** ไม่ต้องให้ role ใดๆ
2. คลิก service account ที่สร้าง → แท็บ **Keys → Add key → Create new key → JSON** → ไฟล์ `.json` จะถูกดาวน์โหลด
3. จดค่า `client_email` ในไฟล์ไว้ (หน้าตาแบบ `clinic-agent@<project>.iam.gserviceaccount.com`) ใช้ในขั้นที่ 3

> ⚠️ ไฟล์ key คือรหัสผ่านของ service account **ห้ามวางไว้ในโฟลเดอร์โปรเจกต์หรือ commit** ใส่ค่าลง env แล้วลบไฟล์ทิ้งหรือเก็บไว้ที่ปลอดภัย

### 3. สร้างปฏิทินและแชร์ให้ Service Account

1. เปิด [Google Calendar](https://calendar.google.com/) → ข้าง **Other calendars** กด **+ → Create new calendar** → ตั้งชื่อ (เช่น `คลินิก - ทดสอบ`) แนะนำให้แยกจากปฏิทินส่วนตัว
2. เข้า **Settings** ของปฏิทินนั้น → **Share with specific people or groups → Add people** → ใส่ `client_email` จากขั้นที่ 2 → สิทธิ์ **Make changes to events**
3. เลื่อนลงไปที่หัวข้อ **Integrate calendar** → คัดลอก **Calendar ID** (หน้าตาแบบ `xxxxxxxx@group.calendar.google.com`)

### 4. ใส่ค่าใน env

```bash
GOOGLE_CLIENT_EMAIL=clinic-agent@<project>.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=xxxxxxxx@group.calendar.google.com
```

- คัดลอก 2 ค่าจากไฟล์ JSON: `client_email` → `GOOGLE_CLIENT_EMAIL` และ `private_key` → `GOOGLE_PRIVATE_KEY` ดูค่าได้ด้วย `jq -r .client_email key.json` และ `jq .private_key key.json`
- `GOOGLE_PRIVATE_KEY` ต้องเป็นค่า**ทั้งหมด** ตั้งแต่ `-----BEGIN PRIVATE KEY-----` จนถึง `-----END PRIVATE KEY-----\n` ใน `.env.local` ให้คง `\n` ไว้และครอบด้วยเครื่องหมายคำพูด ส่วนบน Vercel วางแบบมี `\n` หรือขึ้นบรรทัดจริงก็ได้
- แบบเดิมยังใช้ได้: `GOOGLE_SERVICE_ACCOUNT_KEY` = JSON ทั้งก้อนในบรรทัดเดียว (`jq -c . key.json`) ถ้าตั้งทั้งสองแบบ ระบบใช้แบบแยก 2 ตัวแปร
- local ใส่ใน `.env.local` แล้ว restart `npm run dev` ส่วนบน Vercel เพิ่มทีละค่าใน Environment Variables แล้ว Redeploy

### 5. ทดสอบ

ถาม agent ว่า "พรุ่งนี้มีคิวโบท็อกซ์ว่างไหม" ต้องได้การ์ดเวลาว่าง จองแล้วต้องเห็น event ชื่อ `<บริการ> - <ชื่อเล่น>` ในปฏิทิน (description มีบริการ ชื่อเล่น เบอร์โทร)

### กติกาที่ agent ใช้กับปฏิทิน

- event ใดๆ ในปฏิทินที่ไม่ได้ตั้งเป็น **Free** ถือว่าเวลานั้นไม่ว่าง (รับทีละ 1 คิว) จะบล็อกเวลาเอง เช่น พักเที่ยง ให้สร้าง event ธรรมดาในปฏิทินนี้ได้เลย
- event ทั้งวัน (all-day) จะบล็อกทั้งวัน
- เวลาทั้งหมดเป็นเวลาไทย (`Asia/Bangkok`) เวลาทำการและรายการบริการแก้ได้ใน [Google Sheet ข้อมูลร้าน](google-sheet.th.md)
- กันจองซ้ำ: event id คำนวณจาก calendar + เวลาเริ่ม ถ้ากดยืนยันซ้ำหรือ LINE ส่ง event ซ้ำจะไม่เกิดนัดซ้อน
- ถ้า[แยกหมอ/พนักงาน](google-sheet.th.md#แยกหมอพนักงาน-แท็บ-staff) กติกาเหล่านี้ใช้กับ calendar ของแต่ละคน

### แก้ปัญหา Google Calendar

| อาการ | สาเหตุที่เป็นไปได้ |
|---|---|
| agent ตอบว่ายังตรวจสอบตารางไม่ได้ | ยังไม่ได้ใส่ `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_CALENDAR_ID` หรือยังไม่ได้ restart |
| error `GOOGLE_PRIVATE_KEY ต้องเป็นค่า private_key ทั้งหมด…` | วาง key ไม่ครบ ให้คัดลอกค่า `private_key` ทั้งหมดรวมบรรทัด BEGIN/END |
| error `ไม่ใช่ JSON ที่ถูกต้อง` (เฉพาะ `GOOGLE_SERVICE_ACCOUNT_KEY` แบบเดิม) | วาง key ไม่ครบ หรือขึ้นบรรทัดใหม่กลาง JSON (ต้องเป็นบรรทัดเดียว) |
| error 404 Not Found | Calendar ID ผิด หรือยังไม่ได้แชร์ปฏิทินให้ `client_email` |
| error 403 | แชร์ด้วยสิทธิ์แค่ดู ต้องเป็น **Make changes to events** หรือยังไม่ได้ Enable Calendar API |
| เวลาว่างไม่ตรงกับที่เห็น | มี event ที่ไม่ได้ตั้งเป็น Free บล็อกอยู่ หรือดูคนละปฏิทินกับที่ตั้ง ID ไว้ |
