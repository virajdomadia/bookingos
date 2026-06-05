"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
  isStaffService: boolean;
}

type FormMode = "create" | "edit";

const emptyForm = { name: "", durationMinutes: 30, price: 0 };

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
    setForm({ name: service.name, durationMinutes: service.durationMinutes, price: service.price });
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
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (formMode === "create") {
        const res = await api.post("/admin/services", {
          name: form.name.trim(),
          durationMinutes: Number(form.durationMinutes),
          price: Number(form.price),
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
      <div style={s.container}>
        <div style={s.header}>
          <Link href="/admin" style={s.backLink}>← Dashboard</Link>
          <h1 style={s.title}>Services</h1>
        </div>
        <div style={{ textAlign: "center", paddingTop: "4rem", color: "#6b7280" }}>Loading services...</div>
      </div>
    );
  }

  if (!accessToken) return null;

  const activeServices = services.filter((s) => s.isActive);
  const inactiveServices = services.filter((s) => !s.isActive);

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <Link href="/admin" style={s.backLink}>← Dashboard</Link>
          <h1 style={s.title}>Services</h1>
        </div>
        <button onClick={openCreate} style={s.primaryBtn}>+ New Service</button>
      </div>

      <div style={s.content}>
        {error && <div style={s.errorAlert}>{error}</div>}
        {success && <div style={s.successAlert}>{success}</div>}

        {/* Create/Edit Form */}
        {showForm && (
          <div style={s.card}>
            <h2 style={s.cardTitle}>{formMode === "create" ? "New Service" : "Edit Service"}</h2>
            <div style={s.formGrid}>
              <div style={s.fieldGroup}>
                <label style={s.label}>Service Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Haircut, Consultation"
                  style={s.input}
                  autoFocus
                />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Duration (minutes) *</label>
                <input
                  type="number"
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  min={5}
                  max={480}
                  step={5}
                  style={s.input}
                />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Price (₹)</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  min={0}
                  step={0.01}
                  style={s.input}
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button onClick={submitForm} disabled={saving} style={{ ...s.primaryBtn, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving..." : formMode === "create" ? "Create Service" : "Save Changes"}
              </button>
              <button onClick={() => { setShowForm(false); setError(""); }} style={s.cancelBtn}>Cancel</button>
            </div>
          </div>
        )}

        {/* Active Services */}
        <div style={s.card}>
          <h2 style={s.cardTitle}>Active Services ({activeServices.length})</h2>
          {activeServices.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>No active services. Create your first service above.</p>
          ) : (
            <div style={s.serviceList}>
              {activeServices.map((service) => (
                <div key={service.id} style={s.serviceCard}>
                  <div style={s.serviceInfo}>
                    <div style={s.serviceName}>{service.name}</div>
                    <div style={s.serviceMeta}>
                      <span style={s.metaBadge}>{service.durationMinutes} min</span>
                      <span style={s.metaBadge}>₹{service.price.toFixed(0)}</span>
                      {service.isStaffService && <span style={s.staffBadge}>Staff service</span>}
                    </div>
                  </div>
                  <div style={s.serviceActions}>
                    <button onClick={() => openEdit(service)} style={s.editBtn}>Edit</button>
                    <button onClick={() => setConfirmDelete(service.id)} style={s.deactivateBtn}>Deactivate</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inactive Services */}
        {inactiveServices.length > 0 && (
          <div style={s.card}>
            <h2 style={{ ...s.cardTitle, color: "#9ca3af" }}>Inactive Services ({inactiveServices.length})</h2>
            <div style={s.serviceList}>
              {inactiveServices.map((service) => (
                <div key={service.id} style={{ ...s.serviceCard, opacity: 0.6 }}>
                  <div style={s.serviceInfo}>
                    <div style={{ ...s.serviceName, textDecoration: "line-through" }}>{service.name}</div>
                    <div style={s.serviceMeta}>
                      <span style={s.metaBadge}>{service.durationMinutes} min</span>
                      <span style={s.metaBadge}>₹{service.price.toFixed(0)}</span>
                    </div>
                  </div>
                  <div style={s.serviceActions}>
                    <button onClick={() => toggleActive(service)} style={s.editBtn}>Reactivate</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div style={s.modalOverlay}>
          <div style={s.modal}>
            <h3 style={{ marginTop: 0 }}>Deactivate Service?</h3>
            <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
              This service will be hidden from the public booking page. Existing bookings are not affected.
              You can reactivate it later.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={s.cancelBtn}>Cancel</button>
              <button onClick={() => deleteService(confirmDelete)} style={s.dangerBtn}>Yes, Deactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { minHeight: "100vh", backgroundColor: "#f3f4f6", fontFamily: "system-ui, -apple-system, sans-serif" },
  header: { backgroundColor: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", padding: "1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" },
  backLink: { color: "#3b82f6", textDecoration: "none", fontSize: "0.875rem" },
  title: { fontSize: "1.25rem", fontWeight: "bold", margin: 0 },
  content: { padding: "1.5rem", maxWidth: "900px", margin: "0 auto" },
  card: { backgroundColor: "white", padding: "1.5rem", borderRadius: "0.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", marginBottom: "1rem" },
  cardTitle: { fontSize: "1rem", fontWeight: "600", marginTop: 0, marginBottom: "1rem", color: "#111827" },
  formGrid: { display: "flex", gap: "1rem", flexWrap: "wrap" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "0.375rem", flex: 1, minWidth: "160px" },
  label: { fontSize: "0.75rem", fontWeight: "600", color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" },
  input: { padding: "0.5rem 0.75rem", border: "1px solid #d1d5db", borderRadius: "0.375rem", fontSize: "0.875rem", color: "#111827", outline: "none", width: "100%", boxSizing: "border-box" },
  serviceList: { display: "flex", flexDirection: "column", gap: "0.75rem" },
  serviceCard: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", backgroundColor: "#f9fafb", borderRadius: "0.375rem", border: "1px solid #e5e7eb" },
  serviceInfo: { display: "flex", flexDirection: "column", gap: "0.375rem" },
  serviceName: { fontWeight: "600", color: "#111827", fontSize: "0.9375rem" },
  serviceMeta: { display: "flex", gap: "0.5rem", flexWrap: "wrap" },
  metaBadge: { fontSize: "0.75rem", backgroundColor: "#e5e7eb", color: "#374151", padding: "0.125rem 0.5rem", borderRadius: "999px" },
  staffBadge: { fontSize: "0.75rem", backgroundColor: "#ede9fe", color: "#6d28d9", padding: "0.125rem 0.5rem", borderRadius: "999px" },
  serviceActions: { display: "flex", gap: "0.5rem" },
  primaryBtn: { padding: "0.5rem 1.25rem", backgroundColor: "#3b82f6", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" },
  editBtn: { padding: "0.375rem 0.875rem", backgroundColor: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8125rem", fontWeight: "500" },
  deactivateBtn: { padding: "0.375rem 0.875rem", backgroundColor: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.8125rem", fontWeight: "500" },
  cancelBtn: { padding: "0.5rem 1.25rem", backgroundColor: "white", color: "#374151", border: "1px solid #d1d5db", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: "500" },
  dangerBtn: { padding: "0.5rem 1.25rem", backgroundColor: "#ef4444", color: "white", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontSize: "0.875rem", fontWeight: "600" },
  errorAlert: { backgroundColor: "#fee2e2", border: "1px solid #fecaca", color: "#991b1b", padding: "0.875rem 1rem", borderRadius: "0.375rem", marginBottom: "1rem", fontSize: "0.875rem" },
  successAlert: { backgroundColor: "#dcfce7", border: "1px solid #bbf7d0", color: "#166534", padding: "0.875rem 1rem", borderRadius: "0.375rem", marginBottom: "1rem", fontSize: "0.875rem" },
  modalOverlay: { position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 },
  modal: { backgroundColor: "white", borderRadius: "0.5rem", padding: "1.5rem", maxWidth: "400px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
};
