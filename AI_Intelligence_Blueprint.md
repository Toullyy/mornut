# AI Intelligence Blueprint — พิมพ์เขียวสำหรับสร้าง AI ผู้ช่วยที่ "ฉลาด + ถูก + ไม่ล่ม"

> เอกสารนี้เป็น **พิมพ์เขียว (blueprint) แบบพกพาได้** — เอาไปให้อีกโปรเจคหนึ่งเพื่อสร้าง AI
> ให้ทำงานฉลาดในแบบเดียวกับระบบจองคิว LINE OA นี้ โดย **ไม่ต้องมีโค้ดต้นทางทั้งrepo**
>
> อ่านแบบนี้: **แกนกลาง = 8 pattern ที่ทำให้ AI "ฉลาด"** (ย้ายไป domain ไหนก็ใช้ได้)
> ส่วนกล่อง `📍 ในโปรเจคนี้:` คือตัวอย่างจริงจากระบบจองคิว — เป็นภาพประกอบ ไม่ใช่ข้อบังคับ
> ถ้า domain ปลายทางคล้ายกัน (แชตบอต/จอง/บริการภาษาไทย) ให้ลอกตัวอย่างพวกนี้ตรงๆ ได้เลย
> เพราะ "ความฉลาด" ส่วนใหญ่อยู่ในรายละเอียดพวกนี้ ไม่ได้อยู่ที่ตัวโมเดล
>
> ส่วนสุดท้าย **§10 "วิธี Port ไป domain ของคุณ"** คือหัวใจที่ทำให้เอกสารนี้เป็น *พิมพ์เขียว* ไม่ใช่แค่ *คำอธิบาย*

---

## 0. ปรัชญาหลัก (อ่านก่อนอย่างอื่น)

ระบบนี้ไม่ได้ฉลาดเพราะ "ใช้โมเดลใหญ่" — มันฉลาดเพราะ **สถาปัตยกรรมรอบๆ โมเดล** 5 ความเชื่อ:

1. **LLM คือทรัพยากรแพงและไม่แน่นอน → เรียกให้น้อยที่สุด และอย่าไว้ใจมันเรื่อง logic**
   งานที่ตัดสินด้วยกฎได้ (missing field, business rule, วันปิดร้าน) → ทำใน Python ล้วน
   ใช้ LLM เฉพาะสิ่งที่มันเก่งจริง: **แปลภาษาธรรมชาติ → ข้อมูลมีโครงสร้าง** และ **เรียบเรียงคำตอบ**

2. **ประหยัดต้นทุน *ก่อน* ความฉลาด** — ทุก request ผ่าน "ตะแกรงกรอง" ที่พยายาม
   ตอบโดยไม่เรียก LLM เลย ก่อนจะยอมจ่ายค่า token

3. **ตัดสินใจต้อง deterministic + ทดสอบได้** — แยก "ตรรกะการตัดสินใจ" (pure function)
   ออกจาก I/O และออกจาก LLM เพื่อให้เขียน golden test ครอบได้ 100%

4. **สนทนาต่อเนื่องต้องมี state ชัดเจนและ persist** — ไม่ใช่ยัดประวัติทั้งหมดกลับเข้า LLM
   ทุก turn แต่เก็บ state machine ที่ enumerate ได้จริง

5. **ล่มไม่ได้ และต้องรู้ตัวเมื่อพัง** — มี fallback ทุกชั้น (โมเดลสำรอง, keyword แทน embedding,
   ข้อความขอโทษแทน loop) + log ทุก path เพื่อวัดคุณภาพและจับ bug ที่ "พังเงียบ"

---

## 1. ภาพรวม Pipeline (มองครั้งเดียวเห็นทั้งระบบ)

