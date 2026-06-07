"use client";

import { useEffect, useState } from "react";
import { PlusIcon, Trash2Icon, CheckIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { AdminShell } from "../_components/AdminShell";

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const SLOT_INTERVALS = [15, 30, 45, 60, 90, 120];
const BUFFER_TIMES = [0, 5, 10, 15, 30];
const TIMEZONES = [
  "Asia/Kolkata", "UTC", "America/New_York", "America/Chicago",
  "America/Los_Angeles", "Europe/London", "Europe/Paris",
  "Asia/Dubai", "Asia/Singapore", "Australia/Sydney",
];

interface BreakTime { start: string; end: string }
interface Schedule {
  timezone: string;
  workingDays: Record<string, boolean>;
  workStart: string;
  workEnd: string;
  slotInterval: number;
  breakTimes: BreakTime[];
  bufferTime: number;
}
interface Tenant { name: string; slug: string; logoUrl: string | null; primaryColor: string }

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export default function SchedulePage() {
  const { accessToken } = useAuth();

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [, setTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState("");
  const [brandingSuccess, setBrandingSuccess] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4F46E5");

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
    if (!Object.values(updated).some(Boolean)) {
      setError("At least one working day must be active.");
      return;
    }
    setError("");
    setSchedule({ ...schedule, workingDays: updated });
  };

  const addBreak = () => {
    if (!schedule) return;
    setSchedule({ ...schedule, breakTimes: [...schedule.breakTimes, { start: "12:00", end: "13:00" }] });
  };

  const updateBreak = (index: number, field: "start" | "end", value: string) => {
    if (!schedule) return;
    setSchedule({
      ...schedule,
      breakTimes: schedule.breakTimes.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
    });
  };

  const removeBreak = (index: number) => {
    if (!schedule) return;
    setSchedule({ ...schedule, breakTimes: schedule.breakTimes.filter((_, i) => i !== index) });
  };

  const validateSchedule = (): string | null => {
    if (!schedule) return "No schedule data";
    if (schedule.workStart >= schedule.workEnd) return "Work start must be before work end.";
    // Mirror the server's coherence checks so the user gets inline feedback
    // instead of a round-trip error: breaks ordered, within hours, no overlap.
    const breaks = [...schedule.breakTimes].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < breaks.length; i++) {
      const b = breaks[i];
      if (b.start >= b.end) return "Break start must be before break end.";
      if (b.start < schedule.workStart || b.end > schedule.workEnd) {
        return "Break times must fall within working hours.";
      }
      if (i > 0 && b.start < breaks[i - 1].end) return "Break times must not overlap.";
    }
    return null;
  };

  const saveSchedule = async () => {
    const validationError = validateSchedule();
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    setError("");
    setScheduleSuccess("");
    try {
      await api.put("/admin/schedule", schedule);
      setScheduleSuccess("Schedule saved!");
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
      setBrandingSuccess("Branding saved!");
      setTimeout(() => setBrandingSuccess(""), 3000);
    } catch {
      setError("Failed to save branding. Please try again.");
    } finally {
      setSavingBranding(false);
    }
  };

  return (
    <AdminShell active="schedule" title="Schedule & branding">
      <div className="space-y-4">
        {error && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <AlertDescription className="text-destructive/90">{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <>
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </>
        ) : schedule ? (
          <>
            {/* Working days */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Working days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(({ key, label }) => {
                    const on = schedule.workingDays[key];
                    return (
                      <button
                        key={key}
                        onClick={() => toggleDay(key)}
                        aria-pressed={on}
                        className={cn(
                          "h-10 w-14 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          on
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted text-muted-foreground hover:bg-muted/70"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Working hours */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Working hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ws">Start time</Label>
                    <Input id="ws" type="time" value={schedule.workStart} onChange={(e) => setSchedule({ ...schedule, workStart: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="we">End time</Label>
                    <Input id="we" type="time" value={schedule.workEnd} onChange={(e) => setSchedule({ ...schedule, workEnd: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="si">Slot interval</Label>
                    <select id="si" value={schedule.slotInterval} onChange={(e) => setSchedule({ ...schedule, slotInterval: Number(e.target.value) })} className={selectClass}>
                      {SLOT_INTERVALS.map((v) => <option key={v} value={v}>{v} min</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bt">Buffer between bookings</Label>
                    <select id="bt" value={schedule.bufferTime} onChange={(e) => setSchedule({ ...schedule, bufferTime: Number(e.target.value) })} className={selectClass}>
                      {BUFFER_TIMES.map((v) => <option key={v} value={v}>{v === 0 ? "None" : `${v} min`}</option>)}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timezone */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Timezone</CardTitle>
              </CardHeader>
              <CardContent>
                <select value={schedule.timezone} onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })} className={cn(selectClass, "max-w-xs")}>
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </CardContent>
            </Card>

            {/* Break times */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Break times</CardTitle>
                  <Button variant="outline" size="sm" onClick={addBreak}>
                    <PlusIcon className="size-3.5" />
                    Add break
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {schedule.breakTimes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No breaks configured. Bookings run continuously through working hours.
                  </p>
                ) : (
                  schedule.breakTimes.map((b, i) => (
                    <div key={i} className="flex items-end gap-3">
                      <div className="flex-1 space-y-1.5">
                        <Label>Start</Label>
                        <Input type="time" value={b.start} onChange={(e) => updateBreak(i, "start", e.target.value)} />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <Label>End</Label>
                        <Input type="time" value={b.end} onChange={(e) => updateBreak(i, "end", e.target.value)} />
                      </div>
                      <Button variant="destructive" size="icon" onClick={() => removeBreak(i)} aria-label="Remove break">
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button onClick={saveSchedule} disabled={saving}>
                {saving ? "Saving…" : "Save schedule"}
              </Button>
              {scheduleSuccess && (
                <span className="flex items-center gap-1 text-sm font-medium text-success">
                  <CheckIcon className="size-4" />
                  {scheduleSuccess}
                </span>
              )}
            </div>
          </>
        ) : null}

        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="logo">Logo URL</Label>
                <Input id="logo" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="mt-2 max-h-14 rounded-lg ring-1 ring-border"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="color">Primary color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="size-10 cursor-pointer rounded-md border border-input p-0.5"
                  />
                  <Input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#4F46E5"
                    maxLength={7}
                    className="w-28"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={saveBranding} disabled={savingBranding}>
                {savingBranding ? "Saving…" : "Save branding"}
              </Button>
              {brandingSuccess && (
                <span className="flex items-center gap-1 text-sm font-medium text-success">
                  <CheckIcon className="size-4" />
                  {brandingSuccess}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
