"use client";

import { useEffect, useState } from "react";
import { PlusIcon, PencilIcon, ClockIcon, CheckIcon } from "lucide-react";
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

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  isStaffService: boolean;
}

type FormMode = "create" | "edit";
const emptyForm = { name: "", durationMinutes: 30, price: 0, isStaffService: false };

export default function ServicesPage() {
  const { accessToken } = useAuth();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    loadServices();
  }, [accessToken]);

  const loadServices = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/services");
      setServices(res.data.data);
    } catch {
      setError("Failed to load services.");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setFormMode("create");
    setEditingId(null);
    setShowForm(true);
    setError("");
  };

  const openEdit = (service: Service) => {
    setForm({ name: service.name, durationMinutes: service.durationMinutes, price: service.price, isStaffService: service.isStaffService });
    setFormMode("edit");
    setEditingId(service.id);
    setShowForm(true);
    setError("");
  };

  const validateForm = (): string | null => {
    if (!form.name.trim()) return "Service name is required.";
    if (form.name.length > 100) return "Name must be under 100 characters.";
    if (form.durationMinutes < 5 || form.durationMinutes > 480) return "Duration must be 5–480 minutes.";
    if (form.price < 0) return "Price cannot be negative.";
    return null;
  };

  const submitForm = async () => {
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    setError("");
    try {
      if (formMode === "create") {
        const res = await api.post("/admin/services", {
          name: form.name.trim(),
          durationMinutes: Number(form.durationMinutes),
          price: Number(form.price),
          isStaffService: form.isStaffService,
        });
        setServices((prev) => [res.data.data, ...prev]);
        setSuccess("Service created.");
      } else {
        const res = await api.put(`/admin/services/${editingId}`, {
          name: form.name.trim(),
          durationMinutes: Number(form.durationMinutes),
          price: Number(form.price),
        });
        setServices((prev) => prev.map((s) => (s.id === editingId ? res.data.data : s)));
        setSuccess("Service updated.");
      }
      setShowForm(false);
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to save service. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (service: Service) => {
    try {
      const res = await api.put(`/admin/services/${service.id}`, { isActive: !service.isActive });
      setServices((prev) => prev.map((s) => (s.id === service.id ? res.data.data : s)));
    } catch {
      setError("Failed to update service status.");
    }
  };

  const deleteService = async (id: string) => {
    try {
      await api.delete(`/admin/services/${id}`);
      setServices((prev) => prev.map((s) => (s.id === id ? { ...s, isActive: false } : s)));
      setConfirmDelete(null);
      setSuccess("Service deactivated.");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Failed to deactivate service.");
      setConfirmDelete(null);
    }
  };

  const activeServices = services.filter((s) => s.isActive);
  const inactiveServices = services.filter((s) => !s.isActive);

  return (
    <AdminShell
      active="services"
      title="Services"
      actions={
        <Button onClick={openCreate}>
          <PlusIcon className="size-4" />
          New service
        </Button>
      }
    >
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

        {/* Create / Edit form */}
        {showForm && (
          <Card className="animate-fade-in-up">
            <CardHeader>
              <CardTitle>{formMode === "create" ? "New service" : "Edit service"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="svc-name">Service name *</Label>
                  <Input
                    id="svc-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Haircut, Consultation"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="svc-duration">Duration (minutes) *</Label>
                  <Input
                    id="svc-duration"
                    type="number"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                    min={5}
                    max={480}
                    step={5}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="svc-price">Price (₹)</Label>
                  <Input
                    id="svc-price"
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    min={0}
                    step={0.01}
                  />
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isStaffService}
                  onChange={(e) => setForm({ ...form, isStaffService: e.target.checked })}
                  className="size-4 rounded border-border accent-primary"
                />
                <span className="text-sm text-foreground">
                  Staff service (assigned to a specific staff member)
                </span>
              </label>

              <div className="flex gap-2 pt-1">
                <Button onClick={submitForm} disabled={saving}>
                  {saving ? "Saving…" : formMode === "create" ? "Create service" : "Save changes"}
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setError(""); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active services */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active services ({activeServices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : activeServices.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No active services yet. Create your first one.
              </p>
            ) : (
              <ul className="space-y-2">
                {activeServices.map((service) => (
                  <li
                    key={service.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <p className="truncate font-medium text-foreground">{service.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="gap-1">
                          <ClockIcon className="size-3" />
                          {service.durationMinutes} min
                        </Badge>
                        <Badge variant="secondary">₹{service.price.toFixed(0)}</Badge>
                        {service.isStaffService && <Badge variant="info">Staff service</Badge>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(service)}>
                        <PencilIcon className="size-3.5" />
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(service.id)}>
                        Deactivate
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Inactive services */}
        {inactiveServices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base text-muted-foreground">
                Inactive services ({inactiveServices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {inactiveServices.map((service) => (
                  <li
                    key={service.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <p className="truncate font-medium text-muted-foreground line-through">{service.name}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{service.durationMinutes} min</Badge>
                        <Badge variant="secondary">₹{service.price.toFixed(0)}</Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => toggleActive(service)}>
                      Reactivate
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Deactivate confirmation */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open: boolean) => { if (!open) setConfirmDelete(null); }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Deactivate service?</DialogTitle>
            <DialogDescription>
              This service will be hidden from the public booking page. Existing bookings are not
              affected. You can reactivate it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirmDelete && deleteService(confirmDelete)}>
              Yes, deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