```
ผู้ใช้พิมพ์ข้อความ
      │
      ▼
[A] Webhook / Entry point ──► ตรวจตัวตน + หา "tenant/context" ที่เกี่ยวข้อง
      │
      ▼
[B] มี state ค้างอยู่ไหม?  (ดึงจาก store: conversation_states)
      │
      ├── มี state ──► เข้า State Machine ที่ค้างไว้ (§4)
      │
      └── ไม่มี ──►
             ▼
        [C] 3-Layer Token Reduction (§2)
             Layer 1: Bypass — ตอบ/รู้ intent โดยไม่เรียก LLM เลย
             Layer 2: Compress — ตัด filler, normalize
             Layer 3: Optimized prompt — system prompt อังกฤษ + JSON mode
             │
             ▼
        [D] extract_intent (LLM call, JSON + confidence) (§3)
             │  fallback: OpenAI → DeepSeek อัตโนมัติ
             ▼
        [E] Intent Normalizer — ข้อความดิบ → label มาตรฐาน (§3)
             │
             ▼
        [F] แยกทาง:
             ├─ intent = "งานหลัก" (จอง) ──► State Machine (§4) + Reasoning Engine (§5)
             └─ intent = "ถามข้อมูล"      ──► Q&A Pipeline (§6) + Self-Learning (§7)
      │
      ▼
[G] ตอบกลับ + persist state ใหม่ + log metrics (§8)
```

**กฎเหล็ก:** ยิ่งขั้นตอนอยู่ *บน* (ซ้าย) ยิ่งถูกและเร็ว — ระบบพยายามจบให้เร็วที่สุดเสมอ
ค่า token/latency จะเกิดเฉพาะเมื่อขั้นถูกๆ ตอบไม่ได้จริงๆ

---

## 2. Pattern #1 — ประหยัด Token 3 ชั้น (Cost-control ก่อน Intelligence)

> **นี่คือ pattern ที่ต่างจากบอตทั่วไปมากที่สุด** และคือเหตุผลที่ระบบนี้รันได้ในต้นทุนต่ำ

### Layer 1 — Bypass: ตอบโดยไม่เรียก LLM เลย
ใช้ **regex + local resolver + lookup table** จับเคสที่ "ชัดเจนพอ" แล้วคืนผลทันที:
- คำสั่งที่รูปแบบตายตัว (ทักทาย, ยกเลิก, ขอดูรายการ)
- แปลง "ค่าธรรมชาติ" เป็น "ค่ามีโครงสร้าง" ด้วยตาราง lookup แทนที่จะให้ LLM เดา

📍 **ในโปรเจคนี้** (`utils/thai_token_optimizer.py`):
- ตาราง `_THAI_TIMES`: `"บ่ายสอง" → "14:00"`, `"ห้าโมงเย็น" → "17:00"` (คำเวลาไทย ~60 คำ)
- ตาราง `_RELATIVE_DATES` + `_THAI_WEEKDAYS`: `"พรุ่งนี้"→+1`, `"วันเสาร์หน้า"→คำนวณ ISO date`
- `_resolve_special_date`: `"ต้นเดือนหน้า"`, `"สิ้นเดือน"` → วันที่จริง (เคสที่คำนวณเป็น day-offset ไม่ได้)
- ถ้าจับ "จอง + วัน + เวลา" ครบจาก lookup ได้ → สร้าง booking intent เลย **ไม่แตะ LLM**
  ถ้าได้ไม่ครบ (เช่น เวลากำกวม) → คืน `None` = ตกลงไปให้ LLM

> **ทำไมสำคัญ:** ภาษาไทยกิน token 2–4 เท่าของอังกฤษ การ resolve ด้วยตารางจึงประหยัดมหาศาล
> และ **แม่นกว่า** LLM ในเคสตายตัว (LLM เดา timezone/ปีพ.ศ. พลาดได้ ตารางไม่พลาด)

### Layer 2 — Compress: บีบข้อความก่อนส่ง LLM
- ตัด "คำลงท้าย/filler" ที่ไม่มีความหมายเชิง intent (ครับ/ค่ะ/นะคะ/หน่อย/จ้า)
- normalize: เลขไทย `๑๒๓→123`, ยุบ whitespace ซ้ำ
- ลด token ~20–35% บนข้อความลูกค้าทั่วไป

