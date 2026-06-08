"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheckIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  ClockIcon,
  SparklesIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const HIGHLIGHTS = [
  { icon: ClockIcon, title: "Set up in minutes", body: "Add your services and hours, then share one link." },
  { icon: ShieldCheckIcon, title: "No double bookings", body: "Slots lock the moment a customer confirms." },
  { icon: SparklesIcon, title: "Your brand, your page", body: "Logo and colors on a booking page that feels like you." },
];

export default function AuthPage() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(formData.email, formData.password);
      router.push("/admin");
    } catch (err: any) {
      setError(err?.message || "Login failed");
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — hidden on small screens */}
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(60% 60% at 80% 0%, rgba(255,255,255,0.35) 0%, transparent 60%), radial-gradient(50% 50% at 0% 100%, rgba(0,0,0,0.25) 0%, transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-2.5 text-lg font-semibold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <CalendarCheckIcon className="size-5" />
          </span>
          BookingOS
        </div>

        <div className="relative max-w-md space-y-8">
          <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight">
            Bookings that run themselves.
          </h1>
          <ul className="space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Icon className="size-5" />
                </span>
                <div className="space-y-0.5">
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-primary-foreground/75">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-primary-foreground/60">
          Trusted by salons, clinics, and studios.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center bg-muted/40 px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm animate-fade-in-up">
          {/* Compact brand for mobile */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CalendarCheckIcon className="size-5" />
            </span>
            <span className="text-lg font-semibold">BookingOS</span>
          </div>

          <div className="mb-6 space-y-1.5">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to manage your bookings.</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4 border-destructive/30 bg-destructive/5">
              <AlertDescription className="text-destructive/90">{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleInputChange}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleInputChange}
                  autoComplete="current-password"
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
            </div>

            <Button type="submit" size="lg" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Please wait…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRightIcon className="size-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account? Contact us to get your booking page set up.
          </p>
        </div>
      </main>
    </div>
  );
}
