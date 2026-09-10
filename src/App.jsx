// App.jsx
// نسخه 3.0 — کامل با همه قابلیت‌ها
// چک‌این روزانه + لحظه‌های برد + SOS + تقویم + جمله‌های مهربان

import React, { useState, useEffect, useMemo } from "react";

import {
  SCHEMAS,
  DOMAINS,
  resolveExercise,
  getReplacementResponse
} from "./SCHEMAS";

import {
  ExerciseRenderer,
  resolveExerciseFromRule
} from "./EXERCISES";

import {
  YSQ_QUESTIONS,
  LIKERT_SCALE,
  analyzeYSQ,
  validateAnswers,
  buildResultPayload
} from "./YSQ_QUESTIONS";

import {
  recordCycle,
  buildProgressSummary,
  registerIdLabels,
  toFa,
  saveProfile,
  loadProfile,
  getWins,
  describeWin,
  addCheckIn,
  hasCheckedInToday,
  getTodayCheckIn,
  getCalendarData
} from "./PROGRESS";

import {
  getMicroMissions,
  getCompassionatePhrases,
  getTodayPrompt
} from "./EXTRAS";

/* =========================================================
 * ۰. ثبت برچسب‌ها
 * ========================================================= */

const LABELS = {};
for (const s of SCHEMAS) {
  LABELS[s.id] = s.name_fa;
  for (const t of s.triggers) LABELS[t.id] = t.text;
  for (const th of s.automatic_thoughts) LABELS[th.id] = th.text;
  for (const e of s.emotional_signals) LABELS[e.id] = e.text;
  for (const b of s.behavioral_patterns) LABELS[b.id] = b.text;
}
registerIdLabels(LABELS);

/* =========================================================
 * ۱. کامپوننت‌های پایه
 * ========================================================= */

function Shell({ children, title, onBack, showQuickButton, onQuick, showSOS, onSOS }) {
  return (
    <div dir="rtl" style={styles.app}>
      <header style={styles.header}>
        {onBack ? (
          <button onClick={onBack} style={styles.backBtn}>→</button>
        ) : (
          <div style={{ width: 32 }} />
        )}
        <div style={styles.headerTitle}>{title}</div>
        {showSOS ? (
          <button onClick={onSOS} style={styles.sosHeaderBtn}>SOS</button>
        ) : (
          <div style={{ width: 32 }} />
        )}
      </header>

      <main style={styles.main}>{children}</main>

      {showQuickButton && (
        <button onClick={onQuick} style={styles.quickBtn}>
          ⚡ همین الان فعال شد
        </button>
      )}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled }) {
  const v = {
    primary: styles.btnPrimary,
    ghost: styles.btnGhost,
    danger: styles.btnDanger
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles.btn,
        ...v,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer"
      }}
    >
      {children}
    </button>
  );
}

function Card({ children, style }) {
  return <div style={{ ...styles.card, ...style }}>{children}</div>;
}

function ProgressBar({ value, max = 100, color = "#111", height = 8 }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ height, background: "#eee", borderRadius: 6, overflow: "hidden" }}>
      <div
        style={{
          height: "100%",
          width: pct + "%",
          background: color,
          transition: "width .4s ease"
        }}
      />
    </div>
  );
}

/* =========================================================
 * ۲. چک‌این روزانه
 * ========================================================= */

function CheckInView({ onDone, onSkip }) {
  const [phase, setPhase] = useState("mood");
  const [mood, setMood] = useState(null);
  const [schemaId, setSchemaId] = useState(null);
  const [note, setNote] = useState("");

  const prompt = getTodayPrompt();
  const activeSchemas = SCHEMAS.filter((s) => s.id).slice(0, 18);

  if (phase === "mood") {
    return (
      <Shell title="صبح بخیر">
        <Card>
          <p style={{ margin: "0 0 6px", fontSize: 14, color: "#888" }}>
            {prompt}
          </p>
          <p style={{ margin: "20px 0 16px", fontSize: 16, fontWeight: 600 }}>
            امروز چه احساسی داری؟
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={() => { setMood("good"); setPhase("schema"); }} style={styles.moodBtn}>
              <span style={{ fontSize: 28 }}>😊</span>
              <span style={{ fontSize: 15 }}>خوب</span>
            </button>
            <button onClick={() => { setMood("meh"); setPhase("schema"); }} style={styles.moodBtn}>
              <span style={{ fontSize: 28 }}>😐</span>
              <span style={{ fontSize: 15 }}>متوسط</span>
            </button>
            <button onClick={() => { setMood("hard"); setPhase("schema"); }} style={styles.moodBtn}>
              <span style={{ fontSize: 28 }}>😔</span>
              <span style={{ fontSize: 15 }}>سخت</span>
            </button>
          </div>
        </Card>

        <div style={{ marginTop: 16 }}>
          <Btn variant="ghost" onClick={onSkip}>رد کن</Btn>
        </div>
      </Shell>
    );
  }

  if (phase === "schema") {
    return (
      <Shell title="صبح بخیر" onBack={() => setPhase("mood")}>
        <Card>
          <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 600 }}>
            کدام الگو امروز فعال‌تر است؟
          </p>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#888" }}>
            اگر مطمئن نیستی، رد کن — بعداً می‌توانی ثبت کنی.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
            {activeSchemas.map((s) => (
              <button
                key={s.id}
                onClick={() => setSchemaId(s.id)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: schemaId === s.id ? "2px solid #111" : "1px solid #e5e5e5",
                  background: schemaId === s.id ? "#111" : "#fff",
                  color: schemaId === s.id ? "#fff" : "#333",
                  fontSize: 14,
                  textAlign: "right",
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
              >
                {s.name_fa}
              </button>
            ))}
          </div>
        </Card>

        <div style={{ marginTop: 16 }}>
          <Btn onClick={() => setPhase("note")}>بعدی</Btn>
          <div style={{ marginTop: 8 }}>
            <Btn variant="ghost" onClick={() => setPhase("note")}>
              مطمئن نیستم
            </Btn>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "note") {
    return (
      <Shell title="صبح بخیر" onBack={() => setPhase("schema")}>
        <Card>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
            چیز دیگری می‌خواهی بگویی؟ (اختیاری)
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="هر چیزی که به ذهنت می‌آید..."
            style={styles.textarea}
          />
        </Card>

        <div style={{ marginTop: 16 }}>
          <Btn
            onClick={async () => {
              await addCheckIn({ mood, schemaId, note });
              onDone();
            }}
          >
            ثبت کن
          </Btn>
        </div>
      </Shell>
    );
  }

  return null;
}

