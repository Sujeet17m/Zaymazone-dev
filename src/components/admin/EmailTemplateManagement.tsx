// ── Module 12: Email Template Management Admin UI ────────────────────────────
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Mail, Info, Code2, Eye, CheckCircle2, XCircle } from "lucide-react";
import {
  EMAIL_TEMPLATES,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  LANG_LABELS,
  type EmailTemplateMeta,
  type TemplateCategory,
  type TemplateLang,
} from "@/lib/emailTemplateData";

// ── helpers ──────────────────────────────────────────────────────────────────

// Static map so Tailwind can tree-shake safely
const ACCENT_SWATCH_CLASS: Record<string, string> = {
  '#8B4513': 'bg-[#8B4513]',
  '#27ae60': 'bg-[#27ae60]',
  '#c0392b': 'bg-[#c0392b]',
  '#e67e22': 'bg-[#e67e22]',
  '#6c757d': 'bg-[#6c757d]',
};

const TYPE_COLORS: Record<string, string> = {
  string: "bg-sky-100 text-sky-700",
  number: "bg-violet-100 text-violet-700",
  date:   "bg-orange-100 text-orange-700",
  array:  "bg-pink-100 text-pink-700",
  object: "bg-emerald-100 text-emerald-700",
  url:    "bg-cyan-100 text-cyan-700",
};

function serializeSample(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value, null, 2);
}

// ── Preview pane ──────────────────────────────────────────────────────────────

interface PreviewPaneProps {
  template: EmailTemplateMeta;
  previewMode: "sample" | "keys";
}

