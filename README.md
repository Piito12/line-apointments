# clinic-appointment

AI agent ผู้ช่วยนัดหมายสำหรับธุรกิจที่รับนัด (คลินิก ร้านตัดผม สปา ฯลฯ) ข้อมูลร้านตั้งค่าได้จาก [Google Sheet](#ตั้งค่าข้อมูลร้าน-google-sheet) โดยไม่ต้องแก้โค้ด ถ้ายังไม่ตั้งค่าจะใช้ "คลินิกทำหน้า" (คลินิกสมมติของ PoC) สร้างด้วย [eve](https://eve.dev) และคุยกับลูกค้าผ่าน LINE Official Account

- **Framework:** eve (Vercel) · TypeScript · Node 24
- **LINE:** Vercel Chat SDK + [`chat-adapter-line`](https://github.com/PunGrumpy/chat-adapter-line)
- **โมเดล:** เลือกอัตโนมัติตาม API key ที่มี (Anthropic / OpenAI / [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)) ถ้าไม่มี key ใช้ ChatGPT subscription สำหรับ local (ดู [การเลือกโมเดล](#การเลือกโมเดล))

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FPiito12%2Fline-apointments&project-name=clinic-appointment&repository-name=clinic-appointment&env=LINE_CHANNEL_SECRET,LINE_CHANNEL_ACCESS_TOKEN,GOOGLE_SERVICE_ACCOUNT_KEY,GOOGLE_CALENDAR_ID&envDescription=LINE%20Messaging%20API%20credentials%20and%20Google%20Calendar%20service%20account&envLink=https%3A%2F%2Fgithub.com%2FPiito12%2Fline-apointments%23environment-variables-secret)

> ปุ่มนี้ชี้ไปที่ repo private ใช้ได้เฉพาะบัญชีที่มีสิทธิ์เข้าถึง repo และต้องให้ Vercel GitHub App เข้าถึง repo นี้ก่อน วิธีตั้งค่า secret ดูที่หัวข้อ [Environment variables (secret)](#environment-variables-secret) และขั้นตอนหลัง deploy ดูที่ [Deploy ขึ้น Vercel](#deploy-ขึ้น-vercel)

## สิ่งที่ต้องมี

- Node.js **24.x** (ตรวจด้วย `node -v`) ถ้าติดตั้งผ่าน Homebrew: `brew install node@24` แล้วเพิ่ม `export PATH="/opt/homebrew/opt/node@24/bin:$PATH"` ใน `~/.zshrc`
- บัญชี ChatGPT (สำหรับเทส local แบบไม่ใช้ API key)
- บัญชี Vercel (สำหรับ deploy)
- LINE Official Account ที่เปิดใช้ Messaging API แล้ว
- `cloudflared` สำหรับเปิดท่อให้ LINE ส่ง webhook เข้าเครื่อง: `brew install cloudflared`

## ติดตั้ง

```bash
npm install
```

## Environment variables (secret)

ทุกค่าเป็น secret **ห้าม commit** ตอนรัน local ให้ใส่ใน `.env.local` (ถูก ignore ใน git แล้ว) ตอน deploy ให้ใส่ใน Vercel → Project → **Settings → Environment Variables** (ปุ่ม Deploy จะขอ 4 ตัวแรกให้กรอกตอนสร้าง project)

| ตัวแปร | จำเป็น | ใช้ทำอะไร |
|---|---|---|
| `LINE_CHANNEL_SECRET` | ✅ | ตรวจลายเซ็น webhook ของ LINE |
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | ส่งข้อความตอบกลับลูกค้า |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | แนะนำ | JSON key ของ service account เป็นบรรทัดเดียว ใช้อ่านและจองคิวใน Google Calendar |
| `GOOGLE_CALENDAR_ID` | แนะนำ | calendar ที่ใช้เก็บนัด ถ้า[แยกหมอ/พนักงาน](#แยกหมอพนักงาน-แท็บ-staff) จะเป็น calendar รวมที่เก็บสำเนาทุกนัดให้เจ้าของดู (ไม่ใส่ก็ได้) |
| `CONFIG_SHEET_ID` | ไม่บังคับ | Google Sheet ที่เก็บข้อมูลร้าน (ดู [ตั้งค่าข้อมูลร้าน](#ตั้งค่าข้อมูลร้าน-google-sheet)) ถ้าไม่ใส่ใช้ข้อมูลคลินิกสมมติ |
| `ANTHROPIC_API_KEY` | ไม่บังคับ | ถ้ามี จะเรียก Claude โดยตรง |
| `OPENAI_API_KEY` | ไม่บังคับ | ถ้ามี จะเรียก OpenAI โดยตรง |
| `AI_GATEWAY_API_KEY` | ไม่บังคับ | ถ้ามี จะเรียกผ่าน AI Gateway (บน Vercel ไม่ต้องใส่ เพราะใช้ OIDC เอง) |
| `AI_MODEL` | ไม่บังคับ | เปลี่ยนรุ่นโมเดลภายใน provider ที่ถูกเลือก |

> ถ้าไม่ใส่ค่า Google agent ยังรันได้ แต่จะตอบลูกค้าว่ายังตรวจสอบตารางไม่ได้ ส่วนค่า LINE ต้องมีเสมอ ไม่งั้นแอปเปิดไม่ขึ้น (รายละเอียดด้านล่าง)

### ตั้งค่า `.env.local`

สร้างไฟล์ `.env.local` ที่ root ของโปรเจกต์:

```bash
LINE_CHANNEL_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LINE_CHANNEL_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

| ตัวแปร | ใช้ทำอะไร | หาได้ที่ |
|---|---|---|
| `LINE_CHANNEL_SECRET` | ตรวจลายเซ็นว่า webhook มาจาก LINE จริง | LINE Developers Console → channel → **Basic settings** → Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | ส่งข้อความตอบกลับไปหาลูกค้า | LINE Developers Console → channel → **Messaging API** → Channel access token (long-lived) → **Issue** |

> ⚠️ **ต้องมีทั้งสองค่าเสมอ** แม้จะทดสอบแค่ใน terminal โดยไม่ใช้ LINE เพราะ `agent/channels/line.ts` สร้าง LINE adapter ตอนโหลด ถ้าไม่มีค่า dev server จะเปิดไม่ขึ้น (eve compile channel แบบ static จึงปิด channel ตามเงื่อนไขไม่ได้)

ค่า `GOOGLE_SERVICE_ACCOUNT_KEY` และ `GOOGLE_CALENDAR_ID` ดูวิธีหาได้ที่หัวข้อ [ตั้งค่า Google Calendar](#ตั้งค่า-google-calendar)

### การเลือกโมเดล

`agent/agent.ts` เลือกโมเดลจาก API key ที่มีใน environment ตามลำดับนี้ ตัวแรกที่เจอจะถูกใช้:

| ลำดับ | เงื่อนไข | Provider | รุ่นเริ่มต้น | ตัวอย่าง `AI_MODEL` |
|---|---|---|---|---|
| 1 | มี `ANTHROPIC_API_KEY` | Anthropic โดยตรง | `claude-sonnet-5` | `claude-haiku-5.5` |
| 2 | มี `OPENAI_API_KEY` | OpenAI โดยตรง | `gpt-5.6-luna` | `gpt-5.6-sol` |
| 3 | มี `AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN` หรือรันบน Vercel | AI Gateway | `openai/gpt-5.6-luna` | `anthropic/claude-sonnet-5` (ต้องมี prefix `provider/`) |
| 4 | ไม่มี key เลย | ChatGPT subscription | `gpt-5.6-luna` | `gpt-5.6-luna-fast` |

- **เทส local (ค่าปัจจุบัน):** ไม่ต้องใส่ key ของโมเดลใน `.env.local` ระบบจะใช้ ChatGPT subscription ตามข้อ 4 (ดูวิธี `/login` ในหัวข้อถัดไป)
- **Production บน Vercel:** ถ้าไม่ใส่ key ของ Anthropic/OpenAI จะใช้ AI Gateway ผ่าน OIDC ให้เอง ChatGPT subscription ใช้บน server ไม่ได้
- ถ้ารัน `npx eve link` แล้ว env ที่ดึงมาอาจมี `VERCEL_OIDC_TOKEN` ทำให้ local เปลี่ยนไปใช้ Gateway แทน ChatGPT
- ต้อง restart `npm run dev` หลังแก้ env

## รันใน local

```bash
npm run dev
```

ถ้าใช้ ChatGPT subscription (ไม่มี key ของโมเดล) ครั้งแรกให้พิมพ์ `/login` ใน TUI → เลือก **ChatGPT Subscription** → login ในเบราว์เซอร์ จากนั้นพิมพ์คุยกับ agent ใน terminal ได้เลย eve จะ reload เองเมื่อแก้ไฟล์ใน `agent/`

dev server รันที่ `http://127.0.0.1:2000`

## ตั้งค่า LINE

### 1. LINE Official Account Manager (manager.line.biz)

ไปที่ **ตั้งค่า → การตอบกลับ (Response settings)**:

- **Webhooks** → **On**
- **Auto-response messages** → **Off** (ไม่งั้น LINE จะตอบอัตโนมัติซ้อนกับ agent)
- Greeting message เปิดหรือปิดก็ได้ มีผลแค่ตอนเพิ่มเพื่อนใหม่

### 2. เปิดท่อให้ LINE ส่ง webhook เข้าเครื่อง

LINE ส่ง webhook มาที่ `localhost` ไม่ได้ ต้องมี URL สาธารณะ เปิด terminal 2 หน้าต่าง:

```bash
# หน้าต่างที่ 1
npm run dev

# หน้าต่างที่ 2
cloudflared tunnel --url http://localhost:2000
```

ใน log ของ cloudflared ให้หากรอบ `Your quick Tunnel has been created!` จะมี URL แบบนี้:

```
https://xxxx-xxxx-xxxx.trycloudflare.com
```

### 3. ตั้ง Webhook URL

เอา URL จาก cloudflared มา**ต่อท้ายด้วย `/eve/v1/line`** แล้วไปกรอกที่ LINE Developers Console → channel → **Messaging API** → **Webhook URL** (หรือในหน้า Messaging API ของ OA Manager):

```
https://xxxx-xxxx-xxxx.trycloudflare.com/eve/v1/line
```

- กด **Verify** → ต้องขึ้น **Success**
- เปิด **Use webhook** ให้เป็น On

### 4. ทดสอบ

ทักข้อความหา OA จาก LINE บนมือถือ agent จะตอบกลับมา (ช้ากว่าแชทปกติเล็กน้อย เพราะรอโมเดลคิดเสร็จแล้วส่งทีเดียว)

### ข้อควรรู้เรื่องท่อ

- **URL เปลี่ยนทุกครั้งที่รัน cloudflared ใหม่** ต้องกลับไปแก้ Webhook URL ใน LINE แล้วกด Verify ใหม่ (restart `npm run dev` อย่างเดียว URL ไม่เปลี่ยน)
- **ปิดท่อเมื่อทดสอบเสร็จ** (Ctrl+C หรือ `pkill cloudflared`) ระหว่างท่อเปิด ใครที่รู้ URL สามารถเรียก `/eve/v1/session` คุยกับ agent ได้ เพราะ `localDev()` ใน `agent/channels/eve.ts` ยอมรับทุก request ขณะรัน `eve dev` ส่วน `/eve/v1/line` ปลอดภัยเพราะตรวจลายเซ็น
- ท่อแบบ quick tunnel ไม่มี uptime guarantee ใช้ทดสอบเท่านั้น ไม่เหมาะกับ production

### แก้ปัญหา

| อาการ | สาเหตุที่เป็นไปได้ |
|---|---|
| dev server เปิดไม่ขึ้น | ไม่มี `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` ใน `.env.local` หรือ Node ไม่ใช่ 24.x |
| agent ไม่ตอบ / error เรื่องโมเดล | local ยังไม่ได้ `/login` ChatGPT, API key ผิด, หรือ OIDC token หมดอายุ (รัน `npx eve link` ใหม่) |
| บน Vercel error เรื่อง ChatGPT | ไม่ควรเกิด เพราะบน Vercel จะใช้ Gateway เสมอ ถ้าเกิดให้เช็กว่ามี env `VERCEL` |
| Verify ไม่ผ่าน | ลืมต่อ `/eve/v1/line`, ท่อหรือ dev server ไม่ได้รันอยู่, หรือ URL เป็นของท่อรอบก่อน |
| ทักแล้ว agent ไม่ตอบ | Use webhook ยังเป็น Off หรือ access token ผิด (ดู log ใน terminal ของ `npm run dev`) |
| LINE ตอบข้อความอัตโนมัติซ้อน | ยังไม่ได้ปิด Auto-response messages |

## ตั้งค่า Google Calendar

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
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...","...":"..."}
GOOGLE_CALENDAR_ID=xxxxxxxx@group.calendar.google.com
```

- `GOOGLE_SERVICE_ACCOUNT_KEY` = เนื้อหาไฟล์ JSON **ทั้งก้อนในบรรทัดเดียว** แปลงได้ด้วย `jq -c . key.json` (คง `\n` ใน `private_key` ไว้ตามเดิม)
- local ใส่ใน `.env.local` แล้ว restart `npm run dev` ส่วนบน Vercel วาง JSON ลงช่องค่าของ env ได้ตรงๆ แล้ว Redeploy

### 5. ทดสอบ

ถาม agent ว่า "พรุ่งนี้มีคิวโบท็อกซ์ว่างไหม" ต้องได้การ์ดเวลาว่าง จองแล้วต้องเห็น event ชื่อ `<บริการ> - <ชื่อเล่น>` ในปฏิทิน (description มีบริการ ชื่อเล่น เบอร์โทร)

### กติกาที่ agent ใช้กับปฏิทิน

- event ใดๆ ในปฏิทินที่ไม่ได้ตั้งเป็น **Free** ถือว่าเวลานั้นไม่ว่าง (รับทีละ 1 คิว) จะบล็อกเวลาเอง เช่น พักเที่ยง ให้สร้าง event ธรรมดาในปฏิทินนี้ได้เลย
- event ทั้งวัน (all-day) จะบล็อกทั้งวัน
- เวลาทั้งหมดเป็นเวลาไทย (`Asia/Bangkok`) เวลาทำการและรายการบริการแก้ได้ใน [Google Sheet ข้อมูลร้าน](#ตั้งค่าข้อมูลร้าน-google-sheet)
- กันจองซ้ำ: event id คำนวณจาก calendar + เวลาเริ่ม ถ้ากดยืนยันซ้ำหรือ LINE ส่ง event ซ้ำจะไม่เกิดนัดซ้อน
- ถ้า[แยกหมอ/พนักงาน](#แยกหมอพนักงาน-แท็บ-staff) กติกาเหล่านี้ใช้กับ calendar ของแต่ละคน

### แก้ปัญหา Google Calendar

| อาการ | สาเหตุที่เป็นไปได้ |
|---|---|
| agent ตอบว่ายังตรวจสอบตารางไม่ได้ | ยังไม่ได้ใส่ `GOOGLE_SERVICE_ACCOUNT_KEY` / `GOOGLE_CALENDAR_ID` หรือยังไม่ได้ restart |
| error `ไม่ใช่ JSON ที่ถูกต้อง` | วาง key ไม่ครบ หรือขึ้นบรรทัดใหม่กลาง JSON (ต้องเป็นบรรทัดเดียว) |
| error 404 Not Found | Calendar ID ผิด หรือยังไม่ได้แชร์ปฏิทินให้ `client_email` |
| error 403 | แชร์ด้วยสิทธิ์แค่ดู ต้องเป็น **Make changes to events** หรือยังไม่ได้ Enable Calendar API |
| เวลาว่างไม่ตรงกับที่เห็น | มี event ที่ไม่ได้ตั้งเป็น Free บล็อกอยู่ หรือดูคนละปฏิทินกับที่ตั้ง ID ไว้ |

## ตั้งค่าข้อมูลร้าน (Google Sheet)

ชื่อร้าน บริการ เวลาทำการ วันปิด และกฎเฉพาะของร้าน ตั้งค่าได้ใน Google Sheet โดยไม่ต้องแก้โค้ดหรือ deploy ใหม่ agent อ่านด้วย Service Account ตัวเดียวกับ Google Calendar

### 1. สร้าง Sheet จาก template

1. ดาวน์โหลด [`templates/business-config-template.xlsx`](templates/business-config-template.xlsx)
2. เปิด [Google Drive](https://drive.google.com/) → **New → File upload** → เลือกไฟล์ → เปิดไฟล์ → **File → Save as Google Sheets**
3. แก้ข้อมูลในแท็บ `settings`, `services` และ `staff` ถ้าแยกหมอ/พนักงาน (แท็บ `วิธีใช้` อธิบายแต่ละช่อง) **ห้ามเปลี่ยนชื่อแท็บ คอลัมน์ `key` และหัวตาราง**

| แท็บ | เก็บอะไร |
|---|---|
| `settings` | `business_name` (บังคับ), `business_type`, `contact`, `open_time`, `close_time`, `closed_weekdays` (เช่น `จันทร์, อังคาร`), `slot_step_minutes`, `booking_window_days`, `min_lead_minutes`, `extra_instructions` (กฎเฉพาะร้าน เช่น ห้ามให้คำแนะนำทางการแพทย์) ช่องตัวเลขหรือเวลาที่เว้นว่างจะใช้ค่าเริ่มต้น |
| `services` | `id` (a-z 0-9 _ - ห้ามซ้ำ ลูกค้าไม่เห็น), `name` (ชื่อที่ลูกค้าเห็น), `minutes` (ระยะเวลาต่อคิว), `choose_staff` (TRUE = ให้ลูกค้าเลือกหมอ/พนักงานเอง, FALSE = ระบบเลือกให้ เว้นว่าง = TRUE) |
| `staff` | ไม่บังคับ ดู [แยกหมอ/พนักงาน](#แยกหมอพนักงาน-แท็บ-staff) |

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

| อาการ | สาเหตุที่เป็นไปได้ |
|---|---|
| log `โหลดข้อมูลร้านจาก Google Sheet ไม่สำเร็จ` + 403 | ยังไม่ได้ Enable Google Sheets API หรือยังไม่ได้แชร์ Sheet ให้ `client_email` |
| log 404 / `Unable to parse range` | `CONFIG_SHEET_ID` ผิด หรือเปลี่ยนชื่อแท็บ `settings` / `services` |
| log 400 `must not be an Office file` | `CONFIG_SHEET_ID` เป็นไฟล์ .xlsx ที่ยังไม่ได้แปลง เปิดไฟล์แล้วกด **File → Save as Google Sheets** แล้วใช้ ID ของไฟล์ใหม่ |
| log `ข้อมูลร้านใน Sheet ไม่ถูกต้อง` | ดูรายการปัญหาและเลขแถวใน log แล้วแก้ใน Sheet |
| แก้ Sheet แล้วยังเห็นค่าเก่า | รอไม่เกิน 1 นาที หรือ restart server ถ้า agent ยังตอบค่าเก่าในแชทเดิม ให้พิมพ์ `เริ่มใหม่` ใน LINE |

## Deploy ขึ้น Vercel

**วิธีที่ 1: ปุ่ม Deploy** กดปุ่ม Deploy with Vercel ด้านบน → เลือก scope → กรอก secret 4 ตัว → Deploy (Vercel จะ clone repo ไปเป็น repo ใหม่ในบัญชีของคุณ และ deploy ใหม่ทุกครั้งที่ push)

**วิธีที่ 2: CLI จากเครื่องนี้**

```bash
npx eve link --non-interactive --project clinic-appointment
# ใส่ secret ทีละตัว (ระบบจะถามค่า ไม่ต้องพิมพ์ค่าในคำสั่ง)
npx vercel env add LINE_CHANNEL_SECRET production
npx vercel env add LINE_CHANNEL_ACCESS_TOKEN production
npx vercel env add GOOGLE_SERVICE_ACCOUNT_KEY production
npx vercel env add GOOGLE_CALENDAR_ID production
npx vercel env add CONFIG_SHEET_ID production   # ไม่บังคับ ถ้าใช้ข้อมูลร้านจาก Google Sheet
npx eve deploy --non-interactive --yes
```

### หลัง deploy

1. ตรวจว่าแอปขึ้นแล้ว: `curl https://<project>.vercel.app/eve/v1/health`
2. เปลี่ยน Webhook URL ใน LINE Developers Console เป็น `https://<project>.vercel.app/eve/v1/line` → **Verify** → เปิด **Use webhook**
3. ถ้าแก้ env ภายหลัง ต้อง **Redeploy** ค่าใหม่ถึงจะมีผล
4. ถ้าเปิด Deployment Protection ไว้ LINE จะเรียก webhook ไม่ได้ ให้ปิดสำหรับ Production หรือใช้ Protection Bypass

## โครงสร้างโปรเจกต์

```
agent/
├── agent.ts                      # เลือกโมเดลตาม API key ที่มี
├── instructions.md               # persona และกฎกลางของผู้ช่วยนัดหมาย (ใช้ได้ทุกธุรกิจ)
├── instructions/
│   ├── business.ts               # ข้อมูลร้านจาก config ใส่ใน prompt ทุก turn
│   └── current-time.ts           # บอกวันเวลาปัจจุบัน (เวลาไทย) ทุก turn
├── channels/
│   ├── eve.ts                    # HTTP session API + TUI ของ eve
│   └── line.ts                   # LINE channel ผ่าน Chat SDK → webhook /eve/v1/line
├── tools/
│   ├── list_staff.ts             # รายชื่อหมอ/พนักงานที่ทำบริการนั้นได้ (การ์ดเลือกคน)
│   ├── get_available_slots.ts    # ดูเวลาว่างจาก Google Calendar (ของคนที่เลือก หรือรวมทุกคน)
│   ├── review_booking.ts         # ตรวจรายละเอียดก่อนยืนยัน (ยังไม่จอง)
│   └── book_appointment.ts       # จองคิวลง Google Calendar
└── lib/
    ├── config.ts                 # โหลดข้อมูลร้านจาก Google Sheet (cache 1 นาที) หรือใช้ค่าเริ่มต้น
    ├── config-schema.ts          # โครงสร้างข้อมูลร้าน ค่าเริ่มต้น และตัวตรวจข้อมูลจาก Sheet
    ├── google.ts                 # Service Account ที่ใช้ร่วมกันระหว่าง Calendar และ Sheets
    ├── slots.ts                  # คำนวณเวลาว่าง (ไม่เรียก network)
    ├── calendar.ts               # Google Calendar client (Service Account)
    ├── staff.ts                  # เลือกหมอ/พนักงานและ calendar ที่ใช้จอง
    ├── booking.ts                # ตรวจการจองที่ใช้ร่วมกันระหว่าง review และ book
    └── *-flex.ts                 # การ์ด LINE: เลือกคน / เลือกเวลา / สรุปการจอง
templates/
└── business-config-template.xlsx # template ข้อมูลร้าน สำหรับ upload เป็น Google Sheet
```

## ข้อจำกัดของ PoC

- **ใช้ข้อมูลสมมติเท่านั้น** ห้ามใส่ชื่อ เบอร์โทร หรือข้อมูลลูกค้าจริง เพราะข้อความวิ่งผ่าน provider ของโมเดล (OpenAI, Anthropic หรือ AI Gateway) (PDPA)
- **ค่าใช้จ่ายโมเดล** คิดตาม provider ที่ถูกเลือก (Anthropic, OpenAI หรือ AI Gateway ของบัญชี Vercel)
- **State ของ Chat SDK อยู่ใน memory** หายเมื่อ restart production ต้องเปลี่ยนเป็น durable state (Redis/Upstash)
- `chat-adapter-line` เป็น package ของชุมชน (v0.1.x)
- ยังไม่มี Flex message (งานถัดไป) ตอนนี้ agent ตอบเวลาว่างเป็นข้อความธรรมดา
- รับลูกค้าได้ทีละ 1 คิว event ใดๆ ใน calendar (ที่ไม่ได้ตั้งเป็น Free) ถือว่าเวลานั้นไม่ว่าง

## Learn more

- [eve documentation](https://eve.dev/docs)
- [eve Chat SDK channel](https://eve.dev/docs/channels/chat-sdk)
- [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/)
- [chat-adapter-line](https://github.com/PunGrumpy/chat-adapter-line)