### Layer 3 — Optimized Prompt: prompt อังกฤษ + JSON-only output
- **เขียน system prompt เป็นภาษาอังกฤษ** แม้ผู้ใช้พิมพ์ไทย → ประหยัด token ของ instruction มหาศาล
- บังคับ `response_format={"type":"json_object"}` → output กระชับ parse ง่าย ไม่มี markdown ฟุ่มเฟือย
- ใส่เฉพาะ context ที่จำเป็น (รายชื่อบริการ, วันเปิด, few-shot 4 ตัวอย่าง) — ไม่ยัดทั้งฐานข้อมูล

📍 ทุกการเรียก LLM log `token reduction %` + `actual_tokens` เพื่อเฝ้าต้นทุนจริง

---

## 3. Pattern #2 — สกัด Intent แบบมีโครงสร้าง + Confidence + Provider Fallback

### 3.1 Structured extraction (LLM → JSON schema ตายตัว)
LLM มีหน้าที่เดียว: **แปลงข้อความ → dict ที่มี schema แน่นอน** ไม่ต้องตัดสินใจ workflow

📍 schema ในโปรเจคนี้ (ดู `utils/thai_token_optimizer.py::build_optimized_prompt`):
```json
{"intent":"book_appointment","confidence":1.0,"date":"YYYY-MM-DD","time":"HH:MM","service":str|null,"staff":str|null,"name":str|null}
{"intent":"cancel","confidence":1.0,"booking_ref":str|null}
{"intent":"ask_info","confidence":1.0,"faq_type":"[price|hours|capacity|location|promotion|staff|general]",...}
{"intent":"greeting"|"unknown"|"list_bookings"|"check_availability"|"reschedule", ...}
```
หลักการออกแบบ prompt:
- ระบุ **วันนี้คือวันที่เท่าไร + วันอะไร** ในprompt เสมอ (LLM ไม่รู้เวลาปัจจุบัน)
- ให้ `confidence: 0.0–1.0` เพื่อให้ layer ถัดไปตัดสินใจได้ว่าจะถามยืนยันหรือเดินหน้า
  (เช่น "อยากนวด" → book_appointment confidence 0.55 = คลุมเครือ อาจเป็นคำถามก็ได้)
- ใส่ **few-shot examples** ที่ครอบเคสกำกวม (คำถาม vs คำสั่งจอง)
- `Unknown field → null` เป็นกฎ ไม่ให้ LLM แต่งค่าเอง

### 3.2 Confidence-driven fallback ในโค้ด
ถ้า LLM คืน `unknown` แต่ข้อความ match ชื่อบริการจริง → เริ่ม flow ให้เลย (โค้ด override LLM)
→ **อย่าเชื่อ LLM 100% เมื่อกฎ deterministic เถียงได้**

### 3.3 Provider fallback chain (ไม่ผูกกับเจ้าเดียว)
📍 `services/ai_agent.py::_chat_completion`:
```python
try:
    return await openai_client.chat.completions.create(model=OPENAI_MODEL, **kwargs)
except Exception as e:
    if deepseek_client:              # ถ้า OpenAI ล่ม/quota หมด
        return await deepseek_client.chat.completions.create(model=DEEPSEEK_MODEL, **kwargs)
    raise
```
- โมเดลจอง: `temperature=0.0` (ต้องแม่น ไม่สุ่ม) + JSON mode
- โมเดลตอบคำถาม: `temperature=0.6` (ให้เป็นธรรมชาติ) + `max_tokens` จำกัด

