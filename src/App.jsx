// App.jsx
// نسخه 2.1 — با MissionView چند‌گزینه‌ای
// جریان کامل اپ — بدون AI

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
  loadProfile
} from "./PROGRESS";

/* =========================================================
 * ۰. ثبت برچسب‌های خوانا (یک‌بار)
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

function Shell({ children, title, onBack, showQuickButton, onQuick }) {
  return (
    <div dir="rtl" style={styles.app}>
      <header style={styles.header}>
        {onBack ? (
          <button onClick={onBack} style={styles.backBtn}>→</button>
        ) : (
          <div style={{ width: 32 }} />
        )}
        <div style={styles.headerTitle}>{title}</div>
        <div style={{ width: 32 }} />
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
 * ۲. صفحه خوش‌آمد
 * ========================================================= */

function WelcomeView({ onStart, onSkipToProfile, hasProfile }) {
  return (
    <Shell title="الگوهای من">
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
          <br />
          <strong style={{ color: "#333" }}>این اپ چه چیزی هست:</strong>
          <div>• یک ارزیابی خودگزارشی</div>
          <div>• یک ابزار تمرین</div>
          <div>• فضایی برای ثبت الگو و تغییر تدریجی</div>
        </div>
      </Card>
    </Shell>
  );
}

/* =========================================================
 * ۳. صفحه تست YSQ
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#888"
          }}
        >
          <span>
            سؤال {toFa(index + 1)} از {toFa(YSQ_QUESTIONS.length)}
          </span>
          <span>{toFa(check.progress)}%</span>
        </div>
        <div style={{ marginTop: 6 }}>
          <ProgressBar value={check.progress} />
        </div>
      </div>

      <Card>
        <p
          style={{
            fontSize: 17,
            lineHeight: 1.9,
            margin: "0 0 20px",
            minHeight: 80
          }}
        >
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
        <Btn
          variant="ghost"
          onClick={() => setIndex(Math.max(0, index - 1))}
          disabled={index === 0}
        >
          قبلی
        </Btn>
        <Btn
          variant="ghost"
          onClick={() =>
            setIndex(Math.min(YSQ_QUESTIONS.length - 1, index + 1))
          }
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
 * ۴. صفحه پروفایل
 * ========================================================= */