/* =========================================================
 * ۳. حالت SOS
 * ========================================================= */

function SOSView({ onBack, onBetter }) {
  const [phase, setPhase] = useState("breathe");
  const [seconds, setSeconds] = useState(4);
  const [cycle, setCycle] = useState(0);

  // چرخه تنفس ۴-۷-۸
  const BREATH_PHASES = [
    { name: "دم", dur: 4 },
    { name: "نگه‌دار", dur: 7 },
    { name: "بازدم", dur: 8 }
  ];

  const [breathIdx, setBreathIdx] = useState(0);
  const [countdown, setCountdown] = useState(BREATH_PHASES[0].dur);

  useEffect(() => {
    if (phase !== "breathe") return;
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          const next = (breathIdx + 1) % BREATH_PHASES.length;
          setBreathIdx(next);
          setCycle((cy) => cy + (next === 0 ? 1 : 0));
          return BREATH_PHASES[next].dur;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, breathIdx]);

  const phrases = useMemo(() => {
    const all = [];
    for (const s of SCHEMAS) {
      const p = getCompassionatePhrases(s.id);
      for (const ph of p) all.push(ph);
    }
    return all;
  }, []);

  const [randomPhrase] = useState(
    () => phrases[Math.floor(Math.random() * phrases.length)]
  );

  if (phase === "breathe") {
    const current = BREATH_PHASES[breathIdx];
    return (
      <div dir="rtl" style={styles.sosFull}>
        <div style={{ padding: 20, textAlign: "center" }}>
          <h2 style={{ color: "#fff", fontSize: 20, margin: "0 0 30px" }}>
            این هم می‌گذرد
          </h2>

          <div style={styles.breathCircle}>
            <div style={styles.breathInner}>
              <div style={{ fontSize: 40, fontWeight: 700, color: "#fff" }}>
                {toFa(countdown)}
              </div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,.7)", marginTop: 4 }}>
                {current.name}
              </div>
            </div>
          </div>

          <p style={{ color: "rgba(255,255,255,.8)", fontSize: 14, margin: "30px 0 20px", lineHeight: 1.9 }}>
            با من نفس بکش.
            <br />
            فقط همین لحظه کافی است.
          </p>

          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 10, maxWidth: 320, margin: "40px auto 0" }}>
            <button
              onClick={() => setPhase("phrase")}
              style={{
                padding: 14,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,.3)",
                background: "transparent",
                color: "#fff",
                fontSize: 15,
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              حالم کمی بهتره
            </button>
            <button
              onClick={onBack}
              style={{
                padding: 14,
                borderRadius: 12,
                border: "none",
                background: "transparent",
                color: "rgba(255,255,255,.5)",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              بازگشت
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "phrase") {
    return (
      <div dir="rtl" style={styles.sosFull}>
        <div style={{ padding: 30, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh" }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>💙</div>

          <p style={{ color: "#fff", fontSize: 18, lineHeight: 2, margin: "0 0 40px" }}>
            {randomPhrase}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320, margin: "0 auto" }}>
            <button
              onClick={onBetter}
              style={{
                padding: 14,
                borderRadius: 12,
                border: "none",
                background: "#fff",
                color: "#111",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              ادامه
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

/* =========================================================
 * ۴. صفحه خوش‌آمد
 * ========================================================= */

function WelcomeView({ onStart, onSkipToProfile, hasProfile, phrase, onSOS }) {
  return (
    <Shell title="الگوهای من" showSOS onSOS={onSOS}>
      <Card>
        <h2 style={{ margin: "0 0 8px", fontSize: 22 }}>
          چه چیزی در من تکرار می‌شود؟
        </h2>
        <p style={{ color: "#666", fontSize: 14, lineHeight: 1.8, margin: 0 }}>
          اینجا قرار نیست برچسبی به تو بزنیم.
          قرار است با هم ببینیم چه الگویی در تو تکرار می‌شود، کجا فعال می‌شود،
          و چطور می‌توانی این بار جور دیگری پاسخ بدهی.
        </p>
      </Card>

      {phrase && (
        <Card style={{ marginTop: 12, background: "#111", color: "#fff" }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
            یادآوری امروز
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.9 }}>{phrase}</div>
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        <Btn onClick={onStart}>شروع ارزیابی</Btn>
      </div>

      {hasProfile && (
        <div style={{ marginTop: 10 }}>
          <Btn variant="ghost" onClick={onSkipToProfile}>
            پروفایل من را نشان بده
          </Btn>
        </div>
      )}

      <Card style={{ marginTop: 24, background: "#f6f6f6" }}>
        <div style={{ fontSize: 13, color: "#666", lineHeight: 1.9 }}>
          <strong style={{ color: "#333" }}>این اپ چه چیزی نیست:</strong>
          <div>• تشخیص پزشکی نمی‌دهد</div>
          <div>• از AI برای قضاوت درباره تو استفاده نمی‌کند</div>
          <div>• جایگزین درمانگر نیست</div>
        </div>
      </Card>
    </Shell>
  );
}

/* =========================================================
 * ۵. صفحه تست YSQ
 * ========================================================= */

function YSQView({ onDone, onBack }) {
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);

  const q = YSQ_QUESTIONS[index];
  const check = validateAnswers(answers);
  const isLast = index === YSQ_QUESTIONS.length - 1;

  const select = (v) => {
    const next = { ...answers, [q.id]: v };
    setAnswers(next);
    if (!isLast) setTimeout(() => setIndex(index + 1), 200);
  };

  return (
    <Shell title="ارزیابی" onBack={onBack}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888" }}>
          <span>سؤال {toFa(index + 1)} از {toFa(YSQ_QUESTIONS.length)}</span>
          <span>{toFa(check.progress)}%</span>
        </div>
        <div style={{ marginTop: 6 }}>
          <ProgressBar value={check.progress} />
        </div>
      </div>

      <Card>
        <p style={{ fontSize: 17, lineHeight: 1.9, margin: "0 0 20px", minHeight: 80 }}>
          {q.text}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {LIKERT_SCALE.map((l) => {
            const active = answers[q.id] === l.value;
            return (
              <button
                key={l.value}
                onClick={() => select(l.value)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: active ? "2px solid #111" : "1px solid #e5e5e5",
                  background: active ? "#111" : "#fff",
                  color: active ? "#fff" : "#333",
                  fontSize: 14,
                  textAlign: "right",
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </Card>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Btn variant="ghost" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
          قبلی
        </Btn>
        <Btn
          variant="ghost"
          onClick={() => setIndex(Math.min(YSQ_QUESTIONS.length - 1, index + 1))}
          disabled={isLast}
        >
          بعدی
        </Btn>
      </div>

      {check.valid && (
        <div style={{ marginTop: 12 }}>
          <Btn onClick={() => onDone(answers, analyzeYSQ(answers))}>
            دیدن پروفایل من
          </Btn>
        </div>
      )}
    </Shell>
  );
}

/* =========================================================
 * ۶. صفحه پروفایل
 * ========================================================= */

function ProfileView({ analysis, onPickSchema, onRetake, onBack, onWins, onCalendar, onSOS }) {
  if (!analysis) {
    return (
      <Shell title="پروفایل" onBack={onBack}>
        <Card><p>هنوز ارزیابی‌ای انجام نشده.</p></Card>
      </Shell>
    );
  }

  const { high, medium, low, recommended } = analysis;

  return (
    <Shell
      title="پروفایل الگوهای من"
      onBack={onBack}
      showQuickButton
      onQuick={() => onPickSchema(recommended?.schemaId)}
      showSOS
      onSOS={onSOS}
    >
      <Card style={{ background: "#111", color: "#fff" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>پیشنهاد شروع</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
          {recommended?.name}
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
          {toFa(recommended?.percentage || 0)}% — اولویت {recommended?.priority?.label}
        </div>
      </Card>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onWins} style={styles.dashBtn}>
          ⭐ لحظه‌های من
        </button>
        <button onClick={onCalendar} style={styles.dashBtn}>
          📅 تقویم
        </button>
      </div>

      <h3 style={{ margin: "22px 0 10px", fontSize: 15 }}>الگوهای فعال</h3>
      {[...high, ...medium].map((r) => (
        <button
          key={r.schemaId}
          onClick={() => onPickSchema(r.schemaId)}
          style={styles.schemaBtn}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span style={{ color: r.priority.color, fontWeight: 700, fontSize: 14 }}>
              {r.priority.emoji} {toFa(r.percentage)}%
            </span>
          </div>
          <div style={{ marginTop: 8 }}>
            <ProgressBar value={r.percentage} color={r.priority.color} />
          </div>
        </button>
      ))}

      {low.length > 0 && (
        <>
          <h3 style={{ margin: "22px 0 10px", fontSize: 15, color: "#888" }}>سایر الگوها</h3>
          {low.map((r) => (
            <button
              key={r.schemaId}
              onClick={() => onPickSchema(r.schemaId)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "right",
                padding: 12,
                marginBottom: 6,
                borderRadius: 10,
                border: "1px solid #f0f0f0",
                background: "#fafafa",
                cursor: "pointer",
                fontSize: 14,
                color: "#666",
                fontFamily: "inherit"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{r.name}</span>
                <span>{toFa(r.percentage)}%</span>
              </div>
            </button>
          ))}
        </>
      )}

      <div style={{ marginTop: 20 }}>
        <Btn variant="ghost" onClick={onRetake}>ارزیابی مجدد</Btn>
      </div>

      <p style={{ fontSize: 11, color: "#999", marginTop: 20, lineHeight: 1.8 }}>
        این نتایج یک ارزیابی خودگزارشی است و تشخیص بالینی نیست.
        اگر نیاز به کمک تخصصی داری، با یک درمانگر صحبت کن.
      </p>
    </Shell>
  );
}

/* =========================================================
 * ۷. صفحه چرخه
 * ========================================================= */

function CycleView({ schemaId, onDone, onBack }) {
  const schema = SCHEMAS.find((s) => s.id === schemaId);
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState({
    triggerId: null,
    thoughtId: null,
    emotionId: null,
    behaviorId: null
  });

  if (!schema) {
    return (
      <Shell title="خطا" onBack={onBack}>
        <Card><p>طرحواره پیدا نشد.</p></Card>
      </Shell>
    );
  }

  const steps = [
    { key: "trigger", title: "چه چیزی معمولاً این حالت را فعال می‌کند؟", items: schema.triggers, idKey: "triggerId" },
    { key: "thought", title: "معمولاً چه فکری از ذهنت می‌گذرد؟", items: schema.automatic_thoughts, idKey: "thoughtId" },
    { key: "emotion", title: "چه احساسی بالا می‌آید؟", items: schema.emotional_signals, idKey: "emotionId" },
    { key: "behavior", title: "معمولاً چه کار می‌کنی؟", items: schema.behavioral_patterns, idKey: "behaviorId" }
  ];

  const current = steps[step];
  const selected = choice[current.idKey];

  const pick = (id) => {
    const next = { ...choice, [current.idKey]: id };
    setChoice(next);
    if (step < steps.length - 1) {
      setTimeout(() => setStep(step + 1), 220);
    } else {
      setTimeout(() => onDone(next), 300);
    }
  };

  return (
    <Shell title={schema.name_fa} onBack={step === 0 ? onBack : () => setStep(step - 1)}>
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {steps.map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i <= step ? "#111" : "#eee"
            }}
          />
        ))}
      </div>

      <Card>
        <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px" }}>
          {current.title}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {current.items.map((it) => {
            const active = selected === it.id;
            return (
              <button
                key={it.id}
                onClick={() => pick(it.id)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: active ? "2px solid #111" : "1px solid #e5e5e5",
                  background: active ? "#111" : "#fff",
                  color: active ? "#fff" : "#333",
                  fontSize: 14,
                  textAlign: "right",
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
              >
                {it.text}
              </button>
            );
          })}
        </div>
      </Card>
    </Shell>
  );
}

/* =========================================================
 * ۸. خلاصه چرخه
 * ========================================================= */

function CycleSummaryView({ schemaId, selection, onContinue, onBack }) {
  const schema = SCHEMAS.find((s) => s.id === schemaId);
  const find = (list, id) => (list || []).find((x) => x.id === id);

  const items = [
    { label: "محرک", value: find(schema.triggers, selection.triggerId)?.text },
    { label: "فکر خودکار", value: find(schema.automatic_thoughts, selection.thoughtId)?.text },
    { label: "احساس", value: find(schema.emotional_signals, selection.emotionId)?.text },
    { label: "واکنش قدیمی", value: find(schema.behavioral_patterns, selection.behaviorId)?.text }
  ];

  const phrases = getCompassionatePhrases(schemaId);
  const phrase = phrases[Math.floor(Math.random() * phrases.length)];

  return (
    <Shell title="الگوی تو" onBack={onBack}>
      <Card>
        <p style={{ margin: "0 0 16px", color: "#666", fontSize: 14 }}>
          این چرخه توست. جایی برای قضاوت نیست — فقط شناخت.
        </p>

        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 12,
              padding: "10px 0",
              borderBottom: i < items.length - 1 ? "1px dashed #eee" : "none"
            }}
          >
            <div style={{ width: 90, color: "#888", fontSize: 13 }}>{it.label}</div>
            <div style={{ flex: 1, fontWeight: 500 }}>{it.value}</div>
          </div>
        ))}
      </Card>

      {phrase && (
        <Card style={{ marginTop: 12, background: "#111", color: "#fff" }}>
          <div style={{ fontSize: 14, lineHeight: 1.9 }}>{phrase}</div>
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        <Btn onClick={onContinue}>بعدی — بیایید این چرخه را بشکنیم</Btn>
      </div>
    </Shell>
  );
}

/* =========================================================
 * ۹. صفحه تمرین
 * ========================================================= */

function ExerciseView({ schemaId, selection, onDone, onBack }) {
  const schema = SCHEMAS.find((s) => s.id === schemaId);
  const rule = resolveExercise(schemaId, selection.triggerId, selection.behaviorId);
  const exercise = resolveExerciseFromRule(schema, rule);

  if (!exercise) {
    return (
      <Shell title="تمرین" onBack={onBack}>
        <Card><p>برای این ترکیب، تمرینی تعریف نشده.</p></Card>
        <div style={{ marginTop: 12 }}>
          <Btn onClick={onDone}>ادامه</Btn>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="تمرین" onBack={onBack}>
      <ExerciseRenderer
        exercise={exercise}
        onComplete={(record) => onDone(record)}
        onSkip={onDone}
      />
    </Shell>
  );
}

/* =========================================================
 * ۱۰. صفحه مأموریت — با میکرو-مأموریت
 * ========================================================= */

function MissionView({ schemaId, onDone, onBack }) {
  const schema = SCHEMAS.find((s) => s.id === schemaId);
  const microMissions = getMicroMissions(schemaId);
  const missions = microMissions.length > 0 ? microMissions : (schema?.real_life_missions || []);
  const [selectedId, setSelectedId] = useState(missions[0]?.id || null);

  if (missions.length === 0) {
    return (
      <Shell title="مأموریت امروز" onBack={onBack}>
        <Card><p>مأموریتی تعریف نشده.</p></Card>
        <div style={{ marginTop: 12 }}>
          <Btn onClick={() => onDone(null)}>ادامه</Btn>
        </div>
      </Shell>
    );
  }

  const selected = missions.find((m) => m.id === selectedId) || missions[0];

  return (
    <Shell title="مأموریت امروز" onBack={onBack}>
      <Card>
        <p style={{ margin: "0 0 6px", fontSize: 14, color: "#666" }}>
          یکی را انتخاب کن. هر کدام کمتر از ۱ دقیقه طول می‌کشد.
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#999" }}>
          کوچک‌ترین که می‌توانی.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {missions.map((m) => {
            const active = selectedId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: active ? "2px solid #111" : "1px solid #e5e5e5",
                  background: active ? "#111" : "#fff",
                  color: active ? "#fff" : "#333",
                  fontSize: 14,
                  textAlign: "right",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  lineHeight: 1.7
                }}
              >
                {m.text}
              </button>
            );
          })}
        </div>
      </Card>

      <Card style={{ marginTop: 12, background: "#f6f6f6" }}>
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.9 }}>
          لازم نیست کامل انجامش بدهی.
          <br />
          حتی اگر فقط به آن فکر کنی، همین هم یک قدم است.
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Btn onClick={() => onDone(selected)}>انتخاب کردم</Btn>
        <div style={{ marginTop: 8 }}>
          <Btn variant="ghost" onClick={() => onDone(null)}>
            الان نمی‌توانم — رد کن
          </Btn>
        </div>
      </div>
    </Shell>
  );
}

/* =========================================================
 * ۱۱. ثبت نتیجه
 * ========================================================= */

function LogResultView({ schemaId, selection, onDone, onBack }) {
  const [reaction, setReaction] = useState(null);
  const [missionDone, setMissionDone] = useState(false);
  const [notes, setNotes] = useState("");

  const replacement = getReplacementResponse(schemaId, selection.behaviorId);

  const options = [
    { id: "old", label: "واکنش قدیمی را انجام دادم", color: "#e74c3c", emoji: "🔴" },
    { id: "paused", label: "مکث کردم", color: "#f39c12", emoji: "🟡" },
    { id: "new", label: "پاسخ جدید را امتحان کردم", color: "#27ae60", emoji: "🟢" }
  ];

  return (
    <Shell title="چطور پیش رفت؟" onBack={onBack}>
      <Card>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "#666" }}>
          وقتی این الگو فعال شد، چه اتفاقی افتاد؟
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {options.map((o) => {
            const active = reaction === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setReaction(o.id)}
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: active ? `2px solid ${o.color}` : "1px solid #e5e5e5",
                  background: active ? o.color : "#fff",
                  color: active ? "#fff" : "#333",
                  fontSize: 14,
                  textAlign: "right",
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
              >
                {o.emoji} {o.label}
              </button>
            );
          })}
        </div>
      </Card>

      {reaction === "new" && (
        <Card style={{ marginTop: 12, background: "#eef7ee" }}>
          <div style={{ fontSize: 14, color: "#1b5e20", lineHeight: 1.9 }}>
            ⭐ این یک لحظه‌ی برد است. در «لحظه‌های من» ذخیره می‌شود.
          </div>
        </Card>
      )}

      {reaction === "paused" && (
        <Card style={{ marginTop: 12, background: "#fff8e1" }}>
          <div style={{ fontSize: 14, color: "#e65100", lineHeight: 1.9 }}>
            ⭐ همین مکث کردن، خودش یک برد است. ثبت می‌شود.
          </div>
        </Card>
      )}

      {replacement && selection.behaviorId && (
        <Card style={{ marginTop: 12, background: "#f6f6f6" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
            پاسخ جایگزینی که تمرین کردی:
          </div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{replacement}</div>
        </Card>
      )}

      <Card style={{ marginTop: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={missionDone}
            onChange={(e) => setMissionDone(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          <span style={{ fontSize: 14 }}>مأموریت امروز را انجام دادم</span>
        </label>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
          یادداشت (اختیاری)
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="چه چیزی کمک کرد؟"
          style={styles.textarea}
        />
      </Card>

      <div style={{ marginTop: 16 }}>
        <Btn
          disabled={!reaction}
          onClick={() => onDone({ reactionType: reaction, missionDone, notes })}
        >
          ثبت
        </Btn>
      </div>
    </Shell>
  );
}

/* =========================================================
 * ۱۲. صفحه لحظه‌های من (Wins)
 * ========================================================= */

function WinsView({ onBack, onSOS }) {
  const [wins, setWins] = useState(null);

  useEffect(() => {
    getWins().then(setWins);
  }, []);

  if (!wins) {
    return (
      <Shell title="لحظه‌های من" onBack={onBack} showSOS onSOS={onSOS}>
        <p style={{ color: "#888" }}>در حال بارگذاری...</p>
      </Shell>
    );
  }

  const formatDate = (iso) => {
    const d = new Date(iso);
    const months = [
      "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
      "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
    ];
    return `${toFa(d.getDate())} ${months[d.getMonth()]} — ساعت ${toFa(d.getHours())}:${toFa(String(d.getMinutes()).padStart(2, "0"))}`;
  };

  if (wins.length === 0) {
    return (
      <Shell title="لحظه‌های من" onBack={onBack} showSOS onSOS={onSOS}>
        <Card style={{ textAlign: "center", padding: 30 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
          <p style={{ fontSize: 15, lineHeight: 1.9, margin: 0 }}>
            هنوز لحظه‌ای ثبت نشده.
            <br />
            هر بار که مکث کنی یا پاسخ جدیدی امتحان کنی، اینجا ذخیره می‌شود.
          </p>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell title="لحظه‌های من" onBack={onBack} showSOS onSOS={onSOS}>
      <Card style={{ background: "#111", color: "#fff", marginBottom: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>مجموع لحظه‌های برد</div>
        <div style={{ fontSize: 32, fontWeight: 700, marginTop: 4 }}>
          {toFa(wins.length)}
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
          این‌ها لحظه‌هایی هستند که تو انتخاب کردی.
        </div>
      </Card>

      {wins.map((w) => {
        const schema = SCHEMAS.find((s) => s.id === w.schemaId);
        return (
          <Card key={w.id} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ fontSize: 20 }}>⭐</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                  {describeWin(w)}
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>
                  {schema?.name_fa || "—"} • {formatDate(w.createdAt)}
                </div>
                {w.notes && (
                  <div style={{ fontSize: 13, color: "#555", marginTop: 6, lineHeight: 1.7 }}>
                    {w.notes}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </Shell>
  );
}

/* =========================================================
 * ۱۳. صفحه تقویم
 * ========================================================= */

function CalendarView({ onBack, onSOS }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    getCalendarData(30).then(setData);
  }, []);

  if (!data) {
    return (
      <Shell title="تقویم" onBack={onBack} showSOS onSOS={onSOS}>
        <p style={{ color: "#888" }}>در حال بارگذاری...</p>
      </Shell>
    );
  }

  const moodColors = {
    good: "#27ae60",
    meh: "#f39c12",
    hard: "#e74c3c",
    none: "#f0f0f0"
  };

  const moodLabels = {
    good: "روز خوب",
    meh: "روز متوسط",
    hard: "روز سخت",
    none: "بدون ثبت"
  };

  return (
    <Shell title="تقویم ۳۰ روز اخیر" onBack={onBack} showSOS onSOS={onSOS}>
      <Card>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 14, lineHeight: 1.9 }}>
          هر خانه یک روز است. رنگ نشان می‌دهد حالت چطور بود.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 6
          }}
        >
          {data.map((d, i) => (
            <div
              key={i}
              style={{
                aspectRatio: "1",
                borderRadius: 8,
                background: moodColors[d.mood],
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                color: d.mood === "none" ? "#aaa" : "#fff",
                fontSize: 11,
                fontWeight: 600
              }}
            >
              <div>{toFa(d.dayNumber)}</div>
              {d.activations > 0 && (
                <div style={{ fontSize: 9, opacity: 0.85, marginTop: 2 }}>
                  {toFa(d.activations)}
                </div>
              )}
              {d.hasWin && (
                <div
                  style={{
                    position: "absolute",
                    top: 2,
                    left: 2,
                    fontSize: 8
                  }}
                >
                  ⭐
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#666" }}>
          {Object.entries(moodLabels).map(([k, label]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: moodColors[k],
                  display: "inline-block"
                }}
              />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginTop: 12, background: "#f6f6f6" }}>
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.9 }}>
          عدد داخل هر خانه = تعداد بارهایی که آن روز الگو فعال شد.
          <br />
          ⭐ = روزی که حداقل یک لحظه‌ی برد داشتی.
        </div>
      </Card>
    </Shell>
  );
}

/* =========================================================
 * ۱۴. صفحه پیشرفت
 * ========================================================= */

function ProgressView({ schemaId, onBack, onQuick, onWins, onCalendar, onSOS }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    buildProgressSummary(schemaId).then(setSummary);
  }, [schemaId]);

  if (!summary) {
    return (
      <Shell title="پیشرفت" onBack={onBack} showQuickButton onQuick={onQuick} showSOS onSOS={onSOS}>
        <p style={{ color: "#888" }}>در حال بارگذاری...</p>
      </Shell>
    );
  }

  const { reactions, total, streak, insights, weekly, winsCount } = summary;

  return (
    <Shell title="پیشرفت" onBack={onBack} showQuickButton onQuick={onQuick} showSOS onSOS={onSOS}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div style={{ fontSize: 12, color: "#888" }}>فعال شدن الگو</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {toFa(total)}
            </div>
          </div>
          {streak > 0 && (
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 12, color: "#888" }}>روز پیوسته</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e67e22" }}>
                {toFa(streak)}
              </div>
            </div>
          )}
        </div>

        {winsCount > 0 && (
          <button
            onClick={onWins}
            style={{
              marginTop: 14,
              width: "100%",
              padding: 12,
              borderRadius: 10,
              border: "1px solid #ffe0b2",
              background: "#fff8e1",
              cursor: "pointer",
              textAlign: "right",
              fontFamily: "inherit"
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14, color: "#e65100" }}>
              ⭐ {toFa(winsCount)} لحظه‌ی برد
            </span>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              ببین چه کردی →
            </div>
          </button>
        )}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>واکنش قدیمی</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{toFa(reactions.old)}</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <ProgressBar value={reactions.old} max={Math.max(10, total)} color="#e74c3c" />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>مکث</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{toFa(reactions.paused)}</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <ProgressBar value={reactions.paused} max={Math.max(10, total)} color="#f39c12" />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>پاسخ جدید</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{toFa(reactions.new)}</span>
          </div>
          <div style={{ marginTop: 4 }}>
            <ProgressBar value={reactions.new} max={Math.max(10, total)} color="#27ae60" />
          </div>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onCalendar} style={styles.dashBtn}>
          📅 تقویم
        </button>
        <button onClick={onWins} style={styles.dashBtn}>
          ⭐ لحظه‌های من
        </button>
      </div>

      {(weekly.lastWeek.total > 0 || weekly.thisWeek.total > 0) && (
        <Card style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            این هفته در مقایسه با هفته قبل
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 13 }}>
            <div style={{ color: "#888" }}></div>
            <div style={{ textAlign: "center", color: "#888", fontSize: 12 }}>هفته قبل</div>
            <div style={{ textAlign: "center", color: "#888", fontSize: 12 }}>این هفته</div>

            <div>فعال شدن</div>
            <div style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              {toFa(weekly.lastWeek.total)}
            </div>
            <div style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
              {toFa(weekly.thisWeek.total)}
            </div>

            <div>واکنش قدیمی</div>
            <div style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", color: "#e74c3c" }}>
              {toFa(weekly.lastWeek.old)}
            </div>
            <div style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", color: "#e74c3c", fontWeight: 600 }}>
              {toFa(weekly.thisWeek.old)}
            </div>

            <div>پاسخ جدید</div>
            <div style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", color: "#27ae60" }}>
              {toFa(weekly.lastWeek.new)}
            </div>
            <div style={{ textAlign: "center", fontVariantNumeric: "tabular-nums", color: "#27ae60", fontWeight: 600 }}>
              {toFa(weekly.thisWeek.new)}
            </div>
          </div>
        </Card>
      )}

      {insights.length > 0 && (
        <Card style={{ marginTop: 12, background: "#111", color: "#fff" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            چه چیزی در حال تغییر است؟
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ fontSize: 14, lineHeight: 1.8, opacity: 0.95 }}>
                • {ins.text}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        <Btn onClick={onQuick}>⚡ همین الان فعال شد</Btn>
      </div>
    </Shell>
  );
}

/* =========================================================
 * ۱۵. جریان سریع
 * ========================================================= */

function QuickCheckView({ profiles, onDone, onBack }) {
  const [phase, setPhase] = useState("choose");
  const [pickedSchema, setPickedSchema] = useState(profiles[0]?.schemaId || null);

  const save = async (reaction) => {
    await recordCycle({
      schemaId: pickedSchema,
      reactionType: reaction,
      notes: "ثبت سریع"
    });
    setPhase("saved");
  };

  if (phase === "choose") {
    return (
      <Shell title="همین الان فعال شد" onBack={onBack}>
        <Card>
          <p style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>
            کدام الگو فعال شد؟
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {profiles.map((p) => (
              <button
                key={p.schemaId}
                onClick={() => {
                  setPickedSchema(p.schemaId);
                  setPhase("breathe");
                }}
                style={styles.quickOptBtn}
              >
                {p.name}
              </button>
            ))}
          </div>
        </Card>
      </Shell>
    );
  }

  if (phase === "breathe") {
    return (
      <Shell title="مکث" onBack={onBack}>
        <Card style={{ textAlign: "center", padding: 30 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏸️</div>
          <p style={{ fontSize: 16, lineHeight: 1.9, margin: "0 0 20px" }}>
            ۱۰ ثانیه هیچ کاری نکن.
            <br />
            نفس بکش.
          </p>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.9 }}>
            الان چه چیزی را واقعاً می‌دانم؟
            <br />
            و چه چیزی را فقط حدس می‌زنم؟
          </p>
        </Card>

        <div style={{ marginTop: 16 }}>
          <Btn onClick={() => setPhase("action")}>ادامه</Btn>
        </div>
      </Shell>
    );
  }

  if (phase === "action") {
    return (
      <Shell title="انتخاب" onBack={onBack}>
        <Card>
          <p style={{ margin: "0 0 14px", fontSize: 15 }}>
            این بار می‌خواهی همان واکنش قبلی را تکرار کنی یا امتحان جدیدی داشته باشی؟
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => save("old")} style={{ ...styles.quickOptBtn, borderColor: "#e74c3c", color: "#e74c3c" }}>
              واکنش قدیمی
            </button>
            <button onClick={() => save("new")} style={{ ...styles.quickOptBtn, background: "#27ae60", color: "#fff", borderColor: "#27ae60" }}>
              امتحان جدید
            </button>
            <button onClick={() => save("paused")} style={{ ...styles.quickOptBtn, borderColor: "#f39c12", color: "#f39c12" }}>
              فقط مکث می‌کنم
            </button>
          </div>
        </Card>
      </Shell>
    );
  }

  if (phase === "saved") {
    return (
      <Shell title="ثبت شد" onBack={onDone}>
        <Card style={{ textAlign: "center", padding: 30 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <p style={{ fontSize: 16, lineHeight: 1.9 }}>
            ثبت شد. این خودش یک قدم است.
          </p>
        </Card>
        <div style={{ marginTop: 16 }}>
          <Btn onClick={onDone}>بازگشت</Btn>
        </div>
      </Shell>
    );
  }

  return null;
}

/* =========================================================
 * ۱۶. اپ اصلی
 * ========================================================= */

export default function App() {
  const [view, setView] = useState("loading");
  const [analysis, setAnalysis] = useState(null);
  const [activeSchemaId, setActiveSchemaId] = useState(null);
  const [selection, setSelection] = useState(null);
  const [exerciseRecord, setExerciseRecord] = useState(null);
  const [missionRecord, setMissionRecord] = useState(null);
  const [returnTo, setReturnTo] = useState("welcome");

  // بارگذاری اولیه: پروفایل + بررسی چک‌این
  useEffect(() => {
    Promise.all([loadProfile(), hasCheckedInToday()]).then(([p, checkedIn]) => {
      if (p) setAnalysis(p);
      if (!checkedIn) {
        setView("checkin");
      } else {
        setView(p ? "profile" : "welcome");
      }
    });
  }, []);

  const profiles = useMemo(() => {
    if (!analysis) return [];
    return [...analysis.high, ...analysis.medium].map((r) => ({
      schemaId: r.schemaId,
      name: r.name
    }));
  }, [analysis]);

  const go = (v) => setView(v);

  const openSOS = () => {
    setReturnTo(view);
    go("sos");
  };

  // جمله امروز برای welcome
  const todayPhrase = useMemo(() => {
    const all = [];
    for (const s of SCHEMAS) {
      const p = getCompassionatePhrases(s.id);
      for (const ph of p) all.push(ph);
    }
    if (all.length === 0) return null;
    const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return all[day % all.length];
  }, []);

  /* ---------- Loading ---------- */
  if (view === "loading") {
    return (
      <div style={styles.app}>
        <p style={{ textAlign: "center", padding: 40 }}>در حال بارگذاری...</p>
      </div>
    );
  }

  /* ---------- Check-In ---------- */
  if (view === "checkin") {
    return (
      <CheckInView
        onDone={() => go(analysis ? "profile" : "welcome")}
        onSkip={() => go(analysis ? "profile" : "welcome")}
      />
    );
  }

  /* ---------- SOS ---------- */
  if (view === "sos") {
    return (
      <SOSView
        onBack={() => go(returnTo)}
        onBetter={() => go(returnTo)}
      />
    );
  }

  /* ---------- Welcome ---------- */
  if (view === "welcome") {
    return (
      <WelcomeView
        hasProfile={!!analysis}
        onStart={() => go("ysq")}
        onSkipToProfile={() => go("profile")}
        phrase={todayPhrase}
        onSOS={openSOS}
      />
    );
  }

  /* ---------- YSQ ---------- */
  if (view === "ysq") {
    return (
      <YSQView
        onBack={() => go("welcome")}
        onDone={async (answers, result) => {
          const payload = buildResultPayload(answers);
          console.log("YSQ payload:", payload);
          await saveProfile(result);
          setAnalysis(result);
          go("profile");
        }}
      />
    );
  }

  /* ---------- Profile ---------- */
  if (view === "profile") {
    return (
      <ProfileView
        analysis={analysis}
        onBack={() => go("welcome")}
        onRetake={() => go("ysq")}
        onWins={() => go("wins")}
        onCalendar={() => go("calendar")}
        onSOS={openSOS}
        onPickSchema={(id) => {
          setActiveSchemaId(id);
          go("cycle");
        }}
      />
    );
  }

  /* ---------- Cycle ---------- */
  if (view === "cycle" && activeSchemaId) {
    return (
      <CycleView
        schemaId={activeSchemaId}
        onBack={() => go("profile")}
        onDone={(sel) => {
          setSelection(sel);
          go("cycle_summary");
        }}
      />
    );
  }

  /* ---------- Cycle Summary ---------- */
  if (view === "cycle_summary" && selection) {
    return (
      <CycleSummaryView
        schemaId={activeSchemaId}
        selection={selection}
        onBack={() => go("cycle")}
        onContinue={() => go("exercise")}
      />
    );
  }

  /* ---------- Exercise ---------- */
  if (view === "exercise") {
    return (
      <ExerciseView
        schemaId={activeSchemaId}
        selection={selection}
        onBack={() => go("cycle_summary")}
        onDone={(record) => {
          setExerciseRecord(record || null);
          go("mission");
        }}
      />
    );
  }

  /* ---------- Mission ---------- */
  if (view === "mission") {
    return (
      <MissionView
        schemaId={activeSchemaId}
        onBack={() => go("exercise")}
        onDone={(mission) => {
          setMissionRecord(mission);
          go("log");
        }}
      />
    );
  }

  /* ---------- Log ---------- */
  if (view === "log") {
    return (
      <LogResultView
        schemaId={activeSchemaId}
        selection={selection}
        onBack={() => go("mission")}
        onDone={async (log) => {
          await recordCycle({
            schemaId: activeSchemaId,
            ...selection,
            ...log,
            exerciseId: exerciseRecord?.exerciseId || null,
            exerciseResult: exerciseRecord?.result || null,
            missionId: missionRecord?.id || null
          });
          go("progress");
        }}
      />
    );
  }

  /* ---------- Progress ---------- */
  if (view === "progress") {
    return (
      <ProgressView
        schemaId={activeSchemaId}
        onBack={() => go("profile")}
        onQuick={() => go("quick")}
        onWins={() => go("wins")}
        onCalendar={() => go("calendar")}
        onSOS={openSOS}
      />
    );
  }

  /* ---------- Wins ---------- */
  if (view === "wins") {
    return (
      <WinsView
        onBack={() => go(analysis ? "profile" : "welcome")}
        onSOS={openSOS}
      />
    );
  }

  /* ---------- Calendar ---------- */
  if (view === "calendar") {
    return (
      <CalendarView
        onBack={() => go(analysis ? "profile" : "welcome")}
        onSOS={openSOS}
      />
    );
  }

  /* ---------- Quick ---------- */
  if (view === "quick") {
    return (
      <QuickCheckView
        profiles={
          profiles.length
            ? profiles
            : SCHEMAS.slice(0, 5).map((s) => ({ schemaId: s.id, name: s.name_fa }))
        }
        onBack={() => go("welcome")}
        onDone={() => go("progress")}
      />
    );
  }

  return <p style={{ padding: 20 }}>وضعیت ناشناخته: {view}</p>;
}

/* =========================================================
 * ۱۷. استایل‌ها
 * ========================================================= */

const styles = {
  app: {
    minHeight: "100vh",
    background: "#fafafa",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif",
    color: "#222",
    paddingBottom: 80,
    position: "relative"
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    background: "#fff",
    borderBottom: "1px solid #eee",
    position: "sticky",
    top: 0,
    zIndex: 10
  },
  headerTitle: {
    fontWeight: 700,
    fontSize: 15
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "1px solid #eee",
    background: "#fff",
    fontSize: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit"
  },
  sosHeaderBtn: {
    width: 40,
    height: 32,
    borderRadius: 8,
    border: "1px solid #e74c3c",
    background: "#fff",
    color: "#e74c3c",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit"
  },
  main: {
    maxWidth: 520,
    margin: "0 auto",
    padding: 16
  },
  card: {
    padding: 16,
    borderRadius: 14,
    background: "#fff",
    border: "1px solid #f0f0f0"
  },
  btn: {
    width: "100%",
    padding: "14px 20px",
    borderRadius: 12,
    border: "none",
    fontSize: 15,
    fontWeight: 600,
    fontFamily: "inherit"
  },
  btnPrimary: {
    background: "#111",
    color: "#fff"
  },
  btnGhost: {
    background: "#fff",
    color: "#333",
    border: "1px solid #e5e5e5"
  },
  btnDanger: {
    background: "#e74c3c",
    color: "#fff"
  },
  quickBtn: {
    position: "fixed",
    bottom: 20,
    left: "50%",
    transform: "translateX(-50%)",
    padding: "14px 24px",
    borderRadius: 999,
    background: "#111",
    color: "#fff",
    border: "none",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 6px 20px rgba(0,0,0,.2)",
    fontFamily: "inherit"
  },
  textarea: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ddd",
    fontFamily: "inherit",
    fontSize: 13,
    resize: "vertical",
    boxSizing: "border-box"
  },
  moodBtn: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 18px",
    borderRadius: 12,
    border: "1px solid #e5e5e5",
    background: "#fff",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 15
  },
  dashBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    border: "1px solid #e5e5e5",
    background: "#fff",
    fontSize: 14,
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: 600
  },
  schemaBtn: {
    display: "block",
    width: "100%",
    textAlign: "right",
    padding: 14,
    marginBottom: 8,
    borderRadius: 12,
    border: "1px solid #eee",
    background: "#fff",
    cursor: "pointer",
    fontFamily: "inherit"
  },
  quickOptBtn: {
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #e5e5e5",
    background: "#fff",
    fontSize: 14,
    textAlign: "right",
    cursor: "pointer",
    fontFamily: "inherit"
  },
  sosFull: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #1a1a1a 0%, #2c3e50 100%)",
    color: "#fff",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif"
  },
  breathCircle: {
    width: 200,
    height: 200,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,.2)",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,.05)",
    transition: "all 1s ease"
  },
  breathInner: {
    textAlign: "center"
  }
};