### 3.4 Intent Normalizer (ชั้นกลางระหว่าง LLM กับ state machine)
แปลข้อความสั้นๆ ของผู้ใช้ระหว่าง flow → label มาตรฐานด้วย synonym table (ไม่เรียก LLM):
`CONFIRM / CANCEL / MODIFY / RESTART / DECLINE / UNCERTAIN / GREETING / THANK_YOU / GOODBYE`
พร้อม **ลำดับความสำคัญ**: `CANCEL > RESTART > MODIFY > CONFIRM > DECLINE`
(คำที่ "ทำลายล้าง/เจาะจง" กว่า ชนะ — กันเคส "ยกเลิกการเปลี่ยน" ถูกอ่านผิดเป็น MODIFY)

---

## 4. Pattern #3 — State Machine ที่ enumerate ได้ + persist ทุก turn

**อย่าใช้ "ความจำของ LLM" เป็น state** — เก็บ state เป็น enum จริงใน DB

📍 เก็บใน MongoDB `conversation_states` (key = `user_id` + `tenant_id`):
- `state` = สถานะปัจจุบัน, `bk` = ข้อมูลที่สะสมมาเรื่อยๆ (accumulator dict)

รายการ state (ตัวอย่างจากโปรเจคนี้ — domain คุณจะมีชุดของตัวเอง):

| State | ความหมาย |
|---|---|
| *(ว่าง)* | ข้อความใหม่ → สกัด intent → เริ่ม flow |
| `bk_active` | โหมด AI รวม — สกัด intent ทุก turn, merge เข้า `bk`, ให้ engine ตัดสิน |
| `bk_service` / `bk_time` / `bk_pax` / `bk_name_phone` | กำลังถามฟิลด์นั้นๆ |
| `bk_custom_q` | คำถามเพิ่มเติมที่ตั้งค่าได้ (ทีละข้อ) |
| `bk_confirm` | โชว์การ์ดสรุป รอยืนยัน |
| `bk_confirm_asking_edit` | ผู้ใช้ขอแก้ฟิลด์ → ถามค่าใหม่ |
| `bk_ask_continue` | ผู้ใช้ถามแทรกกลางคัน → ตอบแล้วถามว่าจะทำต่อไหม |
| `bk_pending_payment` | รอหลักฐาน (กันข้อความอื่นมาล้าง state) |
| `cancel_confirmation` | รอเลือก/ยืนยันว่าจะยกเลิกอันไหน |

**เทคนิคสำคัญ — "merge intent per turn":** ในโหมด `bk_active` ทุกข้อความใหม่จะถูกสกัด intent
แล้ว **merge เข้าdict สะสม** (ไม่ใช่เริ่มใหม่) ผู้ใช้จึงพูดข้อมูลมาไม่เรียงลำดับก็ได้:
"จองพรุ่งนี้" → "ตัดผม" → "บ่ายสอง" → "ชื่อสมชาย" ค่อยๆ เติมจนครบ

**Auto-expire:** state ที่ค้างเกิน N นาที (เช่น 30 นาที) ถูกล้างทิ้ง กัน state ค้างข้ามวัน
(📍 `deploy/...expire_abandoned_booking_flow_30min.py`)

---

## 5. Pattern #4 — Reasoning Engine แยกออกจาก I/O และ LLM (pure function)

> **นี่คือหัวใจที่ทำให้ "ฉลาดแบบทดสอบได้"** — การตัดสินใจว่า "จะถามอะไรต่อ" ไม่ได้อยู่ใน
> prompt และไม่ได้อยู่ปนกับโค้ด DB มันเป็น **ฟังก์ชัน Python บริสุทธิ์**

📍 `services/booking_reasoning_engine.py` — 3 เฟสชัดเจนใน orchestrator:

```
เฟส 1: DB Prep      — ดึงข้อมูลจาก DB (slot ว่าง, บริการ, กฎร้าน) เติมลง bk
เฟส 2: Engine Decide — engine.decide(bk, ...) → ReasoningDecision   ← ไม่มี I/O เลย
เฟส 3: Response Map  — แปลง decision → ข้อความ/ปุ่มบน channel
```