function ProfileView({ analysis, onPickSchema, onRetake, onBack }) {
  if (!analysis) {
    return (
      <Shell title="پروفایل" onBack={onBack}>
        <Card>
          <p>هنوز ارزیابی‌ای انجام نشده.</p>
        </Card>
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
    >
      <Card style={{ background: "#111", color: "#fff" }}>
        <div style={{ fontSize: 12, opacity: 0.7 }}>پیشنهاد شروع</div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
          {recommended?.name}
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
          {toFa(recommended?.percentage || 0)}% — اولویت{" "}
          {recommended?.priority?.label}
        </div>
      </Card>

      <h3 style={{ margin: "22px 0 10px", fontSize: 15 }}>الگوهای فعال</h3>
      {[...high, ...medium].map((r) => (
        <button
          key={r.schemaId}
          onClick={() => onPickSchema(r.schemaId)}
          style={{
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
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <span style={{ fontWeight: 600 }}>{r.name}</span>
            <span
              style={{ color: r.priority.color, fontWeight: 700, fontSize: 14 }}
            >
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
          <h3 style={{ margin: "22px 0 10px", fontSize: 15, color: "#888" }}>
            سایر الگوها
          </h3>
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
        <Btn variant="ghost" onClick={onRetake}>
          ارزیابی مجدد
        </Btn>
      </div>

      <p style={{ fontSize: 11, color: "#999", marginTop: 20, lineHeight: 1.8 }}>
        این نتایج یک ارزیابی خودگزارشی است و تشخیص بالینی نیست.
        اگر نیاز به کمک تخصصی داری، با یک درمانگر صحبت کن.
      </p>
    </Shell>
  );
}

/* =========================================================
 * ۵. صفحه چرخه
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
        <Card>
          <p>طرحواره پیدا نشد.</p>
        </Card>
      </Shell>
    );
  }

  const steps = [
    {
      key: "trigger",
      title: "چه چیزی معمولاً این حالت را فعال می‌کند؟",
      items: schema.triggers,
      idKey: "triggerId"
    },
    {
      key: "thought",
      title: "معمولاً چه فکری از ذهنت می‌گذرد؟",
      items: schema.automatic_thoughts,
      idKey: "thoughtId"
    },
    {
      key: "emotion",
      title: "چه احساسی بالا می‌آید؟",
      items: schema.emotional_signals,
      idKey: "emotionId"
    },
    {
      key: "behavior",
      title: "معمولاً چه کار می‌کنی؟",
      items: schema.behavioral_patterns,
      idKey: "behaviorId"
    }
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
    <Shell
      title={schema.name_fa}
      onBack={step === 0 ? onBack : () => setStep(step - 1)}
    >
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
 * ۶. صفحه نمایش چرخه
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

      <Card style={{ marginTop: 12, background: "#f6f6f6" }}>
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.9 }}>
          هر بار این چرخه تکرار شود، باور قدیمی قوی‌تر می‌شود.
          قرار نیست یک‌شبه عوضش کنیم؛ فقط می‌خواهیم یک نقطه مکث اضافه کنیم.
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <Btn onClick={onContinue}>بعدی — بیایید این چرخه را بشکنیم</Btn>
      </div>
    </Shell>
  );
}

/* =========================================================
 * ۷. صفحه تمرین
 * ========================================================= */

function ExerciseView({ schemaId, selection, onDone, onBack }) {
  const schema = SCHEMAS.find((s) => s.id === schemaId);
  const rule = resolveExercise(schemaId, selection.triggerId, selection.behaviorId);
  const exercise = resolveExerciseFromRule(schema, rule);

  if (!exercise) {
    return (
      <Shell title="تمرین" onBack={onBack}>
        <Card>
          <p>برای این ترکیب، تمرینی تعریف نشده. مستقیم برویم سراغ مأموریت.</p>
        </Card>
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
 * ۸. صفحه مأموریت (چند گزینه‌ای)
 * ========================================================= */

function MissionView({ schemaId, onDone, onBack }) {
  const schema = SCHEMAS.find((s) => s.id === schemaId);
  const missions = schema?.real_life_missions || [];
  const [selectedId, setSelectedId] = useState(missions[0]?.id || null);

  if (missions.length === 0) {
    return (
      <Shell title="مأموریت امروز" onBack={onBack}>
        <Card>
          <p>مأموریتی برای این الگو تعریف نشده.</p>
        </Card>
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
        <p style={{ margin: "0 0 14px", fontSize: 14, color: "#666" }}>
          یکی را انتخاب کن. فقط یکی — کوچک‌ترین که می‌توانی.
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
 * ۹. ثبت نتیجه
 * ========================================================= */

function LogResultView({ schemaId, selection, onDone, onBack }) {
  const [reaction, setReaction] = useState(null);
  const [missionDone, setMissionDone] = useState(false);
  const [notes, setNotes] = useState("");

  const replacement = getReplacementResponse(schemaId, selection.behaviorId);

  const options = [
    { id: "old", label: "واکنش قدیمی را انجام دادم", color: "#e74c3c" },
    { id: "paused", label: "مکث کردم", color: "#f39c12" },
    { id: "new", label: "پاسخ جدید را امتحان کردم", color: "#27ae60" }
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
                {o.label}
              </button>
            );
          })}
        </div>
      </Card>

      {replacement && selection.behaviorId && (
        <Card style={{ marginTop: 12, background: "#f6f6f6" }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>
            پاسخ جایگزینی که این هفته تمرین کردی:
          </div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{replacement}</div>
        </Card>
      )}

      <Card style={{ marginTop: 12 }}>
        <label
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
        >
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
          placeholder="چه چیزی کمک کرد؟ چه چیزی سخت بود؟"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #ddd",
            fontFamily: "inherit",
            fontSize: 13,
            resize: "vertical",
            boxSizing: "border-box"
          }}
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
 * ۱۰. صفحه پیشرفت
 * ========================================================= */

function ProgressView({ schemaId, onBack, onQuick }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    buildProgressSummary(schemaId).then(setSummary);
  }, [schemaId]);

  if (!summary) {
    return (
      <Shell title="پیشرفت" onBack={onBack} showQuickButton onQuick={onQuick}>
        <p style={{ color: "#888" }}>در حال بارگذاری...</p>
      </Shell>
    );
  }

  const { reactions, total, streak, insights, weekly } = summary;

  return (
    <Shell title="پیشرفت" onBack={onBack} showQuickButton onQuick={onQuick}>
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline"
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#888" }}>فعال شدن الگو</div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums"
              }}
            >
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
      </Card>

      <Card style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>واکنش قدیمی</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {toFa(reactions.old)}
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            <ProgressBar
              value={reactions.old}
              max={Math.max(10, total)}
              color="#e74c3c"
            />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>مکث</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {toFa(reactions.paused)}
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            <ProgressBar
              value={reactions.paused}
              max={Math.max(10, total)}
              color="#f39c12"
            />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>پاسخ جدید</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              {toFa(reactions.new)}
            </span>
          </div>
          <div style={{ marginTop: 4 }}>
            <ProgressBar
              value={reactions.new}
              max={Math.max(10, total)}
              color="#27ae60"
            />
          </div>
        </div>
      </Card>

      {(weekly.lastWeek.total > 0 || weekly.thisWeek.total > 0) && (
        <Card style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            این هفته در مقایسه با هفته قبل
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              fontSize: 13
            }}
          >
            <div style={{ color: "#888" }}></div>
            <div style={{ textAlign: "center", color: "#888", fontSize: 12 }}>
              هفته قبل
            </div>
            <div style={{ textAlign: "center", color: "#888", fontSize: 12 }}>
              این هفته
            </div>

            <div>فعال شدن</div>
            <div style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
              {toFa(weekly.lastWeek.total)}
            </div>
            <div
              style={{
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
                fontWeight: 600
              }}
            >
              {toFa(weekly.thisWeek.total)}
            </div>

            <div>واکنش قدیمی</div>
            <div
              style={{
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
                color: "#e74c3c"
              }}
            >
              {toFa(weekly.lastWeek.old)}
            </div>
            <div
              style={{
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
                color: "#e74c3c",
                fontWeight: 600
              }}
            >
              {toFa(weekly.thisWeek.old)}
            </div>

            <div>پاسخ جدید</div>
            <div
              style={{
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
                color: "#27ae60"
              }}
            >
              {toFa(weekly.lastWeek.new)}
            </div>
            <div
              style={{
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
                color: "#27ae60",
                fontWeight: 600
              }}
            >
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
 * ۱۱. جریان سریع
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
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid #e5e5e5",
                  background: "#fff",
                  fontSize: 14,
                  textAlign: "right",
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
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
            <button
              onClick={() => save("old")}
              style={{
                padding: 14,
                borderRadius: 12,
                border: "1px solid #e74c3c",
                background: "#fff",
                color: "#e74c3c",
                fontSize: 14,
                cursor: "pointer",
                textAlign: "right",
                fontFamily: "inherit"
              }}
            >
              واکنش قدیمی
            </button>
            <button
              onClick={() => save("new")}
              style={{
                padding: 14,
                borderRadius: 12,
                border: "1px solid #27ae60",
                background: "#27ae60",
                color: "#fff",
                fontSize: 14,
                cursor: "pointer",
                textAlign: "right",
                fontFamily: "inherit"
              }}
            >
              امتحان جدید
            </button>
            <button
              onClick={() => save("paused")}
              style={{
                padding: 14,
                borderRadius: 12,
                border: "1px solid #f39c12",
                background: "#fff",
                color: "#f39c12",
                fontSize: 14,
                cursor: "pointer",
                textAlign: "right",
                fontFamily: "inherit"
              }}
            >
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
 * ۱۲. اپ اصلی
 * ========================================================= */

export default function App() {
  const [view, setView] = useState("welcome");
  const [analysis, setAnalysis] = useState(null);
  const [activeSchemaId, setActiveSchemaId] = useState(null);
  const [selection, setSelection] = useState(null);
  const [exerciseRecord, setExerciseRecord] = useState(null);
  const [missionRecord, setMissionRecord] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadProfile().then((p) => {
      if (p) setAnalysis(p);
      setLoaded(true);
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

  if (!loaded) {
    return (
      <div style={styles.app}>
        <p style={{ textAlign: "center", padding: 40 }}>در حال بارگذاری...</p>
      </div>
    );
  }

  if (view === "welcome") {
    return (
      <WelcomeView
        hasProfile={!!analysis}
        onStart={() => go("ysq")}
        onSkipToProfile={() => go("profile")}
      />
    );
  }

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

  if (view === "profile") {
    return (
      <ProfileView
        analysis={analysis}
        onBack={() => go("welcome")}
        onRetake={() => go("ysq")}
        onPickSchema={(id) => {
          setActiveSchemaId(id);
          go("cycle");
        }}
      />
    );
  }

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

  if (view === "progress") {
    return (
      <ProgressView
        schemaId={activeSchemaId}
        onBack={() => go("profile")}
        onQuick={() => go("quick")}
      />
    );
  }

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
 * ۱۳. استایل‌ها
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
  }
};
