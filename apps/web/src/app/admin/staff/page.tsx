"use client";

import { useEffect, useState } from "react";
import { UserPlusIcon, MailIcon, CheckIcon, RotateCwIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AdminShell } from "../_components/AdminShell";

type StaffStatus = "ACTIVE" | "DEACTIVATED" | "INVITE_PENDING" | "INVITE_EXPIRED";
type InvitableRole = "ADMIN" | "STAFF";

interface StaffMember {
  id: string;
  email: string;
  role: "OWNER" | InvitableRole;
  isActive: boolean;
  status: StaffStatus;
  inviteExpiresAt: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<StaffStatus, { label: string; variant: "success" | "secondary" | "warning" | "destructive" }> = {
  ACTIVE: { label: "Active", variant: "success" },
  DEACTIVATED: { label: "Deactivated", variant: "secondary" },
  INVITE_PENDING: { label: "Invite pending", variant: "warning" },
  INVITE_EXPIRED: { label: "Invite expired", variant: "destructive" },
};

const ROLE_HELP: Record<InvitableRole, string> = {
  ADMIN: "Full access except staff management",
  STAFF: "Bookings only — no services, schedule, or staff",
};

const selectClass =
  "h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

export default function StaffPage() {
  const { accessToken, user } = useAuth();

  const [members, setMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InvitableRole>("STAFF");
  const [inviting, setInviting] = useState(false);

  // Row-level pending action (keyed by member id) so buttons can show a spinner.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<StaffMember | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    loadStaff();
  }, [accessToken]);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/staff");
      setMembers(res.data.data);
    } catch {
      setError("Failed to load staff.");
    } finally {
      setLoading(false);
    }
  };

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const errorFrom = (e: unknown, fallback: string): string => {
    if (typeof e === "object" && e && "response" in e) {
      const resp = (e as { response?: { data?: { error?: string } } }).response;
      if (resp?.data?.error) return resp.data.error;
    }
    return fallback;
  };

  const submitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) { setError("Enter an email address."); return; }
    setInviting(true);
    setError("");
    try {
      const res = await api.post("/admin/staff/invite", { email, role: inviteRole });
      setMembers((prev) => [...prev, res.data.data]);
      setInviteEmail("");
      setInviteRole("STAFF");
      flashSuccess(`Invite sent to ${email}.`);
    } catch (e) {
      setError(errorFrom(e, "Failed to send invite. Please try again."));
    } finally {
      setInviting(false);
    }
  };

  const resendInvite = async (m: StaffMember) => {
    setBusyId(m.id);
    setError("");
    try {
      const res = await api.post(`/admin/staff/${m.id}/resend`);
      setMembers((prev) => prev.map((x) => (x.id === m.id ? res.data.data : x)));
      flashSuccess(`Invite re-sent to ${m.email}.`);
    } catch (e) {
      setError(errorFrom(e, "Failed to resend invite."));
    } finally {
      setBusyId(null);
    }
  };

  const setActive = async (m: StaffMember, isActive: boolean) => {
    setBusyId(m.id);
    setError("");
    try {
      const res = await api.patch(`/admin/staff/${m.id}`, { isActive });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? res.data.data : x)));
      flashSuccess(isActive ? "Member reactivated." : "Member deactivated.");
    } catch (e) {
      setError(errorFrom(e, "Failed to update member."));
    } finally {
      setBusyId(null);
    }
  };

  const changeRole = async (m: StaffMember, role: InvitableRole) => {
    setBusyId(m.id);
    setError("");
    try {
      const res = await api.patch(`/admin/staff/${m.id}`, { role });
      setMembers((prev) => prev.map((x) => (x.id === m.id ? res.data.data : x)));
      flashSuccess("Role updated.");
    } catch (e) {
      setError(errorFrom(e, "Failed to change role."));
    } finally {
      setBusyId(null);
    }
  };

  const revokeInvite = async (m: StaffMember) => {
    setBusyId(m.id);
    setError("");
    try {
      await api.delete(`/admin/staff/${m.id}`);
      setMembers((prev) => prev.filter((x) => x.id !== m.id));
      setConfirmRevoke(null);
      flashSuccess("Invite revoked.");
    } catch (e) {
      setError(errorFrom(e, "Failed to revoke invite."));
      setConfirmRevoke(null);
    } finally {
      setBusyId(null);
    }
  };

  const isPending = (m: StaffMember) =>
    m.status === "INVITE_PENDING" || m.status === "INVITE_EXPIRED";

  return (
    <AdminShell active="staff" title="Staff" allow={["OWNER"]}>
      <div className="space-y-4">
        {error && (
          <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
            <AlertDescription className="text-destructive/90">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-success/30 bg-success/10">
            <AlertDescription className="flex items-center gap-1.5 text-success">
              <CheckIcon className="size-4" />
              {success}
            </AlertDescription>
          </Alert>
        )}

        {/* Invite form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserPlusIcon className="size-4" />
              Invite a team member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitInvite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as InvitableRole)}
                  className={`${selectClass} w-full sm:w-40`}
                >
                  <option value="STAFF">Staff</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <Button type="submit" disabled={inviting}>
                {inviting ? "Sending…" : "Send invite"}
              </Button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">{ROLE_HELP[inviteRole]}.</p>
          </CardContent>
        </Card>

        {/* Members list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Team members ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No team members yet.</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => {
                  const isSelf = m.id === user?.userId;
                  const isOwner = m.role === "OWNER";
                  const badge = STATUS_BADGE[m.status];
                  const busy = busyId === m.id;
                  return (
                    <li
                      key={m.id}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <MailIcon className="size-4 shrink-0 text-muted-foreground" />
                          <p className="truncate font-medium text-foreground">{m.email}</p>
                          {isSelf && <Badge variant="info">You</Badge>}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="secondary">{m.role}</Badge>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                      </div>

                      {/* Actions — never available on the owner row */}
                      {!isOwner && (
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {isPending(m) ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => resendInvite(m)}
                              >
                                <RotateCwIcon className="size-3.5" />
                                {m.status === "INVITE_EXPIRED" ? "Send new link" : "Resend"}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={busy}
                                onClick={() => setConfirmRevoke(m)}
                              >
                                Revoke
                              </Button>
                            </>
                          ) : (
                            <>
                              <select
                                value={m.role}
                                disabled={busy || !m.isActive}
                                onChange={(e) => changeRole(m, e.target.value as InvitableRole)}
                                className={`${selectClass} h-9`}
                                aria-label={`Role for ${m.email}`}
                              >
                                <option value="STAFF">Staff</option>
                                <option value="ADMIN">Admin</option>
                              </select>
                              {m.isActive ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => setActive(m, false)}
                                >
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => setActive(m, true)}
                                >
                                  Reactivate
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revoke confirmation */}
      <Dialog
        open={confirmRevoke !== null}
        onOpenChange={(open: boolean) => { if (!open) setConfirmRevoke(null); }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Revoke invite?</DialogTitle>
            <DialogDescription>
              The invite link for {confirmRevoke?.email} will stop working and the pending account
              will be removed. You can invite them again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRevoke(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busyId === confirmRevoke?.id}
              onClick={() => confirmRevoke && revokeInvite(confirmRevoke)}
            >
              Yes, revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