`decide()` รับ dict ที่ enrich แล้ว → คืน `ReasoningDecision` ที่มี action หนึ่งใน:
- `ask_field` — ยังขาดฟิลด์หลัก (+ `slot_context`: near_slots / out_of_range / date_full / normal)
- `ask_custom_q` — ต้องถามคำถามเพิ่มเติม
- `coupon` — ขั้นตอนคูปอง
- `confirm` — ครบแล้ว โชว์การ์ดยืนยัน
- `rule_violation` — ผิดกฎธุรกิจ

**ประโยชน์ที่จับต้องได้:**
1. เขียน **golden test** ครอบทุก decision ได้ (input dict → expected action) โดยไม่ต้องมี DB/LLM
   (📍 `tests/test_conversation_regression.py`)
2. เปลี่ยน channel (LINE→เว็บ→Messenger) แก้แค่เฟส 3 ตรรกะไม่ต้องแตะ
3. debug ง่าย — decision เป็นค่าเดียวที่ inspect ได้ ไม่ใช่ "LLM คิดอะไรอยู่"

`validate_business_rules()` (pure) เช็คกฎเช่น จองล่วงหน้าเกินกำหนด / จำนวนคนเกิน → คืน `rule_violation`
ก่อนถึงการ์ดยืนยัน — **กฎธุรกิจไม่เคยฝากไว้กับ LLM**

---

## 6. Pattern #5 — Q&A Pipeline หลายชั้น (ถูกสุด → แพงสุด)

เมื่อผู้ใช้ "ถามข้อมูล" (ไม่ใช่สั่งงาน) ระบบไล่ตอบจากชั้นที่ถูกที่สุดก่อน:

```
1. Static fast-path   — ตอบจาก DB ตรงๆ ไม่เรียก LLM  (ราคา/เวลาเปิด/ที่อยู่/โปรฯ/รายชื่อทีม)
2. Semantic cache     — embed คำถาม → cosine กับคำถามเก่าที่เคยตอบสำเร็จ → ใกล้พอคืนเลย
3. RAG + LLM          — top-k chunks ที่เกี่ยวข้อง + ประวัติแชท → LLM เรียบเรียง → cache กลับ
4. Fallback           — RAG ล่ม → ใช้ full context ; ทุก turn log outcome
```

### RAG (Retrieval-Augmented Generation) — อย่ายัด context ทั้งก้อน
📍 `services/rag_context.py`:
1. แตก context ร้านเป็น chunks (ทำครั้งเดียว, rebuild ทุก 6 ชม.)
2. embed + เก็บใน DB (`text-embedding-3-small`)
3. ทุกคำถาม: embed → cosine similarity → เอา **top 4 chunk** ที่เกี่ยวข้อง (`_TOP_K=4`)
4. floor `_RAG_MIN_SCORE=0.30` — chunk ที่ไม่เกี่ยวจริงถูกตัดทิ้ง

**Keyword fallback (embedding ใช้ไม่ได้):** ถ้า embed ล้มเหลว/ไม่มี key → จัดอันดับด้วย
bigram keyword score แทน cosine → **ระบบยังตอบได้ ไม่ล่ม** (คืน `[]` ไม่ throw)

**Cache มีเพดาน:** vector cache ในโปรเซสจำกัด 5000 entries (เต็มแล้ว clear) กัน memory โตไม่จำกัด

---

## 7. Pattern #6 — Self-Learning + การแยก UNKNOWN vs OFFTOPIC (อย่าสัญญาลวง)

AI แยกคำถามที่ตอบไม่ได้เป็น **2 ประเภท คนละ token** เพื่อไม่ให้ "โกหกด้วยความสุภาพ":

| กรณี | token | ผู้ใช้เห็น | log ให้เจ้าของ? |
|---|---|---|---|
| **คำถามในขอบเขต แต่ยังไม่มีข้อมูล** ("นวดมีน้ำมันไหม") | `[UNKNOWN]` | "ขอเช็คกับทางร้าน เดี๋ยวแอดมินตอบให้" | ✅ log |
| **คำถามนอกเรื่อง** (อากาศ/ที่เที่ยว/ร้านอื่น) | `[OFFTOPIC]` | ปฏิเสธสุภาพตรงๆ + ชวนกลับเข้าเรื่อง | ❌ ไม่ log |

