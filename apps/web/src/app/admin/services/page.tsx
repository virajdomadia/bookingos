"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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
  const router = useRouter();
  const { accessToken, isLoading } = useAuth();

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
    if (!isLoading && !accessToken) router.push("/auth");
  }, [accessToken, isLoading, router]);

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

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-border px-6 py-4 flex items-center gap-4">
          <Link href="/admin" className="text-sm text-primary hover:underline">← Dashboard</Link>
          <h1 className="text-xl font-bold text-gray-900">Services</h1>
        </header>
        <div className="flex items-center justify-center pt-16 text-muted-foreground">
          Loading services...
        </div>
      </div>
    );
  }

  if (!accessToken) return null;

  const activeServices = services.filter((s) => s.isActive);
  const inactiveServices = services.filter((s) => !s.isActive);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-border px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm text-primary hover:underline">← Dashboard</Link>
          <h1 className="text-xl font-bold text-gray-900">Services</h1>
        </div>
        <Button onClick={openCreate}>+ New Service</Button>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-200 bg-green-50 text-green-800">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Create / Edit Form */}
        {showForm && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {formMode === "create" ? "New Service" : "Edit Service"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-1">
                  <Label>Service Name *</Label>
                  <Input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Haircut, Consultation"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Duration (minutes) *</Label>
                  <Input
                    type="number"
                    value={form.durationMinutes}
                    onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                    min={5}
                    max={480}
                    step={5}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Price (₹)</Label>
                  <Input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    min={0}
                    step={0.01}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isStaffService}
                  onChange={(e) => setForm({ ...form, isStaffService: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">
                  Staff service (assigned to a specific staff member)
                </span>
              </label>

              <div className="flex gap-2 pt-1">
                <Button onClick={submitForm} disabled={saving}>
                  {saving ? "Saving..." : formMode === "create" ? "Create Service" : "Save Changes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setShowForm(false); setError(""); }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Services */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active Services ({activeServices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {activeServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active services. Create your first service above.
              </p>
            ) : (
              <div className="space-y-2">
                {activeServices.map((service) => (
                  <div
                    key={service.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-border"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900 text-sm">{service.name}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="secondary">{service.durationMinutes} min</Badge>
                        <Badge variant="secondary">₹{service.price.toFixed(0)}</Badge>
                        {service.isStaffService && (
                          <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 border-0">
                            Staff service
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(service)}>
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmDelete(service.id)}
                      >
                        Deactivate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inactive Services */}
        {inactiveServices.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-muted-foreground">
                Inactive Services ({inactiveServices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {inactiveServices.map((service) => (
                  <div
                    key={service.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-border opacity-60"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-900 text-sm line-through">{service.name}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="secondary">{service.durationMinutes} min</Badge>
                        <Badge variant="secondary">₹{service.price.toFixed(0)}</Badge>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => toggleActive(service)}>
                      Reactivate
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Deactivate Confirmation Dialog */}
      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open: boolean) => { if (!open) setConfirmDelete(null); }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Deactivate Service?</DialogTitle>
            <DialogDescription>
              This service will be hidden from the public booking page. Existing bookings are not
              affected. You can reactivate it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete && deleteService(confirmDelete)}
            >
              Yes, Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
