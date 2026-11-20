# Environment variables และการเลือกโมเดล

[← กลับ README](../README.md#ภาษาไทย) · [English](configuration.md)


ทุกค่าเป็น secret **ห้าม commit** ตอนรัน local ให้ใส่ใน `.env.local` (ถูก ignore ใน git แล้ว) ตอน deploy ให้ใส่ใน Vercel → Project → **Settings → Environment Variables** (ปุ่ม Deploy จะขอ 4 ตัวแรกให้กรอกตอนสร้าง project)

| ตัวแปร | จำเป็น | ใช้ทำอะไร |
|---|---|---|
| `LINE_CHANNEL_SECRET` | ✅ | ตรวจลายเซ็น webhook ของ LINE |
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | ส่งข้อความตอบกลับลูกค้า |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | แนะนำ | JSON key ของ service account เป็นบรรทัดเดียว ใช้อ่านและจองคิวใน Google Calendar |
| `GOOGLE_CALENDAR_ID` | แนะนำ | calendar ที่ใช้เก็บนัด ถ้า[แยกหมอ/พนักงาน](google-sheet.th.md#แยกหมอพนักงาน-แท็บ-staff) จะเป็น calendar รวมที่เก็บสำเนาทุกนัดให้เจ้าของดู (ไม่ใส่ก็ได้) |
| `CONFIG_SHEET_ID` | ไม่บังคับ | Google Sheet ที่เก็บข้อมูลร้าน (ดู [ตั้งค่าข้อมูลร้าน](google-sheet.th.md)) ถ้าไม่ใส่ใช้ข้อมูลคลินิกสมมติ |
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

ค่า `GOOGLE_SERVICE_ACCOUNT_KEY` และ `GOOGLE_CALENDAR_ID` ดูวิธีหาได้ที่หัวข้อ [ตั้งค่า Google Calendar](google-calendar.th.md)

### การเลือกโมเดล

`agent/agent.ts` เลือกโมเดลจาก API key ที่มีใน environment ตามลำดับนี้ ตัวแรกที่เจอจะถูกใช้:

| ลำดับ | เงื่อนไข | Provider | รุ่นเริ่มต้น | ตัวอย่าง `AI_MODEL` |
|---|---|---|---|---|
| 1 | มี `ANTHROPIC_API_KEY` | Anthropic โดยตรง | `claude-sonnet-5` | `claude-haiku-5.5` |
| 2 | มี `OPENAI_API_KEY` | OpenAI โดยตรง | `gpt-5.6-luna` | `gpt-5.6-sol` |
| 3 | มี `AI_GATEWAY_API_KEY` / `VERCEL_OIDC_TOKEN` หรือรันบน Vercel | AI Gateway | `openai/gpt-5.6-luna` | `anthropic/claude-sonnet-5` (ต้องมี prefix `provider/`) |
| 4 | ไม่มี key เลย | ChatGPT subscription | `gpt-5.6-luna` | `gpt-5.6-luna-fast` |

- **เทส local (ค่าปัจจุบัน):** ไม่ต้องใส่ key ของโมเดลใน `.env.local` ระบบจะใช้ ChatGPT subscription ตามข้อ 4 (ดูวิธี `/login` ใน [เริ่มใช้งาน](../README.md#เริ่มใช้งาน))
- **Production บน Vercel:** ถ้าไม่ใส่ key ของ Anthropic/OpenAI จะใช้ AI Gateway ผ่าน OIDC ให้เอง ChatGPT subscription ใช้บน server ไม่ได้
- ถ้ารัน `npx eve link` แล้ว env ที่ดึงมาอาจมี `VERCEL_OIDC_TOKEN` ทำให้ local เปลี่ยนไปใช้ Gateway แทน ChatGPT
- ต้อง restart `npm run dev` หลังแก้ env