> **บทเรียนสำคัญ:** เดิมตอบ "ขอเช็คให้" กับทุกอย่าง → คำถามนอกเรื่อง (ที่ร้านตอบแทนไม่ได้อยู่ดี)
> กลายเป็น **คำสัญญาลวง** แก้โดยแยก 2 เคสนี้ออกจากกัน

**วงจร self-learning:**
1. คำถาม `[UNKNOWN]` → `log_unanswered()` เก็บลง `unanswered_questions` (dedupe + สะสม `user_ids` ทุกคนที่ถาม)
2. เจ้าของ/แอดมินมาตอบทีหลัง → `add_learned()` เก็บเข้า `learned_qa` (+ embedding)
3. ครั้งต่อไป AI ตอบเองได้ + **push คำตอบกลับหาทุกคนที่เคยถาม** (ข้ามคนที่กำลังทำงานอยู่)

**Prompt-injection guard:** ต่อท้าย prompt ทุกครั้ง (`INJECTION_GUARD`) — ห้ามเปลี่ยนบทบาท,
ห้ามเปิดเผยคำสั่งระบบ, ห้ามพูดแทนร้านอื่น — **แม้เจ้าของจะตั้ง persona เอง**

---

## 8. Pattern #7 — Guardrails + Observability (ฉลาดแต่ต้องคุมได้และรู้ตัวเมื่อพัง)

### Guardrails
- **Prompt-injection guard** (§7) — backstop กันผู้ใช้ยึด prompt
- **Business-rule validation** เป็น pure function (§5) — ไม่ฝากกฎไว้กับ LLM
- **AI ล่มไม่ loop:** ถ้า LLM error 2 ครั้งติด → แสดงข้อความขอโทษ ไม่วนไม่รู้จบ
- **Structured output + confidence** (§3) — กันคำตอบเพี้ยนหลุด schema

### Observability (จับ bug ที่ "พังเงียบ")
- **Per-turn metrics:** log ทุก interaction (ข้อความ, intent, state, latency) แบบ fire-and-forget ไม่ block reply
- **AI-health card:** วัด handled / unknown / off-topic rate + tokens ต่อ Q&A → เห็นคุณภาพจริง
- **Silent-failure logging:** `log_internal_error()` — except แบบ "never raise" ที่ห่อ DB write
  จะ log ระดับ ERROR (tag `[SILENT-FAIL]`) + เก็บลง `internal_errors`

> **บทเรียน anti-pattern:** try/except ที่ "never raise" เพื่อกัน flow ล่ม → กลืน bug การเขียน DB
> จนคำถามลูกค้าหายทั้งระบบโดยไม่มีใครรู้ **ทางแก้ไม่ใช่เอา try/except ออก แต่คือ route ผ่าน
> `log_internal_error` เสมอ** เพื่อให้ error "ดังขึ้น" บน dashboard แม้ flow ไม่ล่ม

---

## 9. Pattern #8 — Shared Cross-Worker Cache (เมื่อ scale หลาย worker)

📍 `services/cache.py` — Redis-backed (+ in-proc fallback ที่ไม่มีวัน raise)

> **บทเรียน:** cache ที่เป็น `dict` ในแต่ละ worker → แก้ config แล้วค่าค้าง (worker อื่นไม่รู้)
> ย้ายมา Redis ที่ **invalidate ทีเดียวถึงทุก worker พร้อมกัน** — สิ่งที่ cache: context ร้าน,
> กฎ AI, learned_qa, few-shot examples, flow config

**กฎ Mongo ที่เจ็บมาแล้ว:** ห้ามรวม operator หลายตัวบน **field เดียวกัน** ใน update เดียว
(`$setOnInsert` + `$addToSet` บน `user_ids` = path conflict → write ล้มเงียบ) → แยกเป็น 2 update

