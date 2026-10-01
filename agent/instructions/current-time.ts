import { defineDynamic, defineInstructions } from "eve/instructions";

import { msToLocal, thaiWeekdayOf } from "../lib/slots";

// บอกวันและเวลาปัจจุบัน (เวลาไทย) ทุก turn
// โมเดลไม่รู้วันที่ปัจจุบันเอง จึงต้องใช้ค่านี้แปลงคำอย่าง "พรุ่งนี้", "เสาร์นี้" เป็นวันที่จริง
export default defineDynamic({
  events: {
    "turn.started": () => {
      const { date, time } = msToLocal(Date.now());
      return defineInstructions({
        content: `ตอนนี้คือวัน${thaiWeekdayOf(date)}ที่ ${date} เวลา ${time} น. (เวลาไทย Asia/Bangkok) ใช้เป็นฐานในการแปลงวันที่ที่ลูกค้าพูดถึง`,
      });
    },
  },
});
