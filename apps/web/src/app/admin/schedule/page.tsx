"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const SLOT_INTERVALS = [15, 30, 45, 60, 90, 120];

const TIMEZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
];

interface BreakTime {
  start: string;
  end: string;
}

interface Schedule {
  timezone: string;
  workingDays: Record<string, boolean>;
  workStart: string;
  workEnd: string;
  slotInterval: number;
  breakTimes: BreakTime[];
  bufferTime: number;
}

interface Tenant {
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
}

export default function SchedulePage() {
  const router = useRouter();
  const { accessToken, isLoading } = useAuth();

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState("");
  const [brandingSuccess, setBrandingSuccess] = useState("");

  // Branding state
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4F46E5");

  useEffect(() => {
    if (!isLoading && !accessToken) {
      router.push("/auth");
    }
  }, [accessToken, isLoading, router]);

  useEffect(() => {
    if (!accessToken) return;
    loadData();
  }, [accessToken]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [schedRes, tenantRes] = await Promise.all([
        api.get("/admin/schedule"),
        api.get("/admin/tenant"),
      ]);
      const s = schedRes.data.data;
      setSchedule({
        timezone: s.timezone,
        workingDays: s.workingDays,
        workStart: s.workStart,
        workEnd: s.workEnd,
        slotInterval: s.slotInterval,
        breakTimes: Array.isArray(s.breakTimes) ? s.breakTimes : [],
        bufferTime: s.bufferTime,
      });
      setTenant(tenantRes.data.data);
      setLogoUrl(tenantRes.data.data.logoUrl || "");
      setPrimaryColor(tenantRes.data.data.primaryColor || "#4F46E5");
    } catch {
      setError("Failed to load settings. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (key: string) => {
    if (!schedule) return;
    const updated = { ...schedule.workingDays, [key]: !schedule.workingDays[key] };
    const anyActive = Object.values(updated).some(Boolean);
    if (!anyActive) {
      setError("At least one working day must be active.");
      return;
    }
    setError("");
    setSchedule({ ...schedule, workingDays: updated });
  };

  const addBreak = () => {
    if (!schedule) return;
    setSchedule({
      ...schedule,
      breakTimes: [...schedule.breakTimes, { start: "12:00", end: "13:00" }],
    });
  };

  const updateBreak = (index: number, field: "start" | "end", value: string) => {
    if (!schedule) return;
    const updated = schedule.breakTimes.map((b, i) =>
      i === index ? { ...b, [field]: value } : b
    );
    setSchedule({ ...schedule, breakTimes: updated });
  };

  const removeBreak = (index: number) => {
    if (!schedule) return;
    setSchedule({
      ...schedule,
      breakTimes: schedule.breakTimes.filter((_, i) => i !== index),
    });
  };

  const validateSchedule = (): string | null => {
    if (!schedule) return "No schedule data";
    if (schedule.workStart >= schedule.workEnd) return "Work start must be before work end.";
    for (const b of schedule.breakTimes) {
      if (b.start >= b.end) return "Break start must be before break end.";
    }
    return null;
  };

  const saveSchedule = async () => {
    const validationError = validateSchedule();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    setScheduleSuccess("");
    try {
      await api.put("/admin/schedule", schedule);
      setScheduleSuccess("Schedule saved successfully!");
      setTimeout(() => setScheduleSuccess(""), 3000);
    } catch {
      setError("Failed to save schedule. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveBranding = async () => {
    if (primaryColor && !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      setError("Color must be in #RRGGBB format.");
      return;
    }
    setSavingBranding(true);
    setError("");
    setBrandingSuccess("");
    try {
      await api.put("/admin/tenant", { logoUrl: logoUrl || null, primaryColor });
      setBrandingSuccess("Branding saved successfully!");
      setTimeout(() => setBrandingSuccess(""), 3000);
    } catch {
      setError("Failed to save branding. Please try again.");
    } finally {
      setSavingBranding(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div style={s.container}>
        <div style={s.header}>
          <Link href="/admin" style={s.backLink}>← Dashboard</Link>
          <h1 style={s.title}>Schedule & Branding</h1>
        </div>
        <div style={{ ...s.content, textAlign: "center", paddingTop: "4rem", color: "#6b7280" }}>
          Loading settings...
        </div>
      </div>
    );
  }

  if (!accessToken) return null;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/admin" style={s.backLink}>← Dashboard</Link>
          <h1 style={s.title}>Schedule & Branding</h1>
        </div>
        {tenant && (
          <span style={s.slugBadge}>{tenant.slug}</span>
        )}
      </div>

      <div style={s.content}>
        {error && <div style={s.errorAlert}>{error}</div>}

        {schedule && (
          <>
            {/* Working Days */}
            <div style={s.card}>
              <h2 style={s.cardTitle}>Working Days</h2>
              <div style={s.daysGrid}>
                {DAYS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => toggleDay(key)}
                    style={{
                      ...s.dayBtn,
                      ...(schedule.workingDays[key] ? s.dayBtnActive : s.dayBtnInactive),
                    }}
                  >
                    {label.slice(0, 3)}
                    <span style={s.dayFull}>{label.slice(3)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Working Hours */}
            <div style={s.card}>
              <h2 style={s.cardTitle}>Working Hours</h2>
              <div style={s.row}>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Start Time</label>
                  <input
                    type="time"
                    value={schedule.workStart}
                    onChange={(e) => setSchedule({ ...schedule, workStart: e.target.value })}
                    style={s.input}
                  />
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>End Time</label>
                  <input
                    type="time"
                    value={schedule.workEnd}
                    onChange={(e) => setSchedule({ ...schedule, workEnd: e.target.value })}
                    style={s.input}
                  />
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Slot Interval</label>
                  <select
                    value={schedule.slotInterval}
                    onChange={(e) => setSchedule({ ...schedule, slotInterval: Number(e.target.value) })}
                    style={s.input}
                  >
                    {SLOT_INTERVALS.map((v) => (
                      <option key={v} value={v}>{v} min</option>
                    ))}
                  </select>
                </div>
                <div style={s.fieldGroup}>
                  <label style={s.label}>Buffer Between Bookings</label>
                  <select
                    value={schedule.bufferTime}
                    onChange={(e) => setSchedule({ ...schedule, bufferTime: Number(e.target.value) })}
                    style={s.input}
                  >
                    {[0, 5, 10, 15, 30].map((v) => (
                      <option key={v} value={v}>{v === 0 ? "None" : `${v} min`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Timezone */}
            <div style={s.card}>
              <h2 style={s.cardTitle}>Timezone</h2>
              <select
                value={schedule.timezone}
                onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })}
                style={{ ...s.input, maxWidth: "320px" }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>

            {/* Break Times */}
            <div style={s.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h2 style={{ ...s.cardTitle, marginBottom: 0 }}>Break Times</h2>
                <button onClick={addBreak} style={s.addBtn}>+ Add Break</button>
              </div>
              {schedule.breakTimes.length === 0 && (
                <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>No breaks configured. Bookings run continuously through working hours.</p>
              )}
              {schedule.breakTimes.map((b, i) => (
                <div key={i} style={s.breakRow}>
                  <div style={s.fieldGroup}>
                    <label style={s.label}>Start</label>
                    <input
                      type="time"
                      value={b.start}
                      onChange={(e) => updateBreak(i, "start", e.target.value)}
                      style={s.input}
                    />
                  </div>
                  <div style={s.fieldGroup}>
                    <label style={s.label}>End</label>
                    <input
                      type="time"
                      value={b.end}
                      onChange={(e) => updateBreak(i, "end", e.target.value)}
                      style={s.input}
                    />
                  </div>
                  <button onClick={() => removeBreak(i)} style={s.removeBtn} title="Remove break">×</button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
              <button onClick={saveSchedule} disabled={saving} style={{ ...s.saveBtn, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving..." : "Save Schedule"}
              </button>
              {scheduleSuccess && <span style={s.inlineSuccess}>{scheduleSuccess}</span>}
            </div>
          </>
        )}

        {/* Branding */}
        <div style={{ ...s.card, marginTop: "2rem" }}>
          <h2 style={s.cardTitle}>Branding</h2>
          <div style={s.row}>
            <div style={{ ...s.fieldGroup, flex: 2 }}>
              <label style={s.label}>Logo URL</label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                style={s.input}
              />
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  style={{ marginTop: "0.5rem", maxHeight: "60px", borderRadius: "4px" }}
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Primary Color</label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ width: "44px", height: "40px", padding: "2px", border: "1px solid #d1d5db", borderRadius: "6px", cursor: "pointer" }}
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#4F46E5"
                  maxLength={7}
                  style={{ ...s.input, width: "110px" }}
                />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "1rem", flexWrap: "wrap" }}>
            <button onClick={saveBranding} disabled={savingBranding} style={{ ...s.saveBtn, opacity: savingBranding ? 0.6 : 1 }}>
              {savingBranding ? "Saving..." : "Save Branding"}
            </button>
            {brandingSuccess && <span style={s.inlineSuccess}>{brandingSuccess}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", backgroundColor: "#f3f4f6", fontFamily: "system-ui, -apple-system, sans-serif" },
  header: { backgroundColor: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" },
  backLink: { color: "#3b82f6", textDecoration: "none", fontSize: "0.875rem" },
  title: { fontSize: "1.25rem", fontWeight: "bold", margin: 0 },
  slugBadge: { backgroundColor: "#f3f4f6", color: "#6b7280", fontSize: "0.75rem", padding: "0.25rem 0.75rem", borderRadius: "999px", border: "1px solid #e5e7eb" },
  content: { padding: "1.5rem", maxWidth: "900px", margin: "0 auto" },
  card: { backgroundColor: "white", padding: "1.5rem", borderRadius: "0.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "1rem" },
  cardTitle: { fontSize: "1rem", fontWeight: "600", marginTop: 0, marginBottom: "1rem", color: "#111827" },
  daysGrid: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  dayBtn: { padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "500", fontSize: "0.875rem", transition: "background 0.15s" },
  dayFull: { display: "none" },
  dayBtnActive: { backgroundColor: "#3b82f6", color: "white" },
  dayBtnInactive: { backgroundColor: "#f3f4f6", color: "#6b7280" },
  row: { display: "flex", gap: "1rem", flexWrap: "wrap" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1, minWidth: "140px" },
  label: { fontSize: "0.75rem", fontWeight: "600", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" },
  input: { padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "0.375rem", fontSize: "0.875rem", color: "#111827", outline: "none", width: "100%", boxSizing: "border-box" },
  addBtn: { padding: "0.375rem 0.875rem", backgroundColor: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: "500" },
  breakRow: { display: "flex", gap: "1rem", alignItems: "flex-end", marginBottom: "0.75rem" },
  removeBtn: { padding: "0.5rem 0.75rem", backgroundColor: "#fee2e2", color: "#dc2626", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "1.25rem", lineHeight: 1 },
  saveBtn: { padding: "0.75rem 2rem", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" },
  errorAlert: { backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "0.875rem 1rem", borderRadius: "0.375rem", marginBottom: "1rem", fontSize: "0.875rem" },
  inlineSuccess: { color: "#166534", fontSize: "0.875rem", fontWeight: "500" },
};