---

## 10. 🎯 วิธี Port ไป Domain ของคุณ (ส่วนที่ทำให้นี่เป็น "พิมพ์เขียว")

ทำตามลำดับนี้ แต่ละ pattern บอกว่า **"เปลี่ยนอะไร"** เมื่อย้าย domain:

### ขั้น 1 — นิยาม Intent & Schema (§3)
- [ ] ลิสต์ intent ของ domain คุณ (จองคิว → เช่น สั่งอาหาร: `order / add_item / checkout / track / cancel`)
- [ ] เขียน JSON schema ต่อ intent + ใส่ `confidence` เสมอ
- [ ] เขียน few-shot 4–8 ตัวอย่าง เน้น **เคสกำกวม** ของ domain คุณ
- [ ] ใส่ "วันนี้คือ..." / context เวลาจริง ถ้า domain เกี่ยวกับเวลา

### ขั้น 2 — สร้างตาราง Bypass (§2) ← **ที่นี่คือ "ความฉลาดราคาถูก" ส่วนใหญ่**
- [ ] หา "ค่าธรรมชาติ → ค่ามีโครงสร้าง" ที่ resolve ด้วยตารางได้ (เวลา/วัน/หน่วย/ชื่อสินค้า)
- [ ] หา intent รูปแบบตายตัวที่ regex จับได้ (ทักทาย/ยกเลิก/เช็คสถานะ)
- [ ] เขียน filler list ของภาษาคุณ (§2 Layer 2)
- ⚠️ ถ้า domain ปลายทางเป็นไทย/จองบริการ → **ลอกตาราง `_THAI_TIMES`, `_THAI_WEEKDAYS`,
  `_RELATIVE_DATES`, filler list มาตรงๆ ได้เลย** ความฉลาดอยู่ในตารางพวกนี้

### ขั้น 3 — ออกแบบ State Machine (§4)
- [ ] วาดสถานะทั้งหมดของ flow หลัก (enumerate ให้ครบ อย่าปล่อยให้ implicit)
- [ ] เลือก accumulator dict (`bk` เทียบเท่า) + key ของ state (`user_id`+`context_id`)
- [ ] ตั้ง auto-expire (เช่น 30 นาที)
- [ ] ใส่ state พิเศษ: "ถามแทรกกลางคัน", "ขอแก้ฟิลด์", "รอ external (payment/สลิป)"

### ขั้น 4 — เขียน Reasoning Engine เป็น pure function (§5)
- [ ] `_FIELD_CHECKS`: ฟิลด์ไหน "ครบ" เมื่อไร
- [ ] `next_flow_step()`: ลำดับถามฟิลด์
- [ ] `validate_business_rules()`: กฎธุรกิจของคุณ (pure, ไม่มี I/O)
- [ ] แยก 3 เฟส DB-Prep / Decide / Response-Map ให้เด็ดขาด
- [ ] เขียน golden test ครอบทุก decision **ก่อน** ต่อกับ LLM จริง

### ขั้น 5 — สร้าง Q&A Pipeline + RAG (§6)
- [ ] แหล่งความรู้ของคุณคืออะไร (ในนี้คือ context ร้าน) → แตกเป็น chunks
- [ ] เลือก embedding model + ตั้ง `TOP_K` และ `MIN_SCORE` floor
- [ ] ทำ static fast-path สำหรับคำถามยอดฮิตที่ตอบจาก DB ได้
- [ ] ใส่ keyword fallback เผื่อ embedding ล่ม

### ขั้น 6 — Self-Learning + Guard (§7–8)
- [ ] แยก `[UNKNOWN]` (ในขอบเขต) vs `[OFFTOPIC]` (นอกขอบเขต) — อย่าสัญญาลวง
- [ ] วงจร: log คำถามตอบไม่ได้ → คนมาตอบ → learned store → ตอบเองครั้งหน้า
- [ ] ต่อ prompt-injection guard ทุก prompt
- [ ] provider fallback chain (เจ้าหลัก → เจ้าสำรอง)

