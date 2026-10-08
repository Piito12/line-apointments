# clinic-appointment

AI agent ผู้ช่วยนัดหมายของ "คลินิกทำหน้า" (คลินิกสมมติสำหรับ PoC) สร้างด้วย [eve](https://eve.dev) และคุยกับลูกค้าผ่าน LINE Official Account

- **Framework:** eve (Vercel) · TypeScript · Node 24
- **LINE:** Vercel Chat SDK + [`chat-adapter-line`](https://github.com/PunGrumpy/chat-adapter-line)
- **โมเดล:** `openai/gpt-5.6-luna` ผ่าน [Vercel AI Gateway](https://vercel.com/docs/ai-gateway)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FPiito12%2Fline-apointments&project-name=clinic-appointment&repository-name=clinic-appointment&env=LINE_CHANNEL_SECRET,LINE_CHANNEL_ACCESS_TOKEN,GOOGLE_SERVICE_ACCOUNT_KEY,GOOGLE_CALENDAR_ID&envDescription=LINE%20Messaging%20API%20credentials%20and%20Google%20Calendar%20service%20account&envLink=https%3A%2F%2Fgithub.com%2FPiito12%2Fline-apointments%23environment-variables-secret)

> ปุ่มนี้ชี้ไปที่ repo private ใช้ได้เฉพาะบัญชีที่มีสิทธิ์เข้าถึง repo และต้องให้ Vercel GitHub App เข้าถึง repo นี้ก่อน วิธีตั้งค่า secret ดูที่หัวข้อ [Environment variables (secret)](#environment-variables-secret) และขั้นตอนหลัง deploy ดูที่ [Deploy ขึ้น Vercel](#deploy-ขึ้น-vercel)

## สิ่งที่ต้องมี

- Node.js **24.x** (ตรวจด้วย `node -v`) ถ้าติดตั้งผ่าน Homebrew: `brew install node@24` แล้วเพิ่ม `export PATH="/opt/homebrew/opt/node@24/bin:$PATH"` ใน `~/.zshrc`
- บัญชี Vercel (สำหรับ AI Gateway และ deploy)
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
| `AI_GATEWAY_API_KEY` | เฉพาะ local | key ของ AI Gateway บน Vercel ไม่ต้องใส่ เพราะ deployment ใช้ OIDC เอง |

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

### Google Calendar (สำหรับ tool ดูเวลาว่างและจองคิว)

```bash
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...","...":"..."}
GOOGLE_CALENDAR_ID=xxxxxxxx@group.calendar.google.com
```

1. Google Cloud Console → สร้าง project → **APIs & Services → Library** → เปิด **Google Calendar API**
2. **Credentials → Create credentials → Service account** → แท็บ **Keys → Add key → JSON** → ดาวน์โหลด แล้วเอาเนื้อหา JSON ทั้งก้อนมาใส่ใน `GOOGLE_SERVICE_ACCOUNT_KEY` เป็นบรรทัดเดียว (ห้ามวางไฟล์ key ไว้ในโปรเจกต์)
3. Google Calendar → สร้าง **calendar ใหม่สำหรับทดสอบ** → Settings ของ calendar นั้น → **Share with specific people** → ใส่ `client_email` ของ service account ให้สิทธิ์ **Make changes to events**
4. คัดลอก **Calendar ID** จากหัวข้อ Integrate calendar มาใส่ `GOOGLE_CALENDAR_ID`

ถ้ายังไม่ได้ตั้งค่า agent ยังรันได้ แต่จะตอบลูกค้าว่ายังตรวจสอบตารางไม่ได้ (ไม่แต่งเวลาว่างเอง)

### AI Gateway (โมเดล)

เลือกได้ 1 วิธีสำหรับรัน local:

- **ใช้ API key:** Vercel Dashboard → **AI Gateway → API Keys** → สร้าง key แล้วใส่ `AI_GATEWAY_API_KEY=...` ใน `.env.local`
- **ใช้ OIDC ของ project:** รัน `npx eve link` เพื่อผูกกับ Vercel project และดึง env มา (token มีอายุจำกัด หมดอายุแล้วให้รันใหม่)

ถ้าจะเปลี่ยนโมเดล ให้แก้ string ใน `agent/agent.ts` หรือรัน `npx eve set --model <provider/model>`

## รันใน local

```bash
npm run dev
```

พิมพ์คุยกับ agent ใน terminal ได้เลย (ต้องตั้งค่า AI Gateway ตามหัวข้อด้านบนก่อน) eve จะ reload เองเมื่อแก้ไฟล์ใน `agent/`

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
| agent ไม่ตอบ / error เรื่อง gateway | ยังไม่ได้ตั้ง `AI_GATEWAY_API_KEY` หรือ OIDC token หมดอายุ (รัน `npx eve link` ใหม่) |
| Verify ไม่ผ่าน | ลืมต่อ `/eve/v1/line`, ท่อหรือ dev server ไม่ได้รันอยู่, หรือ URL เป็นของท่อรอบก่อน |
| ทักแล้ว agent ไม่ตอบ | Use webhook ยังเป็น Off หรือ access token ผิด (ดู log ใน terminal ของ `npm run dev`) |
| LINE ตอบข้อความอัตโนมัติซ้อน | ยังไม่ได้ปิด Auto-response messages |

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
├── agent.ts                      # เลือกโมเดล (AI Gateway)
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

- **ใช้ข้อมูลสมมติเท่านั้น** ห้ามใส่ชื่อ เบอร์โทร หรือข้อมูลลูกค้าจริง เพราะข้อความวิ่งผ่าน OpenAI (PDPA)
- **ค่าใช้จ่ายโมเดล** คิดตามการใช้งานผ่าน AI Gateway ของบัญชี Vercel
- **State ของ Chat SDK อยู่ใน memory** หายเมื่อ restart production ต้องเปลี่ยนเป็น durable state (Redis/Upstash)
- `chat-adapter-line` เป็น package ของชุมชน (v0.1.x)
- ยังไม่มี Flex message (งานถัดไป) ตอนนี้ agent ตอบเวลาว่างเป็นข้อความธรรมดา
- รับลูกค้าได้ทีละ 1 คิว event ใดๆ ใน calendar (ที่ไม่ได้ตั้งเป็น Free) ถือว่าเวลานั้นไม่ว่าง

## Learn more

- [eve documentation](https://eve.dev/docs)
- [eve Chat SDK channel](https://eve.dev/docs/channels/chat-sdk)
- [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/)
- [chat-adapter-line](https://github.com/PunGrumpy/chat-adapter-line)
