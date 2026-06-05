"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#4F46E5");

  useEffect(() => {
    if (!isLoading && !accessToken) router.push("/auth");
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
      breakTimes: schedule.breakTimes.map((b, i) => i === index ? { ...b, [field]: value } : b),
    });
  };

  const removeBreak = (index: number) => {
    if (!schedule) return;
    setSchedule({ ...schedule, breakTimes: schedule.breakTimes.filter((_, i) => i !== index) });
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

  const nativeSelectClass = "w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring";

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-border px-6 py-4 flex items-center gap-4">
          <Link href="/admin" className="text-sm text-primary hover:underline">← Dashboard</Link>
          <h1 className="text-xl font-bold text-gray-900">Schedule & Branding</h1>
        </header>
        <div className="flex items-center justify-center pt-16 text-muted-foreground">
          Loading settings...
        </div>
      </div>
    );
  }

  if (!accessToken) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-border px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-primary hover:underline">← Dashboard</Link>
          <h1 className="text-xl font-bold text-gray-900">Schedule & Branding</h1>
        </div>
        {tenant && (
          <Badge variant="secondary">{tenant.slug}</Badge>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {schedule && (
          <>
            {/* Working Days */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Working Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => toggleDay(key)}
                      className={cn(
                        "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                        schedule.workingDays[key]
                          ? "bg-primary text-primary-foreground"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      {label.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Working Hours */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Working Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={schedule.workStart}
                      onChange={(e) => setSchedule({ ...schedule, workStart: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={schedule.workEnd}
                      onChange={(e) => setSchedule({ ...schedule, workEnd: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Slot Interval</Label>
                    <select
                      value={schedule.slotInterval}
                      onChange={(e) => setSchedule({ ...schedule, slotInterval: Number(e.target.value) })}
                      className={nativeSelectClass}
                    >
                      {SLOT_INTERVALS.map((v) => (
                        <option key={v} value={v}>{v} min</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Buffer Between Bookings</Label>
                    <select
                      value={schedule.bufferTime}
                      onChange={(e) => setSchedule({ ...schedule, bufferTime: Number(e.target.value) })}
                      className={nativeSelectClass}
                    >
                      {BUFFER_TIMES.map((v) => (
                        <option key={v} value={v}>{v === 0 ? "None" : `${v} min`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timezone */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Timezone</CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  value={schedule.timezone}
                  onChange={(e) => setSchedule({ ...schedule, timezone: e.target.value })}
                  className={cn(nativeSelectClass, "max-w-xs")}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </CardContent>
            </Card>

            {/* Break Times */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base">Break Times</CardTitle>
                  <Button variant="outline" size="sm" onClick={addBreak}>+ Add Break</Button>
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
                      <div className="space-y-1.5 flex-1">
                        <Label>Start</Label>
                        <Input
                          type="time"
                          value={b.start}
                          onChange={(e) => updateBreak(i, "start", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5 flex-1">
                        <Label>End</Label>
                        <Input
                          type="time"
                          value={b.end}
                          onChange={(e) => updateBreak(i, "end", e.target.value)}
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeBreak(i)}
                        className="mb-0.5"
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button onClick={saveSchedule} disabled={saving}>
                {saving ? "Saving..." : "Save Schedule"}
              </Button>
              {scheduleSuccess && (
                <span className="text-sm text-green-600 font-medium">{scheduleSuccess}</span>
              )}
            </div>
          </>
        )}

        {/* Branding */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Logo URL</Label>
                <Input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
                {logoUrl && (
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="mt-2 max-h-14 rounded"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Primary Color</Label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-9 rounded border border-input cursor-pointer p-0.5"
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
                {savingBranding ? "Saving..." : "Save Branding"}
              </Button>
              {brandingSuccess && (
                <span className="text-sm text-green-600 font-medium">{brandingSuccess}</span>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