function PreviewPane({ template, previewMode }: PreviewPaneProps) {
  const brandColor = template.accentColor;

  // Build a simple branded HTML email replica in the browser
  const buildItemRows = (items: { name?: string; quantity?: number; price?: number }[]) =>
    items
      .map(
        (it) => `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #f0e8d8;">${it.name ?? "—"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0e8d8;text-align:center;">${it.quantity ?? 0}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #f0e8d8;text-align:right;">₹${(it.price ?? 0).toLocaleString("en-IN")}</td>
        </tr>`
      )
      .join("");

  const renderField = (key: string): string => {
    if (previewMode === "keys") return `<span style="background:#fff3cd;padding:2px 6px;border-radius:3px;font-family:monospace;">{{${key}}}</span>`;
    const val = template.samplePayload[key];
    if (val === undefined) return `<em style="color:#aaa;">—</em>`;
    if (Array.isArray(val)) {
      const items = val as { name: string; quantity: number; price: number }[];
      return `<table style="width:100%;border-collapse:collapse;margin:8px 0;">
        <thead><tr style="background:#f8f4ef;">
          <th style="padding:6px 12px;text-align:left;font-size:12px;color:#8B4513;">Product</th>
          <th style="padding:6px 12px;text-align:center;font-size:12px;color:#8B4513;">Qty</th>
          <th style="padding:6px 12px;text-align:right;font-size:12px;color:#8B4513;">Price</th>
        </tr></thead>
        <tbody>${buildItemRows(items)}</tbody>
      </table>`;
    }
    if (typeof val === "object") return `<code style="font-size:11px;background:#f8f4ef;padding:2px 6px;border-radius:3px;">${JSON.stringify(val)}</code>`;
    if (typeof val === "number" && key.toLowerCase().includes("amount")) return `₹${Number(val).toLocaleString("en-IN")}`;
    return String(val);
  };

  const bodyMap: Record<string, string> = {
    order_confirmation: `
      <p>Dear <strong>${renderField("userName")}</strong>,</p>
      <p>Thank you for your order! We've received <strong>${renderField("orderNumber")}</strong> placed on ${renderField("orderDate")}.</p>
      <p><strong>Items Ordered:</strong></p>${renderField("items")}
      <p>Payment method: <strong>${renderField("paymentMethod")}</strong> &nbsp;|&nbsp; Total: <strong>${renderField("totalAmount")}</strong></p>`,
    order_status_update: `
      <p>Dear <strong>${renderField("userName")}</strong>,</p>
      <p>Your order <strong>${renderField("orderNumber")}</strong> status has changed to <strong>${renderField("newStatus")}</strong>.</p>
      ${previewMode === "sample" && template.samplePayload.trackingNumber ? `<p>Tracking: <strong>${renderField("trackingNumber")}</strong> via ${renderField("courierService")}</p>` : `<p>Tracking: ${renderField("trackingNumber")} via ${renderField("courierService")}</p>`}`,
    order_rejection: `
      <p>Dear <strong>${renderField("userName")}</strong>,</p>
      <p>We regret that order <strong>${renderField("orderNumber")}</strong> could not be fulfilled.</p>
      <p>Reason: <em>${renderField("reason")}</em></p>
      <p>A full refund of <strong>${renderField("totalAmount")}</strong> will be processed within 5–7 business days.</p>`,
    payment_confirmation: `
      <p>Dear <strong>${renderField("userName")}</strong>,</p>
      <p>Payment of <strong>${renderField("amount")}</strong> for order <strong>${renderField("orderNumber")}</strong> was received on ${renderField("paymentDate")}.</p>
      <p>Reference: <code>${renderField("paymentId")}</code></p>`,
    refund_notification: `
      <p>Dear <strong>${renderField("userName")}</strong>,</p>
      <p>A refund of <strong>${renderField("refundAmount")}</strong> for order <strong>${renderField("orderNumber")}</strong> was initiated on ${renderField("refundDate")}.</p>
      <p>Reference: <code>${renderField("refundId")}</code></p>`,
    artisan_onboarding_submitted: `
      <p>Dear <strong>${renderField("artisanName")}</strong>,</p>
      <p>We've received the seller application for <strong>${renderField("businessName")}</strong>. Our team will review it within 3–5 business days.</p>`,
    artisan_approved: `
      <p>Dear <strong>${renderField("artisanName")}</strong>,</p>
      <p>Congratulations! <strong>${renderField("businessName")}</strong> has been approved on Zaymazone.</p>
      <p>You can start managing your products from your <a href="${previewMode === "sample" ? template.samplePayload.dashboardUrl : "{{dashboardUrl}}"}" style="color:${brandColor};">Artisan Dashboard</a>.</p>`,
    artisan_rejected: `
      <p>Dear <strong>${renderField("artisanName")}</strong>,</p>
      <p>After reviewing the application for <strong>${renderField("businessName")}</strong>, we are unable to approve it at this time.</p>
      <p>Reason: <em>${renderField("reason")}</em></p>`,
    artisan_verification_success: `
      <p>Dear <strong>${renderField("artisanName")}</strong>,</p>
      <p><strong>${renderField("businessName")}</strong> has been awarded the <strong>Verified Artisan Badge</strong> (Tier: ${renderField("tier")}) with a score of ${renderField("verificationScore")}/100.</p>
      <p>Documents verified: ${renderField("documentsVerified")}</p>`,
    new_order_artisan: `
      <p>Dear <strong>${renderField("artisanName")}</strong>,</p>
      <p>You have a new order <strong>${renderField("orderNumber")}</strong> from ${renderField("buyerName")} (${renderField("buyerCity")}, ${renderField("buyerState")}).</p>${renderField("items")}
      <p>Order total: <strong>${renderField("orderTotal")}</strong></p>`,
    order_cancelled_artisan: `
      <p>Dear <strong>${renderField("artisanName")}</strong>,</p>
      <p>Order <strong>${renderField("orderNumber")}</strong> has been cancelled by <strong>${renderField("cancelledBy")}</strong>.</p>
      <p>Reason: <em>${renderField("cancellationReason")}</em></p>
      <p>Refundable amount: <strong>${renderField("refundableAmount")}</strong></p>`,
    order_return_artisan: `
      <p>Dear <strong>${renderField("artisanName")}</strong>,</p>
      <p>A return has been requested for order <strong>${renderField("orderNumber")}</strong> by ${renderField("buyerName")}.</p>
      <p>Return reason: <em>${renderField("returnReason")}</em></p>`,
    welcome_user: `
      <p>Dear <strong>${renderField("userName")}</strong>,</p>
      <p>Welcome to <strong>Zaymazone</strong> — India's curated marketplace for authentic handcrafted goods.</p>
      <p>Explore thousands of unique products made by verified artisans across India.</p>`,
    verification_email: `
      <p>Dear <strong>${renderField("userName")}</strong>,</p>
      <p>Please verify your email address by clicking the button below. This link expires in ${renderField("expiresInHours")} hours.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${previewMode === "sample" ? template.samplePayload.verificationUrl : "{{verificationUrl}}"}"
           style="background:${brandColor};color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;">Verify Email</a>
      </div>`,
    admin_order_alert: `
      <p>🚨 <strong>Alert Type:</strong> ${renderField("alertType")}</p>
      <p><strong>Order:</strong> ${renderField("orderNumber")} &nbsp;|&nbsp; <strong>Total:</strong> ${renderField("totalAmount")}</p>
      <p><strong>Buyer:</strong> ${renderField("buyerEmail")} &nbsp;|&nbsp; <strong>Artisan:</strong> ${renderField("artisanName")}</p>
      <p><strong>Details:</strong> ${renderField("details")}</p>`,
  };

  const body = bodyMap[template.id] ?? `<p>Preview not available for this template.</p>`;

  const html = `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;border:1px solid #e8d5b0;border-radius:8px;overflow:hidden;">
      <div style="background:${brandColor};padding:24px 32px;">
        <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;letter-spacing:.5px;">Zaymazone</h1>
        <p style="color:rgba(255,255,255,.85);margin:4px 0 0;font-size:13px;">Handcrafted with Love — India's Artisan Marketplace</p>
      </div>
      <div style="padding:28px 32px;background:#ffffff;line-height:1.7;color:#3d2b1f;font-size:14px;">
        ${body}
        <hr style="border:none;border-top:1px solid #f0e8d8;margin:24px 0;"/>
        <p style="font-size:12px;color:#9e8a7a;margin:0;">© 2026 Zaymazone. Celebrating Indian artisanship. 
           <a href="https://zaymazone.com" style="color:${brandColor};">zaymazone.com</a></p>
      </div>
    </div>`;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 overflow-auto max-h-[520px]">
      <div
        className="scale-90 origin-top-left w-[111%]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

// ── Placeholder table ─────────────────────────────────────────────────────────

function PlaceholdersTab({ template }: { template: EmailTemplateMeta }) {
  return (
    <div className="overflow-auto max-h-[520px]">
      <Table>
        <TableHeader>
          <TableRow className="bg-amber-50">
            <TableHead className="font-semibold text-amber-900 w-40">Key</TableHead>
            <TableHead className="font-semibold text-amber-900 w-20">Type</TableHead>
            <TableHead className="font-semibold text-amber-900 w-16">Req</TableHead>
            <TableHead className="font-semibold text-amber-900">Description</TableHead>
            <TableHead className="font-semibold text-amber-900 w-48">Sample Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {template.placeholders.map((field) => (
            <TableRow key={field.key} className="hover:bg-amber-50/50">
              <TableCell>
                <code className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded text-xs font-mono">
                  {`{{${field.key}}}`}
                </code>
              </TableCell>
              <TableCell>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${TYPE_COLORS[field.type] ?? ""}`}>
                  {field.type}
                </span>
              </TableCell>
              <TableCell>
                {field.required ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-slate-300" />
                )}
              </TableCell>
              <TableCell className="text-sm text-slate-600">{field.description}</TableCell>
              <TableCell>
                <pre className="text-xs bg-slate-50 rounded p-1 whitespace-pre-wrap font-mono max-w-[180px] overflow-auto">
                  {serializeSample(field.sample)}
                </pre>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Info tab ──────────────────────────────────────────────────────────────────

interface InfoTabProps {
  template: EmailTemplateMeta;
  lang: TemplateLang;
}

function InfoTab({ template, lang }: InfoTabProps) {
  const t = template.i18n[lang];
  return (
    <div className="space-y-4 max-h-[520px] overflow-auto pr-1">
      <Card className="border-amber-200">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{template.icon}</span>
            <div>
              <p className="font-semibold text-amber-900 text-lg">{t.name}</p>
              <p className="text-sm text-slate-500">{t.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="border-amber-100">
          <CardContent className="p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</p>
            <Badge variant="outline" className={CATEGORY_COLORS[template.category]}>
              {CATEGORY_LABELS[template.category]}
            </Badge>
          </CardContent>
        </Card>
        <Card className="border-amber-100">
          <CardContent className="p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accent Color</p>
            <div className="flex items-center gap-2">
              <div className={`h-5 w-5 rounded-full border border-slate-200 ${ACCENT_SWATCH_CLASS[template.accentColor] ?? ''}`} />
              <code className="text-xs font-mono text-slate-600">{template.accentColor}</code>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-100">
        <CardContent className="p-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject Line Pattern</p>
          <p className="text-sm font-mono bg-amber-50 rounded px-2 py-1">{t.subjectPattern}</p>
        </CardContent>
      </Card>

      <Card className="border-amber-100">
        <CardContent className="p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Placeholder Summary</p>
          <div className="flex flex-wrap gap-1.5">
            {template.placeholders.map((f) => (
              <span
                key={f.key}
                className={`text-xs px-2 py-0.5 rounded-full font-mono border ${
                  f.required ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-slate-100 text-slate-500 border-slate-200"
                }`}
              >
                {`{{${f.key}}}`}
                {!f.required && <span className="ml-1 opacity-60">?</span>}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">required</span>{" "}
            vs <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">optional ?</span>
          </p>
        </CardContent>
      </Card>

      <Card className="border-amber-100">
        <CardHeader className="p-3 pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">i18n Availability</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-1">
          {(Object.keys(LANG_LABELS) as TemplateLang[]).map((l) => (
            <div key={l} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              <span>{LANG_LABELS[l]}</span>
              {l === lang && <Badge variant="outline" className="text-[10px] px-1.5 py-0">active</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const CATEGORIES: Array<{ value: TemplateCategory | "all"; label: string }> = [
  { value: "all",     label: "All Templates" },
  { value: "order",   label: "Order" },
  { value: "artisan", label: "Artisan" },
  { value: "user",    label: "User" },
  { value: "admin",   label: "Admin" },
];

export function EmailTemplateManagement() {
  const [selectedId, setSelectedId]     = useState<string>(EMAIL_TEMPLATES[0].id);
  const [category, setCategory]         = useState<TemplateCategory | "all">("all");
  const [search, setSearch]             = useState("");
  const [lang, setLang]                 = useState<TemplateLang>("en");
  const [previewMode, setPreviewMode]   = useState<"sample" | "keys">("sample");
  const [activeTab, setActiveTab]       = useState<"preview" | "placeholders" | "info">("preview");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return EMAIL_TEMPLATES.filter((t) => {
      const matchCat = category === "all" || t.category === category;
      const matchSearch =
        !q ||
        t.id.includes(q) ||
        t.i18n.en.name.toLowerCase().includes(q) ||
        t.i18n.hi.name.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [category, search]);

  const selected = EMAIL_TEMPLATES.find((t) => t.id === selectedId) ?? EMAIL_TEMPLATES[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-amber-900 flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Email Templates
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Catalog of all {EMAIL_TEMPLATES.length} transactional email templates used in Zaymazone
          </p>
        </div>

        {/* Language toggle */}
        <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-lg p-1">
          {(Object.keys(LANG_LABELS) as TemplateLang[]).map((l) => (
            <Button
              key={l}
              variant={lang === l ? "default" : "ghost"}
              size="sm"
              className={
                lang === l
                  ? "bg-amber-800 text-white hover:bg-amber-900 h-7 text-xs"
                  : "text-amber-800 hover:bg-amber-100 h-7 text-xs"
              }
              onClick={() => setLang(l)}
            >
              {LANG_LABELS[l]}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 min-h-[600px]">
        {/* LEFT: Template list */}
        <div className="col-span-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 border-amber-200 focus-visible:ring-amber-400"
            />
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                  category === c.value
                    ? "bg-amber-800 text-white border-amber-800"
                    : "bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:text-amber-800"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="space-y-1 max-h-[520px] overflow-auto pr-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No templates match your filter.</p>
            )}
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all group ${
                  selectedId === t.id
                    ? "border-amber-400 bg-amber-50 shadow-sm"
                    : "border-transparent hover:border-amber-200 hover:bg-amber-50/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-amber-900 truncate">{t.i18n[lang].name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 border ${CATEGORY_COLORS[t.category]}`}
                      >
                        {t.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {t.placeholders.length} fields
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Detail panel */}
        <div className="col-span-8">
          <Card className="border-amber-200 h-full">
            <CardHeader className="pb-2 border-b border-amber-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{selected.icon}</span>
                  <div>
                    <CardTitle className="text-lg text-amber-900">
                      {selected.i18n[lang].name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{selected.id}</p>
                  </div>
                </div>

                {/* Preview mode toggle (only visible on Preview tab) */}
                {activeTab === "preview" && (
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    <button
                      onClick={() => setPreviewMode("sample")}
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium ${
                        previewMode === "sample" ? "bg-white shadow-sm text-amber-900" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Sample Data
                    </button>
                    <button
                      onClick={() => setPreviewMode("keys")}
                      className={`text-xs px-2.5 py-1 rounded-md transition-colors font-medium flex items-center gap-1 ${
                        previewMode === "keys" ? "bg-white shadow-sm text-amber-900" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      <Code2 className="h-3 w-3" />
                      Placeholder Keys
                    </button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                <TabsList className="bg-amber-50 border border-amber-200 mb-4 h-9">
                  <TabsTrigger value="preview" className="text-xs data-[state=active]:bg-amber-800 data-[state=active]:text-white gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </TabsTrigger>
                  <TabsTrigger value="placeholders" className="text-xs data-[state=active]:bg-amber-800 data-[state=active]:text-white gap-1.5">
                    <Code2 className="h-3.5 w-3.5" />
                    Placeholders
                  </TabsTrigger>
                  <TabsTrigger value="info" className="text-xs data-[state=active]:bg-amber-800 data-[state=active]:text-white gap-1.5">
                    <Info className="h-3.5 w-3.5" />
                    Info
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="mt-0">
                  <PreviewPane template={selected} previewMode={previewMode} />
                </TabsContent>

                <TabsContent value="placeholders" className="mt-0">
                  <PlaceholdersTab template={selected} />
                </TabsContent>

                <TabsContent value="info" className="mt-0">
                  <InfoTab template={selected} lang={lang} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