### ขั้น 7 — Observability (§8)
- [ ] log ทุก turn (intent, state, latency, outcome) แบบ fire-and-forget
- [ ] route try/except "never raise" ทุกจุดผ่าน `log_internal_error` เทียบเท่า
- [ ] ทำ health metric (handled/unknown/offtopic rate) ให้เห็นคุณภาพจริง

---

## 11. Checklist "ระบบฉลาดจริงหรือยัง"

- [ ] เคสง่ายๆ (ทักทาย/ค่าตายตัว) **ไม่เรียก LLM เลย** ใช่ไหม?
- [ ] กฎธุรกิจ + การตัดสินใจ workflow อยู่ใน **pure function ที่ test ได้** ไม่ใช่ใน prompt?
- [ ] state เป็น enum จริงใน DB ไม่ใช่ "ความจำ LLM"?
- [ ] LLM error/quota หมด แล้วระบบ **ยังตอบได้** (fallback โมเดล/keyword/ข้อความขอโทษ)?
- [ ] คำถามนอกเรื่อง ถูกปฏิเสธตรงๆ **ไม่สัญญาลวง**?
- [ ] มี dashboard บอก unknown/offtopic rate + จับ error ที่พังเงียบ?
- [ ] token ต่อ request วัดได้ และมีชั้นบีบอัดก่อนส่ง LLM?

ถ้าตอบ "ใช่" ครบ 7 ข้อ = ได้ความฉลาดในแบบเดียวกับระบบนี้

---

## 12. ตารางไฟล์อ้างอิง (source-of-truth ในโปรเจคต้นทาง)

| Pattern | ไฟล์ |
|---|---|
| Entry + orchestration + state machine | `api/webhooks.py` (`_orchestrate_ai_booking_flow`, `_process_bk_active`) |
| LLM calls + provider fallback | `services/ai_agent.py` |
| 3-layer token reduction + bypass tables | `utils/thai_token_optimizer.py` |
| Reasoning engine (pure) | `services/booking_reasoning_engine.py` |
| Intent merge + business rules | `services/booking_intent_merger.py` |
| Intent normalizer + synonyms | `services/intent_normalizer.py` (+ `intent_synonyms.json`) |
| RAG retrieval | `services/rag_context.py` |
| Self-learning / knowledge store | `services/knowledge_store.py` |
| Shared cross-worker cache | `services/cache.py` |
| Analytics / metrics | `services/ai_analytics.py`, `services/learning_store.py` |
| โมเดล + พารามิเตอร์ | `config.py` |

> เอกสารบรรยายฉบับเต็ม (เฉพาะ domain จองคิว ภาษาไทย) อยู่ที่ `AI_LINE_OA_Overview.md`
> ฉบับนี้ (`AI_Intelligence_Blueprint.md`) คือฉบับ **พกพา/ generalize** สำหรับ port ไป domain อื่น

---

## TL;DR (1 ย่อหน้า)

ความฉลาดไม่ได้อยู่ที่โมเดล — อยู่ที่ **8 pattern รอบโมเดล**:
(1) กรอง token 3 ชั้น+ bypass ตอบโดยไม่เรียก LLM,
(2) สกัด intent เป็น JSON + confidence + fallback หลายเจ้า,
(3) state machine ที่ enumerate + persist ทุก turn,
(4) reasoning engine เป็น pure function แยกจาก I/O และ LLM (test ได้),
(5) Q&A pipeline ไล่ถูก→แพง + RAG,
(6) self-learning ที่แยก unknown/offtopic ไม่สัญญาลวง,
(7) guardrails (injection guard, business rules, ไม่ loop),
(8) observability ที่จับ bug พังเงียบ + shared cache ตอน scale
ทำครบ = AI ที่ **ฉลาด ถูก และไม่ล่ม** — ย้าย domain ได้ด้วย §10
