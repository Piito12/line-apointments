# clinic-appointment

AI agent ผู้ช่วยนัดหมายของ "คลินิกทำหน้า" (คลินิกสมมติสำหรับ PoC) สร้างด้วย [eve](https://eve.dev) และคุยกับลูกค้าผ่าน LINE Official Account

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
| `GOOGLE_CALENDAR_ID` | แนะนำ | calendar ที่ใช้เก็บนัด |
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
- เวลาทั้งหมดเป็นเวลาไทย (`Asia/Bangkok`) เวลาทำการและรายการบริการแก้ได้ที่ `agent/lib/clinic.ts`
- กันจองซ้ำ: event id คำนวณจากเวลาเริ่ม ถ้ากดยืนยันซ้ำหรือ LINE ส่ง event ซ้ำจะไม่เกิดนัดซ้อน

### แก้ปัญหา Google Calendar

| อาการ | สาเหตุที่เป็นไปได้ |
|---|---|
| agent ตอบว่ายังตรวจสอบตารางไม่ได้ | ยังไม่ได้ใส่ `GOOGLE_SERVICE_ACCOUNT_KEY` / `GOOGLE_CALENDAR_ID` หรือยังไม่ได้ restart |
| error `ไม่ใช่ JSON ที่ถูกต้อง` | วาง key ไม่ครบ หรือขึ้นบรรทัดใหม่กลาง JSON (ต้องเป็นบรรทัดเดียว) |
| error 404 Not Found | Calendar ID ผิด หรือยังไม่ได้แชร์ปฏิทินให้ `client_email` |
| error 403 | แชร์ด้วยสิทธิ์แค่ดู ต้องเป็น **Make changes to events** หรือยังไม่ได้ Enable Calendar API |
| เวลาว่างไม่ตรงกับที่เห็น | มี event ที่ไม่ได้ตั้งเป็น Free บล็อกอยู่ หรือดูคนละปฏิทินกับที่ตั้ง ID ไว้ |

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
├── instructions.md               # persona และกฎของผู้ช่วยนัดหมาย
├── instructions/
│   └── current-time.ts           # บอกวันเวลาปัจจุบัน (เวลาไทย) ทุก turn
├── channels/
│   ├── eve.ts                    # HTTP session API + TUI ของ eve
│   └── line.ts                   # LINE channel ผ่าน Chat SDK → webhook /eve/v1/line
├── tools/
│   ├── get_available_slots.ts    # ดูเวลาว่างจาก Google Calendar
│   └── book_appointment.ts       # จองคิวลง Google Calendar
└── lib/
    ├── clinic.ts                 # ข้อมูลคลินิก: เวลาทำการ บริการ ระยะเวลา (ข้อมูลสมมติ)
    ├── slots.ts                  # คำนวณเวลาว่าง (ไม่เรียก network)
    └── calendar.ts               # Google Calendar client (Service Account)
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
