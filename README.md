# clinic-appointment

> ผู้ช่วย AI รับนัดผ่าน LINE สำหรับธุรกิจที่รับนัด (คลินิก ร้านตัดผม สปา ฯลฯ) จองลง Google Calendar และตั้งค่าร้านได้จาก Google Sheet โดยไม่ต้องแก้โค้ด  
> An AI booking assistant on LINE for appointment-based businesses (clinics, barbers, spas…). It books into Google Calendar, and each shop is configured from a Google Sheet with no code changes.

[![eve](https://img.shields.io/badge/eve-0.66-000000)](https://eve.dev)
[![Node](https://img.shields.io/badge/Node-24.x-5fa04e?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![LINE](https://img.shields.io/badge/LINE-Messaging%20API-06c755?logo=line&logoColor=white)](https://developers.line.biz/en/docs/messaging-api/)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmintelligence-dev%2Feve-appointment-agent&project-name=clinic-appointment&repository-name=clinic-appointment&env=LINE_CHANNEL_SECRET,LINE_CHANNEL_ACCESS_TOKEN,GOOGLE_CLIENT_EMAIL,GOOGLE_PRIVATE_KEY,GOOGLE_CALENDAR_ID,AI_PROVIDER,AI_API_KEY&envDefaults=%7B%22AI_PROVIDER%22%3A%22anthropic%22%7D&envDescription=LINE%20Messaging%20API%20credentials%2C%20Google%20Calendar%20service%20account%2C%20and%20an%20AI%20key.%20AI_PROVIDER%20is%20anthropic%2C%20openai%20or%20gateway.&envLink=https%3A%2F%2Fgithub.com%2Fmintelligence-dev%2Feve-appointment-agent%2Fblob%2Fmain%2Fdocs%2Fconfiguration.md)

> **เป็น PoC ใช้ข้อมูลสมมติเท่านั้น ห้ามใส่ข้อมูลลูกค้าจริง** เพราะข้อความวิ่งผ่าน provider ของโมเดล (PDPA)  
> **This is a PoC. Use made-up data only, never real customer data:** messages pass through the model provider (PDPA).

---

## ภาษาไทย

### ทำอะไรได้

1. **คุยรับนัดใน LINE** ลูกค้าเลือกบริการ หมอ/พนักงาน และเวลาจากการ์ด Flex ตรวจสรุปก่อนกดยืนยัน
2. **จองลง Google Calendar** อ่านเวลาว่างจาก event จริง กันจองซ้ำ และแยก calendar ต่อหมอ/พนักงานได้
3. **ตั้งค่าร้านจาก Google Sheet** ชื่อร้าน บริการ เวลาทำการ วันปิด และกฎเฉพาะร้าน แก้แล้วมีผลภายใน 1 นาที ไม่ต้อง deploy ใหม่
4. **ปิดตามวันหยุดนักขัตฤกษ์ไทยอัตโนมัติ** และตั้งวันปิด/เปิดพิเศษรายวันได้ในแท็บ `closures`
5. **เลือก AI ได้หลายเจ้า** ตั้ง `AI_PROVIDER` เป็น Anthropic · OpenAI · Vercel AI Gateway แล้วใส่ `AI_API_KEY` หรือใช้ ChatGPT subscription สำหรับเทสในเครื่อง

### เอกสาร

| หัวข้อ | เนื้อหา |
|---|---|
| [Environment variables และการเลือกโมเดล](docs/configuration.th.md) | secret ทุกตัว · `.env.local` · ลำดับการเลือก provider |
| [ตั้งค่า LINE](docs/line.th.md) | OA Manager · เปิดท่อด้วย cloudflared · Webhook URL · แก้ปัญหา |
| [ตั้งค่า Google Calendar](docs/google-calendar.th.md) | Service Account · แชร์ปฏิทิน · กติกาเวลาว่าง · แก้ปัญหา |
| [ตั้งค่าข้อมูลร้าน (Google Sheet)](docs/google-sheet.th.md) | template · แท็บ `settings` `services` `staff` `closures` · แก้ปัญหา |
| [Deploy ขึ้น Vercel](docs/deploy.th.md) | ปุ่ม Deploy · CLI · สิ่งที่ต้องทำหลัง deploy |

README นี้สรุปไว้สั้นๆ รายละเอียดครบอยู่ในเอกสารแต่ละหน้า (มีทั้งภาษาไทย `*.th.md` และภาษาอังกฤษ)

### สิ่งที่ต้องมี

| ต้องมี | ใช้ทำอะไร |
|---|---|
| Node.js **24.x** | รัน eve (Homebrew: `brew install node@24`) |
| LINE Official Account ที่เปิด Messaging API | ช่องทางคุยกับลูกค้า · ต้องมีเสมอ แม้เทสแค่ใน terminal |
| Google Cloud project + Service Account | อ่าน/เขียน Calendar และอ่าน Sheet |
| บัญชี ChatGPT หรือ API key ของโมเดล | เทสในเครื่องโดยไม่มี key ใช้ ChatGPT subscription ได้ |
| `cloudflared` | เปิดท่อให้ LINE ส่ง webhook เข้าเครื่อง (`brew install cloudflared`) |
| บัญชี Vercel | deploy |

### เริ่มใช้งาน

```bash
npm install
cp .env.example .env.local       # ใส่ LINE_CHANNEL_SECRET และ LINE_CHANNEL_ACCESS_TOKEN
npm run dev                      # dev server ที่ http://127.0.0.1:2000
```

- **ครั้งแรกที่ไม่มี key ของโมเดล:** พิมพ์ `/login` ใน TUI → เลือก **ChatGPT Subscription** → login ในเบราว์เซอร์ แล้วคุยกับ agent ใน terminal ได้เลย eve reload เองเมื่อแก้ไฟล์ใน `agent/`
- **คุยผ่าน LINE:** เปิดท่อด้วย `cloudflared tunnel --url http://localhost:2000` แล้วตั้ง Webhook URL เป็น `<URL>/eve/v1/line` ดู[ตั้งค่า LINE](docs/line.th.md)
- **จองลงปฏิทินจริง:** ใส่ `GOOGLE_CLIENT_EMAIL` `GOOGLE_PRIVATE_KEY` และ `GOOGLE_CALENDAR_ID` ดู[ตั้งค่า Google Calendar](docs/google-calendar.th.md) ถ้าไม่ใส่ agent ยังรันได้แต่จะบอกลูกค้าว่ายังตรวจสอบตารางไม่ได้
- **ข้อมูลร้านของคุณเอง:** ใส่ `CONFIG_SHEET_ID` ดู[ตั้งค่าข้อมูลร้าน](docs/google-sheet.th.md) ถ้าไม่ใส่จะใช้ "คลินิกทำหน้า" (คลินิกสมมติ)

### Environment variables

| ตัวแปร | จำเป็น | ใช้ทำอะไร |
|---|---|---|
| `LINE_CHANNEL_SECRET` · `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | ตรวจลายเซ็น webhook และส่งข้อความตอบกลับ |
| `GOOGLE_CLIENT_EMAIL` · `GOOGLE_PRIVATE_KEY` · `GOOGLE_CALENDAR_ID` | แนะนำ | อ่านเวลาว่างและจองคิว |
| `CONFIG_SHEET_ID` | ไม่บังคับ | Google Sheet ข้อมูลร้าน |
| `AI_PROVIDER` · `AI_API_KEY` | ✅ ตอน deploy | `anthropic` · `openai` · `gateway` กับ key ของเจ้านั้น (`gateway` ใช้ได้หลายเจ้าด้วย key เดียว) |
| `AI_MODEL` | ไม่บังคับ | เปลี่ยนรุ่นโมเดล เช่น `claude-haiku-5.5` หรือ `anthropic/claude-sonnet-5` (gateway) |

ทุกค่าเป็น secret **ห้าม commit** วิธีหาค่าและลำดับการเลือกโมเดลอยู่ใน [docs/configuration.th.md](docs/configuration.th.md)

### คำสั่ง

| คำสั่ง | |
|---|---|
| `npm install` | ติดตั้ง dependency |
| `npm run dev` | dev server + TUI ที่ `http://127.0.0.1:2000` |
| `npm run typecheck` | ตรวจ type ด้วย `tsc` |
| `npm run build` | build ด้วย eve |
| `npx eve deploy --non-interactive --yes` | deploy ขึ้น Vercel ดู [docs/deploy.th.md](docs/deploy.th.md) |

### ข้อจำกัดที่ควรรู้

- **ใช้ข้อมูลสมมติเท่านั้น** ห้ามใส่ชื่อ เบอร์โทร หรือข้อมูลลูกค้าจริง เพราะข้อความวิ่งผ่าน provider ของโมเดล (PDPA)
- **State ของ Chat SDK อยู่ใน memory** หายเมื่อ restart ถ้าจะใช้ production ต้องเปลี่ยนเป็น durable state (Redis/Upstash)
- **รับทีละ 1 คิวต่อ calendar** event ใดๆ ที่ไม่ได้ตั้งเป็น Free ถือว่าเวลานั้นไม่ว่าง
- **ยกเลิก/เลื่อนนัดต้องแก้ใน calendar ของหมอ/พนักงาน** การแก้ใน calendar รวมไม่ sync กลับ
- `chat-adapter-line` เป็น package ของชุมชน (v0.1.x)
- ค่าใช้จ่ายโมเดลคิดตาม provider ที่ถูกเลือก

---

## English

### What it does

1. **Takes bookings in LINE.** Customers pick a service, a doctor/staff member and a time from Flex cards, then review a summary before confirming.
2. **Books into Google Calendar.** Free slots come from real events, double bookings are prevented, and each doctor/staff member can have their own calendar.
3. **Configures the shop from a Google Sheet:** name, services, opening hours, closed days and shop-specific rules. Edits apply within 1 minute, with no redeploy.
4. **Closes on Thai public holidays automatically**, with per-day closed/open overrides in the `closures` tab.
5. **Works with several AI providers:** set `AI_PROVIDER` to Anthropic · OpenAI · Vercel AI Gateway and add `AI_API_KEY`, or use a ChatGPT subscription for local testing.

### Docs

| Topic | What it covers |
|---|---|
| [Environment variables and model selection](docs/configuration.md) | Every secret · `.env.local` · provider order |
| [LINE setup](docs/line.md) | OA Manager · cloudflared tunnel · Webhook URL · troubleshooting |
| [Google Calendar setup](docs/google-calendar.md) | Service Account · sharing calendars · slot rules · troubleshooting |
| [Shop data (Google Sheet)](docs/google-sheet.md) | Template · `settings` `services` `staff` `closures` tabs · troubleshooting |
| [Deploy to Vercel](docs/deploy.md) | Deploy button · CLI · after deploying |

Each guide has an English page and a Thai page (`*.th.md`). This file is a summary.

### Requirements

| You need | For |
|---|---|
| Node.js **24.x** | Running eve (Homebrew: `brew install node@24`) |
| A LINE Official Account with the Messaging API on | Talking to customers · always required, even for terminal-only testing |
| A Google Cloud project + Service Account | Reading/writing Calendar and reading the Sheet |
| A ChatGPT account or a model API key | Without a key, local testing uses a ChatGPT subscription |
| `cloudflared` | Tunnelling LINE webhooks to your machine (`brew install cloudflared`) |
| A Vercel account | Deploying |

### Getting started

```bash
npm install
cp .env.example .env.local       # add LINE_CHANNEL_SECRET and LINE_CHANNEL_ACCESS_TOKEN
npm run dev                      # dev server at http://127.0.0.1:2000
```

- **First run without a model key:** type `/login` in the TUI → choose **ChatGPT Subscription** → log in in the browser, then chat with the agent in the terminal. eve reloads when files in `agent/` change.
- **Chat through LINE:** open a tunnel with `cloudflared tunnel --url http://localhost:2000` and set the Webhook URL to `<URL>/eve/v1/line`. See [LINE setup](docs/line.md).
- **Book into a real calendar:** set `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` and `GOOGLE_CALENDAR_ID`. See [Google Calendar setup](docs/google-calendar.md). Without them the agent still runs but tells customers it cannot check the schedule yet.
- **Your own shop data:** set `CONFIG_SHEET_ID`. See [Shop data](docs/google-sheet.md). Without it the agent uses a made-up clinic, "คลินิกทำหน้า".

### Environment variables

| Variable | Required | For |
|---|---|---|
| `LINE_CHANNEL_SECRET` · `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | Verifying webhook signatures and sending replies |
| `GOOGLE_CLIENT_EMAIL` · `GOOGLE_PRIVATE_KEY` · `GOOGLE_CALENDAR_ID` | Recommended | Reading free slots and booking |
| `CONFIG_SHEET_ID` | Optional | The shop-data Google Sheet |
| `AI_PROVIDER` · `AI_API_KEY` | ✅ when deploying | `anthropic` · `openai` · `gateway` and that provider's key (`gateway` reaches many providers with one key) |
| `AI_MODEL` | Optional | Changes the model, e.g. `claude-haiku-5.5` or `anthropic/claude-sonnet-5` (gateway) |

Every value is a secret. **Never commit them.** Where to find each value and how the model is chosen: [docs/configuration.md](docs/configuration.md).

### Commands

| Command | |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server + TUI at `http://127.0.0.1:2000` |
| `npm run typecheck` | Type-check with `tsc` |
| `npm run build` | Build with eve |
| `npx eve deploy --non-interactive --yes` | Deploy to Vercel · see [docs/deploy.md](docs/deploy.md) |

### Known limitations

- **Made-up data only.** Never enter real names, phone numbers or customer data: messages pass through the model provider (PDPA).
- **Chat SDK state lives in memory** and is lost on restart. Production needs durable state (Redis/Upstash).
- **One booking at a time per calendar.** Any event not marked Free blocks that time.
- **Cancel or move a booking in the doctor/staff member's own calendar.** Edits in the combined calendar do not sync back.
- `chat-adapter-line` is a community package (v0.1.x).
- Model costs depend on the provider in use.

### Project layout

```
agent/
├── agent.ts                      # picks the model from the available API keys
├── instructions.md               # persona and shared rules (any business)
├── instructions/
│   ├── business.ts               # shop data from the config, added to the prompt every turn
│   └── current-time.ts           # current date/time (Asia/Bangkok) every turn
├── channels/
│   ├── eve.ts                    # eve HTTP session API + TUI
│   └── line.ts                   # LINE channel via Chat SDK → webhook /eve/v1/line
├── tools/
│   ├── list_staff.ts             # doctors/staff who offer a service (pick-a-person card)
│   ├── get_available_slots.ts    # free slots from Google Calendar
│   ├── review_booking.ts         # check details before confirming (no booking yet)
│   └── book_appointment.ts       # book into Google Calendar
└── lib/
    ├── config.ts                 # loads shop data from the Sheet (1-minute cache) or defaults
    ├── config-schema.ts          # shop-data shape, defaults and Sheet validation
    ├── google.ts                 # Service Account shared by Calendar and Sheets
    ├── slots.ts                  # free-slot maths (no network)
    ├── calendar.ts               # Google Calendar client
    ├── staff.ts                  # picks the doctor/staff member and their calendar
    ├── holidays.ts               # holiday calendar (6-hour cache) + closures overrides
    ├── booking.ts                # booking checks shared by review and book
    └── *-flex.ts                 # LINE cards: pick a person / pick a time / booking summary
docs/                             # setup guides (English *.md · Thai *.th.md)
templates/
└── business-config-template.xlsx # shop-data template to upload as a Google Sheet
```

### Tech stack

[eve](https://eve.dev) · TypeScript · Node 24 · [Vercel Chat SDK](https://eve.dev/docs/channels/chat-sdk) + [`chat-adapter-line`](https://github.com/PunGrumpy/chat-adapter-line) · Google Calendar API · Google Sheets API · Vercel

### Learn more

- [eve documentation](https://eve.dev/docs)
- [eve Chat SDK channel](https://eve.dev/docs/channels/chat-sdk)
- [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/)
- [chat-adapter-line](https://github.com/PunGrumpy/chat-adapter-line)
