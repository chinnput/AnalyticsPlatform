# Instruction — กฎการทำงานกับ AI Assistant

> ใช้กับ AI assistant ทุกตัวในโปรเจกต์นี้ (Claude Code, Copilot ฯลฯ)
> **ห้ามทำงานโดยพลการ** — ทุก action ที่เปลี่ยนแปลงอะไร ต้องสรุปแล้วรอ approve ก่อนเสมอ

---

## 1. กฎหลัก: สรุปก่อน → รอ approve → ค่อยทำ

ก่อนลงมือทำอะไรก็ตามที่ **เปลี่ยนแปลง** ไฟล์ ระบบ หรือข้อมูล ต้อง:

1. **สรุป** ว่าจะทำอะไร ทำไม และกระทบอะไรบ้าง
2. ถ้าแก้ไฟล์ — บอก **ชื่อไฟล์** + **สาระที่จะเปลี่ยน**
3. ถาม **"approve ไหม?"** แล้ว **หยุดรอ** — ห้ามลงมือจนกว่าจะได้คำตอบ

> แม้ผู้ใช้จะขอให้ "ทำ X" ก็ให้สรุปแผนก่อน แล้วรอ approve
> ถ้าไม่แน่ใจว่าต้องถามไหม → **ถาม**

---

## 2. ต้องขอ approve ก่อนทุกครั้ง ✋

- สร้าง / แก้ไข / ลบ ไฟล์ (code, config, `.env`, docs)
- รันคำสั่ง terminal ที่เปลี่ยนแปลงอะไร หรือ start / stop server / process
- ติดตั้ง / ลบ package หรือ dependency
- `git commit`, `git push`, สร้าง / ลบ branch
- แตะ database หรือ data source ใดๆ
- kill process หรือเปลี่ยน port

**ทำทีละเรื่อง** — ห้ามรวบหลาย action ไว้ใน approve เดียวโดยไม่บอกครบ
ถ้าระหว่างทำเจอสิ่งที่ต้องทำเพิ่มนอกแผน → **หยุด แล้วถามใหม่**

---

## 3. ทำได้เลย ไม่ต้องถาม ✅

- อ่านไฟล์ / ค้นหา code
- รันคำสั่ง read-only (`git status`, `git log`, `git diff`, list, เช็ค port, type-check)
- อธิบาย / วางแผน / ตอบคำถาม / เสนอทางเลือก

---

## 4. ห้ามทำเด็ดขาด ❌

- ห้ามแก้ข้อมูลใน data source ต้นทาง (SQL Server / PI) — ระบบนี้ **read-only**
- ห้ามเขียน credential / password / token จริงลงไฟล์ code หรือ commit
- ห้ามขอให้ผู้ใช้พิมพ์ password / secret ในแชท
- ห้าม `git push --force`, `git reset --hard`, ลบ branch
- ห้าม kill process ที่ไม่ใช่ของโปรเจกต์นี้

---

## 5. รูปแบบการขอ approve (ตัวอย่าง)

```text
จะทำ: เปลี่ยน legend ของ histogram เป็นปุ่ม toggle แบบ wrap
ไฟล์: web/components/HistogramCanvas.tsx
  - ปิด ECharts legend (type: scroll)
  - เพิ่มแถบปุ่มเปิด/ปิด series ใต้ toolbar
กระทบ: เฉพาะหน้า Histogram, ไม่กระทบ API
approve ไหม?
```

---

## 6. ภาษา

- ตอบเป็น **ไทยผสมอังกฤษ** (technical terms ใช้อังกฤษได้)
- อธิบายให้เข้าใจง่าย
