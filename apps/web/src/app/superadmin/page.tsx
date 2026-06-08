"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldIcon,
  PlusIcon,
  RefreshCwIcon,
  PowerIcon,
  PowerOffIcon,
  LogOutIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SECRET_STORAGE_KEY = "bookingos.superAdminSecret";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  ownerEmail: string | null;
  bookingCount: number;
}

/** Internal ops tool: gate on the shared secret, then manage tenants. */
export default function SuperAdminPage() {
  const [secret, setSecret] = useState<string | null>(null);
  const [secretInput, setSecretInput] = useState("");
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Restore the secret from localStorage on mount (acceptable for an internal
  // tool — these routes are not part of the tenant JWT flow).
  useEffect(() => {
    const stored = localStorage.getItem(SECRET_STORAGE_KEY);
    if (stored) setSecret(stored);
  }, []);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const res = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-Super-Admin-Secret": secret ?? "",
          ...(init?.headers ?? {}),
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      return body;
    },
    [secret]
  );

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await call("/superadmin/tenants");
      setTenants(data);
    } catch (err: any) {
      setError(err.message);
      // A 403 means the stored secret is wrong — drop it and re-prompt.
      if (/403|forbidden/i.test(err.message)) {
        localStorage.removeItem(SECRET_STORAGE_KEY);
        setSecret(null);
      }
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    if (secret) loadTenants();
  }, [secret, loadTenants]);

  const saveSecret = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = secretInput.trim();
    if (!trimmed) return;
    localStorage.setItem(SECRET_STORAGE_KEY, trimmed);
    setSecret(trimmed);
    setSecretInput("");
  };

  const signOut = () => {
    localStorage.removeItem(SECRET_STORAGE_KEY);
    setSecret(null);
    setTenants(null);
  };

  // --- Secret gate ---------------------------------------------------------
  if (!secret) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="space-y-5 pt-6">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ShieldIcon className="size-5" />
              </span>
              <div>
                <p className="font-semibold">Super Admin</p>
                <p className="text-xs text-muted-foreground">Internal ops tool</p>
              </div>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={saveSecret} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="secret">Super admin secret</Label>
                <Input
                  id="secret"
                  type="password"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  placeholder="X-Super-Admin-Secret"
                  autoComplete="off"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  // --- Panel ---------------------------------------------------------------
  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldIcon className="size-5" />
          </span>
          <div>
            <h1 className="font-heading text-xl font-semibold">Super Admin</h1>
            <p className="text-xs text-muted-foreground">Tenant provisioning &amp; management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadTenants} disabled={loading}>
            <RefreshCwIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOutIcon className="size-4" />
            Sign out
          </Button>
        </div>
      </header>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <CreateTenantForm
        onCreate={async (input) => {
          await call("/superadmin/tenants", { method: "POST", body: JSON.stringify(input) });
          await loadTenants();
        }}
      />

      <TenantTable
        tenants={tenants}
        loading={loading}
        onToggle={async (t) => {
          await call(`/superadmin/tenants/${t.id}`, {
            method: "PATCH",
            body: JSON.stringify({ isActive: !t.isActive }),
          });
          await loadTenants();
        }}
      />
    </main>
  );
}

// ============================================================================
// Create tenant form
// ============================================================================

interface CreateInput {
  name: string;
  slug: string;
  ownerEmail: string;
  ownerPassword: string;
}

function CreateTenantForm({ onCreate }: { onCreate: (input: CreateInput) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<CreateInput>({
    name: "",
    slug: "",
    ownerEmail: "",
    ownerPassword: "",
  });

  const update = (k: keyof CreateInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      // Slug is optional server-side (derived from name) — omit when blank.
      await onCreate({ ...form, slug: form.slug.trim() });
      setForm({ name: "", slug: "", ownerEmail: "", ownerPassword: "" });
      setOpen(false);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <div className="mb-4">
        <Button onClick={() => setOpen(true)}>
          <PlusIcon className="size-4" />
          New tenant
        </Button>
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <h2 className="mb-4 font-medium">Create tenant</h2>
        {formError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Business name</Label>
            <Input id="name" value={form.name} onChange={update("name")} required minLength={2} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug (optional)</Label>
            <Input
              id="slug"
              value={form.slug}
              onChange={update("slug")}
              placeholder="derived from name"
              pattern="[a-z0-9-]*"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ownerEmail">Owner email</Label>
            <Input
              id="ownerEmail"
              type="email"
              value={form.ownerEmail}
              onChange={update("ownerEmail")}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ownerPassword">Owner password</Label>
            <Input
              id="ownerPassword"
              type="text"
              value={form.ownerPassword}
              onChange={update("ownerPassword")}
              placeholder="8+ chars, upper, lower, number, special"
              required
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create tenant"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Tenant table
// ============================================================================

function TenantTable({
  tenants,
  loading,
  onToggle,
}: {
  tenants: Tenant[] | null;
  loading: boolean;
  onToggle: (t: Tenant) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (tenants === null) {
    return <p className="text-sm text-muted-foreground">{loading ? "Loading…" : "No data."}</p>;
  }

  if (tenants.length === 0) {
    return <p className="text-sm text-muted-foreground">No tenants yet. Create one above.</p>;
  }

  const toggle = async (t: Tenant) => {
    setBusyId(t.id);
    try {
      await onToggle(t);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Tenant</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Bookings</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">/{t.slug}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{t.ownerEmail ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{t.bookingCount}</td>
                <td className="px-4 py-3">
                  {t.isActive ? (
                    <Badge variant="secondary">Active</Badge>
                  ) : (
                    <Badge variant="destructive">Inactive</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === t.id}
                    onClick={() => toggle(t)}
                  >
                    {t.isActive ? (
                      <>
                        <PowerOffIcon className="size-4" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <PowerIcon className="size-4" />
                        Activate
                      </>
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
