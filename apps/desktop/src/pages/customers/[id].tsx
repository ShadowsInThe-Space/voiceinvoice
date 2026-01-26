/**
 * Customer Detail Page
 *
 * Shows and edits customer details with revenue statistics,
 * invoice history, and quick actions.
 *
 * @module pages/customers/[id]
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  FileText,
  TrendingUp,
  Edit3,
  Save,
  X,
  Trash2,
  Plus,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Clock,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Invoice summary data.
 */
interface InvoiceSummary {
  id: string;
  number: string;
  total: number;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
}

/**
 * Customer detail data from API.
 */
interface CustomerDetails {
  id: string;
  customerNumber: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  country: string;
  taxId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  totalRevenue: number;
  invoiceCount: number;
  paidInvoices: number;
  openInvoices: number;
  overdueInvoices: number;
  avgInvoiceValue: number;
  invoices: InvoiceSummary[];
  revenueByMonth: { month: string; revenue: number }[];
}

/**
 * Customer form state.
 */
interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  zipCode: string;
  country: string;
  taxId: string;
  notes: string;
}

/**
 * Customer Detail Page Component.
 */
export default function CustomerDetailPage(): React.ReactElement {
  const router = useRouter();
  const { id } = router.query;

  const [customer, setCustomer] = useState<CustomerDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [form, setForm] = useState<CustomerForm>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    zipCode: '',
    country: 'DE',
    taxId: '',
    notes: '',
  });

  // Fetch customer data
  const fetchCustomer = useCallback(async () => {
    if (!id || typeof id !== 'string') return;

    try {
      setLoading(true);
      const response = await fetch(`/api/customers/${id}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Kunde nicht gefunden');
      }

      setCustomer(result.data);
      setForm({
        name: result.data.name,
        email: result.data.email || '',
        phone: result.data.phone || '',
        address: result.data.address || '',
        city: result.data.city || '',
        zipCode: result.data.zipCode || '',
        country: result.data.country || 'DE',
        taxId: result.data.taxId || '',
        notes: result.data.notes || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustomer();
  }, [fetchCustomer]);

  // Handle form save
  const handleSave = async () => {
    if (!id || typeof id !== 'string') return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Speichern fehlgeschlagen');
      }

      setCustomer(result.data);
      setIsEditing(false);
      setSuccess('Kunde erfolgreich gespeichert');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!id || typeof id !== 'string') return;

    try {
      setSaving(true);
      const response = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Löschen fehlgeschlagen');
      }

      router.push('/customers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
      setShowDeleteConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  // Generate mailto link with customer info
  const getMailtoLink = (invoice?: InvoiceSummary): string => {
    if (!customer?.email) return '#';

    const subject = invoice ? `Rechnung ${invoice.number}` : `Anfrage von ${customer.name}`;

    const body = invoice
      ? `Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die Rechnung ${invoice.number} über ${formatCurrency(invoice.total)}.\n\nMit freundlichen Grüßen`
      : `Sehr geehrte Damen und Herren,\n\n\n\nMit freundlichen Grüßen`;

    return `mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PAID':
        return {
          label: 'Bezahlt',
          color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
          icon: CheckCircle,
        };
      case 'SENT':
        return {
          label: 'Gesendet',
          color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
          icon: Send,
        };
      case 'OVERDUE':
        return {
          label: 'Überfällig',
          color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          icon: AlertCircle,
        };
      case 'DRAFT':
        return {
          label: 'Entwurf',
          color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
          icon: Edit3,
        };
      case 'CANCELLED':
        return {
          label: 'Storniert',
          color: 'bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-500',
          icon: X,
        };
      default:
        return { label: status, color: 'bg-gray-100 text-gray-700', icon: Clock };
    }
  };

  // Cancel editing and reset form
  const handleCancelEdit = () => {
    if (customer) {
      setForm({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        zipCode: customer.zipCode || '',
        country: customer.country || 'DE',
        taxId: customer.taxId || '',
        notes: customer.notes || '',
      });
    }
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Lade Kundendaten...</p>
        </div>
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium text-destructive">{error}</p>
          <Link href="/customers" className="text-primary hover:underline font-medium">
            Zurück zur Übersicht
          </Link>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Calculate max revenue for chart scaling
  const maxRevenue = Math.max(...customer.revenueByMonth.map((m) => m.revenue), 1);

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <Link
        href="/customers"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zur Kundenübersicht
      </Link>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-600 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary text-2xl font-bold">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">
              {customer.customerNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {customer.email && (
            <a
              href={getMailtoLink()}
              className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              <Mail className="h-4 w-4" />
              E-Mail senden
            </a>
          )}
          <Link
            href={`/invoices/new?customerId=${customer.id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Neue Rechnung
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{formatCurrency(customer.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Gesamtumsatz</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{customer.invoiceCount}</p>
              <p className="text-xs text-muted-foreground">Rechnungen</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{customer.paidInvoices}</p>
              <p className="text-xs text-muted-foreground">Bezahlt</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold">{customer.openInvoices}</p>
              <p className="text-xs text-muted-foreground">Offen</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{formatCurrency(customer.avgInvoiceValue)}</p>
              <p className="text-xs text-muted-foreground">Ø Rechnungswert</p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      {customer.revenueByMonth.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold mb-4">Umsatzentwicklung (12 Monate)</h2>
          <div className="flex items-end gap-2 h-40">
            {customer.revenueByMonth.map((month, index) => (
              <div key={index} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className={cn(
                    'w-full rounded-t transition-all',
                    month.revenue > 0 ? 'bg-primary' : 'bg-muted'
                  )}
                  style={{
                    height: `${Math.max((month.revenue / maxRevenue) * 100, 4)}%`,
                    minHeight: '4px',
                  }}
                  title={formatCurrency(month.revenue)}
                />
                <span className="text-xs text-muted-foreground">{month.month}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Customer Details Form */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Kontaktdaten</h2>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <Edit3 className="h-4 w-4" />
                Bearbeiten
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                  disabled={saving}
                >
                  <X className="h-4 w-4" />
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                  disabled={saving}
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Speichert...' : 'Speichern'}
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Firmenname / Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              ) : (
                <p className="text-foreground">{customer.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                E-Mail
              </label>
              {isEditing ? (
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              ) : (
                <p className="text-foreground flex items-center gap-2">
                  {customer.email ? (
                    <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
                      {customer.email}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Telefon
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              ) : (
                <p className="text-foreground">
                  {customer.phone || <span className="text-muted-foreground">—</span>}
                </p>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Adresse
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Straße und Hausnummer"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              ) : (
                <p className="text-foreground">
                  {customer.address || <span className="text-muted-foreground">—</span>}
                </p>
              )}
            </div>

            {/* City and ZIP */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  PLZ
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={form.zipCode}
                    onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                ) : (
                  <p className="text-foreground">
                    {customer.zipCode || <span className="text-muted-foreground">—</span>}
                  </p>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                  Stadt
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                ) : (
                  <p className="text-foreground">
                    {customer.city || <span className="text-muted-foreground">—</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Tax ID */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                USt-IdNr.
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={form.taxId}
                  onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                  placeholder="DE123456789"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              ) : (
                <p className="text-foreground font-mono">
                  {customer.taxId || <span className="text-muted-foreground">—</span>}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                Notizen
              </label>
              {isEditing ? (
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              ) : (
                <p className="text-foreground whitespace-pre-wrap">
                  {customer.notes || <span className="text-muted-foreground">Keine Notizen</span>}
                </p>
              )}
            </div>
          </div>

          {/* Delete Button */}
          {isEditing && (
            <div className="mt-6 pt-6 border-t border-border">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-destructive">Kunde wirklich löschen?</p>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-1.5 text-sm font-medium bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90"
                    disabled={saving}
                  >
                    Ja, löschen
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg"
                    disabled={saving}
                  >
                    Abbrechen
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 text-sm text-destructive hover:text-destructive/80"
                >
                  <Trash2 className="h-4 w-4" />
                  Kunde löschen
                </button>
              )}
            </div>
          )}

          {/* Meta Info */}
          <div className="mt-6 pt-6 border-t border-border text-xs text-muted-foreground">
            <p>Erstellt: {formatDate(customer.createdAt)}</p>
            <p>Aktualisiert: {formatDate(customer.updatedAt)}</p>
          </div>
        </div>

        {/* Invoice History */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Rechnungshistorie</h2>
            <Link
              href={`/invoices/new?customerId=${customer.id}`}
              className="text-sm text-primary hover:underline font-medium"
            >
              Neue Rechnung
            </Link>
          </div>

          {customer.invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground">Noch keine Rechnungen</p>
              <Link
                href={`/invoices/new?customerId=${customer.id}`}
                className="text-primary hover:underline text-sm font-medium mt-2 inline-block"
              >
                Erste Rechnung erstellen
              </Link>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {customer.invoices.map((invoice) => {
                const statusConfig = getStatusConfig(invoice.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={invoice.id}
                    className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/invoices/${invoice.id}`}
                          className="font-medium text-foreground hover:text-primary truncate"
                        >
                          {invoice.number}
                        </Link>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full',
                            statusConfig.color
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {invoice.issuedAt ? formatDate(invoice.issuedAt) : 'Entwurf'}
                        {invoice.dueAt && ` • Fällig: ${formatDate(invoice.dueAt)}`}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{formatCurrency(invoice.total)}</p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/invoices/${invoice.id}`}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                        title="Öffnen"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                      {customer.email && (
                        <a
                          href={getMailtoLink(invoice)}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded"
                          title="Per E-Mail senden"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
