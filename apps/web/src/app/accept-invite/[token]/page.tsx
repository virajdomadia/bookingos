"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CalendarCheckIcon,
  EyeIcon,
  EyeOffIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  ArrowRightIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface InviteInfo {
  email: string;
  role: string;
  businessName: string;
  expired: boolean;
}

type View = "loading" | "invalid" | "expired" | "ready" | "success";

// Client-side mirror of the server's password rules — only to give live
// feedback; the API (validatePassword) is the source of truth.
function passwordIssue(pw: string): string | null {
  if (pw.length < 8) return "At least 8 characters";
  if (!/[A-Z]/.test(pw)) return "Add an uppercase letter";
  if (!/[a-z]/.test(pw)) return "Add a lowercase letter";
  if (!/[0-9]/.test(pw)) return "Add a number";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) return "Add a special character";
  return null;
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();

  const [view, setView] = useState<View>("loading");
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/invite/${encodeURIComponent(token)}`);
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setLoadError(json?.error ?? "This invite link is invalid.");
          setView("invalid");
          return;
        }
        setInfo(json.data);
        setView(json.data.expired ? "expired" : "ready");
      } catch {
        if (!active) return;
        setLoadError("Couldn't load this invite. Check your connection and try again.");
        setView("invalid");
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const issue = passwordIssue(password);
    if (issue) { setFormError(issue + "."); return; }
    if (password !== confirm) { setFormError("Passwords don't match."); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/auth/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 410) { setView("expired"); return; }
        setFormError(json?.error ?? "Couldn't activate your account. Please try again.");
        return;
      }
      setView("success");
    } catch {
      setFormError("Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CalendarCheckIcon className="size-5" />
          </span>
          <span className="text-lg font-semibold">BookingOS</span>
        </div>

        {view === "loading" && (
          <p className="py-16 text-center text-muted-foreground">Loading your invite…</p>
        )}

        {view === "invalid" && (
          <div className="space-y-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <AlertTriangleIcon className="size-6" />
            </div>
            <h1 className="font-heading text-xl font-semibold text-foreground">Invite not found</h1>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Link href="/auth" className="inline-block pt-2">
              <Button variant="outline">Go to sign in</Button>
            </Link>
          </div>
        )}

        {view === "expired" && (
          <div className="space-y-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-warning/15 text-warning-foreground">
              <AlertTriangleIcon className="size-6" />
            </div>
            <h1 className="font-heading text-xl font-semibold text-foreground">Invite expired</h1>
            <p className="text-sm text-muted-foreground">
              This invite link has expired. Ask {info?.businessName ?? "the business owner"} to send
              you a new one.
            </p>
          </div>
        )}

        {view === "success" && (
          <div className="space-y-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2Icon className="size-6" />
            </div>
            <h1 className="font-heading text-xl font-semibold text-foreground">You're all set</h1>
            <p className="text-sm text-muted-foreground">
              Your account is active. Sign in with your email and new password.
            </p>
            <Link href="/auth" className="inline-block pt-2">
              <Button>
                Sign in
                <ArrowRightIcon className="size-4" />
              </Button>
            </Link>
          </div>
        )}

        {view === "ready" && info && (
          <>
            <div className="mb-6 space-y-1.5">
              <h1 className="font-heading text-2xl font-semibold tracking-tight">
                Join {info.businessName}
              </h1>
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {info.email}
                <Badge variant="secondary">{info.role}</Badge>
              </p>
            </div>

            {formError && (
              <Alert variant="destructive" className="mb-4 border-destructive/30 bg-destructive/5">
                <AlertDescription className="text-destructive/90">{formError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Create a password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  8+ characters with upper, lower, a number, and a special character.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </div>

              <Button type="submit" size="lg" disabled={submitting} className="w-full">
                {submitting ? "Activating…" : "Activate account"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
