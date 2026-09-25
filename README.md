# clinic-appointment

AI agent ผู้ช่วยนัดหมายของ "คลินิกทำหน้า" (คลินิกสมมติสำหรับ PoC) สร้างด้วย [eve](https://eve.dev) และคุยกับลูกค้าผ่าน LINE Official Account

- **Framework:** eve (Vercel) · TypeScript · Node 24
- **LINE:** Vercel Chat SDK + [`chat-adapter-line`](https://github.com/PunGrumpy/chat-adapter-line)
- **โมเดล (ช่วงทดสอบ):** ChatGPT subscription ผ่าน `chatgpt()` ใช้ได้เฉพาะ local

## สิ่งที่ต้องมี

- Node.js **24.x** (ตรวจด้วย `node -v`) ถ้าติดตั้งผ่าน Homebrew: `brew install node@24` แล้วเพิ่ม `export PATH="/opt/homebrew/opt/node@24/bin:$PATH"` ใน `~/.zshrc`
- บัญชี ChatGPT (สำหรับโมเดลช่วงทดสอบ)
- LINE Official Account ที่เปิดใช้ Messaging API แล้ว
- `cloudflared` สำหรับเปิดท่อให้ LINE ส่ง webhook เข้าเครื่อง: `brew install cloudflared`

## ติดตั้ง

```bash
npm install
```

## ตั้งค่า `.env.local`

สร้างไฟล์ `.env.local` ที่ root ของโปรเจกต์ (ไฟล์นี้ถูก ignore ใน git แล้ว **ห้าม commit**):

```bash
LINE_CHANNEL_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
LINE_CHANNEL_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

| ตัวแปร | ใช้ทำอะไร | หาได้ที่ |
|---|---|---|
| `LINE_CHANNEL_SECRET` | ตรวจลายเซ็นว่า webhook มาจาก LINE จริง | LINE Developers Console → channel → **Basic settings** → Channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | ส่งข้อความตอบกลับไปหาลูกค้า | LINE Developers Console → channel → **Messaging API** → Channel access token (long-lived) → **Issue** |

> ⚠️ **ต้องมีทั้งสองค่าเสมอ** แม้จะทดสอบแค่ใน terminal โดยไม่ใช้ LINE เพราะ `agent/channels/line.ts` สร้าง LINE adapter ตอนโหลด ถ้าไม่มีค่า dev server จะเปิดไม่ขึ้น (eve compile channel แบบ static จึงปิด channel ตามเงื่อนไขไม่ได้)

ช่วงทดสอบไม่ต้องใส่ API key ของโมเดลใน `.env.local` เพราะใช้ ChatGPT subscription ผ่าน `/login` (ดูหัวข้อถัดไป)

## รันใน local

```bash
npm run dev
```

ครั้งแรกให้พิมพ์ `/login` ใน TUI → เลือก **ChatGPT Subscription** → login ในเบราว์เซอร์ จากนั้นพิมพ์คุยกับ agent ใน terminal ได้เลย eve จะ reload เองเมื่อแก้ไฟล์ใน `agent/`

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
| Verify ไม่ผ่าน | ลืมต่อ `/eve/v1/line`, ท่อหรือ dev server ไม่ได้รันอยู่, หรือ URL เป็นของท่อรอบก่อน |
| ทักแล้ว agent ไม่ตอบ | Use webhook ยังเป็น Off หรือ access token ผิด (ดู log ใน terminal ของ `npm run dev`) |
| LINE ตอบข้อความอัตโนมัติซ้อน | ยังไม่ได้ปิด Auto-response messages |

## โครงสร้างโปรเจกต์

```
agent/
├── agent.ts            # เลือกโมเดล (ตอนนี้ chatgpt())
├── instructions.md     # persona และกฎของผู้ช่วยนัดหมาย (ข้อมูลคลินิกเป็นข้อมูลสมมติ)
└── channels/
    ├── eve.ts          # HTTP session API + TUI ของ eve
    └── line.ts         # LINE channel ผ่าน Chat SDK → webhook /eve/v1/line
```

## ข้อจำกัดของ PoC

- **ใช้ข้อมูลสมมติเท่านั้น** ห้ามใส่ชื่อ เบอร์โทร หรือข้อมูลลูกค้าจริง เพราะข้อความวิ่งผ่าน OpenAI (PDPA)
- **ChatGPT subscription ใช้ได้เฉพาะ local** ก่อน deploy ต้องเปลี่ยนโมเดลใน `agent/agent.ts` เป็นแบบ API key และตั้ง key ใน environment ของ server
- **State ของ Chat SDK อยู่ใน memory** หายเมื่อ restart production ต้องเปลี่ยนเป็น durable state (Redis/Upstash)
- `chat-adapter-line` เป็น package ของชุมชน (v0.1.x)
- ยังไม่มี tool Google Calendar และ Flex message (งานถัดไป)

## Learn more

- [eve documentation](https://eve.dev/docs)
- [eve Chat SDK channel](https://eve.dev/docs/channels/chat-sdk)
- [LINE Messaging API](https://developers.line.biz/en/docs/messaging-api/)
- [chat-adapter-line](https://github.com/PunGrumpy/chat-adapter-line)
