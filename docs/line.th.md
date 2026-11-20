# ตั้งค่า LINE

[← กลับ README](../README.md#ภาษาไทย) · [English](line.md)


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
