# Deploy ขึ้น Vercel

[← กลับ README](../README.md#ภาษาไทย) · [English](deploy.md)


**วิธีที่ 1: ปุ่ม Deploy** กดปุ่ม Deploy with Vercel ใน [README](../README.md) → เลือก scope → กรอก secret (LINE, Google, `AI_PROVIDER` และ `AI_API_KEY`) → Deploy (Vercel จะ clone repo ไปเป็น repo ใหม่ในบัญชีของคุณ และ deploy ใหม่ทุกครั้งที่ push)

**วิธีที่ 2: CLI จากเครื่องนี้**

```bash
npx eve link --non-interactive --project clinic-appointment
# ใส่ secret ทีละตัว (ระบบจะถามค่า ไม่ต้องพิมพ์ค่าในคำสั่ง)
npx vercel env add LINE_CHANNEL_SECRET production
npx vercel env add LINE_CHANNEL_ACCESS_TOKEN production
npx vercel env add GOOGLE_SERVICE_ACCOUNT_KEY production
npx vercel env add GOOGLE_CALENDAR_ID production
npx vercel env add AI_PROVIDER production        # anthropic | openai | gateway
npx vercel env add AI_API_KEY production
npx vercel env add CONFIG_SHEET_ID production   # ไม่บังคับ ถ้าใช้ข้อมูลร้านจาก Google Sheet
npx eve deploy --non-interactive --yes
```

### หลัง deploy

1. ตรวจว่าแอปขึ้นแล้ว: `curl https://<project>.vercel.app/eve/v1/health`
2. เปลี่ยน Webhook URL ใน LINE Developers Console เป็น `https://<project>.vercel.app/eve/v1/line` → **Verify** → เปิด **Use webhook**
3. ถ้าแก้ env ภายหลัง ต้อง **Redeploy** ค่าใหม่ถึงจะมีผล
4. ถ้าเปิด Deployment Protection ไว้ LINE จะเรียก webhook ไม่ได้ ให้ปิดสำหรับ Production หรือใช้ Protection Bypass
5. **เปลี่ยนเจ้า AI หรือรุ่นโมเดล:** แก้ `AI_PROVIDER` (`anthropic` · `openai` · `gateway`) `AI_API_KEY` และ `AI_MODEL` ถ้าต้องการ ใน Vercel → Project → **Settings → Environment Variables** แล้ว **Redeploy** ดู[การเลือกโมเดล](configuration.th.md#การเลือกโมเดล)
