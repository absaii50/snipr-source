"use client";
import { useState, type ReactNode } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plug, Trash2, Pencil, FlaskConical, CheckCircle2, XCircle, ChevronRight } from "lucide-react";

interface Integration {
  id: string;
  type: string;
  name: string;
  config: Record<string, string>;
  enabled: boolean;
  createdAt: string;
}

/* ── Official brand SVG logos ─────────────────────────────────────────── */

function SlackLogo() {
  return (
    <svg viewBox="0 0 270 270" className="w-7 h-7" xmlns="http://www.w3.org/2000/svg">
      <path fill="#36C5F0" d="M99.4 151.2c0 7.1-5.8 12.9-12.9 12.9-7.1 0-12.9-5.8-12.9-12.9 0-7.1 5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9v-32.3z"/>
      <path fill="#2EB67D" d="M118.8 99.4c-7.1 0-12.9-5.8-12.9-12.9 0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v12.9h-12.9zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H86.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3z"/>
      <path fill="#ECB22E" d="M170.6 118.8c0-7.1 5.8-12.9 12.9-12.9 7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9h-12.9v-12.9zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V86.5c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3z"/>
      <path fill="#E01E5A" d="M151.2 170.6c7.1 0 12.9 5.8 12.9 12.9 0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9v-12.9h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H151.2z"/>
    </svg>
  );
}

function ZapierLogo() {
  return (
    <svg viewBox="0 0 100 100" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
      <path fill="white" d="M64.8 40.3H47.2l15.3-16.8c.7-.8.7-2-.1-2.7L56 14.6c-.8-.7-2-.7-2.7.1L36.4 33.2c-.4.4-.6 1-.5 1.5.1.6.5 1 1 1.3l3.7 1.8H22.8c-1.1 0-2 .9-2 2v8.4c0 1.1.9 2 2 2h17.6L25.1 67c-.7.8-.7 2 .1 2.7l6.4 6.2c.8.7 2 .7 2.7-.1L51.2 57c.4-.4.6-1 .5-1.5-.1-.6-.5-1-1-1.3l-3.7-1.8h17.8c1.1 0 2-.9 2-2v-8.4c0-1-.9-1.7-2-1.7z"/>
    </svg>
  );
}

function GA4Logo() {
  return (
    <svg viewBox="0 0 192 192" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
      <path fill="white" d="M130 45v114c0 9 6 15 14 15s14-6 14-15V46c0-9-6-15-14-15s-14 6-14 14z"/>
      <path fill="white" opacity=".8" d="M79 96v63c0 9 6 15 14 15s14-6 14-15V97c0-9-6-15-14-15s-14 6-14 14z"/>
      <circle fill="white" opacity=".8" cx="44" cy="159" r="18"/>
    </svg>
  );
}

function WebhookLogo() {
  return (
    <svg viewBox="0 0 100 100" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
      <path fill="white" d="M42 16 L26 52 H44 L30 84 L74 40 H56 L72 16 Z"/>
    </svg>
  );
}

function SegmentLogo() {
  return (
    <svg viewBox="0 0 100 100" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
      <g fill="white">
        <rect x="20" y="44" width="60" height="9" rx="4.5"/>
        <rect x="20" y="25" width="40" height="9" rx="4.5"/>
        <rect x="20" y="63" width="50" height="9" rx="4.5"/>
      </g>
    </svg>
  );
}

const INTEGRATION_LOGOS: Record<string, ReactNode> = {
  slack:   <SlackLogo />,
  zapier:  <ZapierLogo />,
  ga4:     <GA4Logo />,
  webhook: <WebhookLogo />,
  segment: <SegmentLogo />,
};

const INTEGRATION_BG: Record<string, { bg: string; className?: string }> = {
  slack:   { bg: "#FFFFFF", className: "border border-[rgba(226,232,240,0.6)]" },
  zapier:  { bg: "#FF4A00" },
  ga4:     { bg: "#E8710A" },
  webhook: { bg: "#728DA7" },
  segment: { bg: "#52BD95" },
};

const INTEGRATION_META: Record<string, {
  label: string;
  description: string;
  docsUrl: string;
  color: string;
  initial: string;
  fields: { key: string; label: string; placeholder: string; type?: string; hint?: string }[];
}> = {
  slack: {
    label: "Slack",
    color: "bg-[#4A154B]",
    initial: "S",
    description: "Send click notifications to your Slack channels instantly.",
    docsUrl: "https://api.slack.com/messaging/webhooks",
    fields: [
      { key: "webhookUrl", label: "Incoming Webhook URL", placeholder: "https://hooks.slack.com/services/...", hint: "Create an Incoming Webhook in your Slack workspace settings" },
    ],
  },
  zapier: {
    label: "Zapier",
    color: "bg-[#FF4A00]",
    initial: "Z",
    description: "Trigger Zapier workflows on every link click — connect to 5,000+ apps.",
    docsUrl: "https://zapier.com/apps/webhook/integrations",
    fields: [
      { key: "webhookUrl", label: "Zapier Webhook URL", placeholder: "https://hooks.zapier.com/hooks/catch/...", hint: 'Use "Webhooks by Zapier" as the trigger in your Zap' },
    ],
  },
  ga4: {
    label: "Google Analytics",
    color: "bg-[#E8710A]",
    initial: "G",
    description: "Send click events to GA4 via Measurement Protocol — including UTM data.",
    docsUrl: "https://developers.google.com/analytics/devguides/collection/protocol/ga4",
    fields: [
      { key: "measurementId", label: "Measurement ID", placeholder: "G-XXXXXXXXXX", hint: "Found in your GA4 Property → Data Streams → Measurement ID" },
      { key: "apiSecret", label: "API Secret", placeholder: "your-api-secret", hint: "Found in GA4 → Data Streams → Measurement Protocol API secrets" },
    ],
  },
  webhook: {
    label: "Custom Webhook",
    color: "bg-[#728DA7]",
    initial: "W",
    description: "Fire a signed HTTP POST to any endpoint on every link click.",
    docsUrl: "https://docs.snipr.sh/webhooks",
    fields: [
      { key: "webhookUrl", label: "Webhook URL", placeholder: "https://your-server.com/snipr-events", hint: "Must respond with 2xx status code" },
      { key: "secret", label: "Signing Secret (optional)", placeholder: "your-secret", hint: "Used to sign payloads with HMAC-SHA256 in the X-Snipr-Signature header", type: "password" },
    ],
  },
  segment: {
    label: "Segment",
    color: "bg-[#52BD95]",
    initial: "S",
    description: "Send Snipr click events to Segment and route them to any downstream tool.",
    docsUrl: "https://segment.com/docs/connections/sources/catalog/libraries/server/http-api/",
    fields: [
      { key: "writeKey", label: "Write Key", placeholder: "your-segment-write-key", hint: "Found in Segment → Sources → your HTTP API source → Settings → API Keys", type: "password" },
    ],
  },
};

const ALL_TYPES = Object.keys(INTEGRATION_META);

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api${path}`, { credentials: "include", ...init });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

/* ── Shared glassmorphism style tokens ──────────────────────────────── */

const glassCard = {
  background: "rgba(17,24,39,0.65)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.06)",
  boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
  borderRadius: "20px",
};

const primaryGradientBtn = {
  background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
  boxShadow: "0 4px 14px rgba(79,70,229,0.25)",
  borderRadius: "14px",
  color: "#fff",
  border: "none",
};

export default function Integrations() {
  const qc = useQueryClient();
  const [configuring, setConfiguring] = useState<{ type: string; existing?: Integration } | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; message: string } | null>(null);
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [formName, setFormName] = useState("");

  const { data: integrations = [], isLoading } = useQuery<Integration[]>({
    queryKey: ["integrations"],
    queryFn: () => apiFetch("/integrations"),
  });

  const createMutation = useMutation({
    mutationFn: (body: { type: string; name: string; config: Record<string, string> }) =>
      apiFetch("/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["integrations"] }); setConfiguring(null); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; config?: Record<string, string>; enabled?: boolean }) =>
      apiFetch(`/integrations/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/integrations/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integrations"] }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/integrations/${id}/test`, { method: "POST" }),
    onSuccess: (_, id) => setTestResult({ id, ok: true, message: "Test event sent successfully" }),
    onError: (err: Error, id) => setTestResult({ id, ok: false, message: err.message }),
  });

  function openCreate(type: string) {
    setFormState({});
    setFormName(INTEGRATION_META[type].label);
    setConfiguring({ type });
  }

  function openEdit(integration: Integration) {
    setFormState({ ...integration.config });
    setFormName(integration.name);
    setConfiguring({ type: integration.type, existing: integration });
  }

  function handleSave() {
    if (!configuring) return;
    if (configuring.existing) {
      updateMutation.mutate({ id: configuring.existing.id, name: formName, config: formState });
      setConfiguring(null);
    } else {
      createMutation.mutate({ type: configuring.type, name: formName, config: formState });
    }
  }

  const connectedByType = ALL_TYPES.reduce<Record<string, Integration[]>>((acc, t) => {
    acc[t] = integrations.filter(i => i.type === t);
    return acc;
  }, {});

  return (
    <ProtectedLayout>
      <div className="px-4 sm:px-7 py-6 sm:py-7 max-w-4xl mx-auto w-full space-y-5 pt-14 lg:pt-6">

          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
              >
                <Plug className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-[family-name:var(--font-space-grotesk)] text-[28px] font-bold text-[#F1F5F9]">
                  Integrations
                </h1>
              </div>
            </div>
            <p className="text-[15px] text-[#94A3B8] leading-[1.75]">
              Send click events from Snipr to Slack, Zapier, Google Analytics, and more in real time.
            </p>
          </div>

          {/* Integration Cards */}
          <div className="space-y-4">
            {ALL_TYPES.map((type) => {
              const meta = INTEGRATION_META[type];
              const connected = connectedByType[type] ?? [];
              const hasConnected = connected.length > 0;
              const iconBg = INTEGRATION_BG[type];

              return (
                <div key={type} className="overflow-hidden" style={glassCard}>
                  {/* Card header */}
                  <div className="flex items-center gap-4 p-5" style={{ borderBottom: "1px solid rgba(226,232,240,0.3)" }}>
                    <div
                      className={`w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 overflow-hidden ${iconBg.className ?? ""}`}
                      style={{
                        backgroundColor: iconBg.bg,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      }}
                    >
                      {INTEGRATION_LOGOS[type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-[#F1F5F9] text-[15px]">{meta.label}</span>
                        {hasConnected && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{
                              color: "#10B981",
                              background: "rgba(16,185,129,0.1)",
                              border: "1px solid rgba(16,185,129,0.2)",
                            }}
                          >
                            <CheckCircle2 className="w-3 h-3" /> {connected.length} connected
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-[#64748B] mt-0.5">{meta.description}</p>
                    </div>
                    {hasConnected ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-[14px] text-[13px] h-8 px-4 flex-shrink-0 text-[#64748B] hover:text-[#F1F5F9]"
                        style={{
                          borderRadius: "14px",
                          border: "1px solid rgba(226,232,240,0.6)",
                        }}
                        onClick={() => openCreate(type)}
                      >
                        Add another
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    ) : (
                      <button
                        className="text-[13px] h-8 px-4 flex-shrink-0 font-medium flex items-center gap-1 cursor-pointer transition-all hover:opacity-90"
                        style={primaryGradientBtn}
                        onClick={() => openCreate(type)}
                      >
                        Connect
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </button>
                    )}
                  </div>

                  {/* Connected instances */}
                  {connected.length > 0 && (
                    <div style={{ borderTop: "none" }}>
                      {connected.map((int, idx) => (
                        <div
                          key={int.id}
                          className="flex items-center gap-3 px-5 py-3.5 transition-colors"
                          style={{
                            borderTop: idx > 0 ? "1px solid rgba(226,232,240,0.3)" : "none",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(248,250,252,0.6)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-[13px] font-semibold text-[#F1F5F9]">{int.name}</span>
                            {int.config.webhookUrl && (
                              <span className="block text-[11px] text-[#94A3B8] truncate max-w-xs mt-0.5">{int.config.webhookUrl}</span>
                            )}
                            {int.config.measurementId && (
                              <span className="block text-[11px] text-[#94A3B8] mt-0.5">{int.config.measurementId}</span>
                            )}
                          </div>

                          {/* Test result */}
                          {testResult?.id === int.id && (
                            <span className={`text-[12px] font-medium flex items-center gap-1 ${testResult.ok ? "text-emerald-600" : "text-red-500"}`}>
                              {testResult.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                              {testResult.ok ? "Sent!" : testResult.message}
                            </span>
                          )}

                          {/* Enable toggle */}
                          <Switch
                            checked={int.enabled}
                            onCheckedChange={(enabled) => updateMutation.mutate({ id: int.id, enabled })}
                            className="rounded-full"
                          />

                          {/* Actions */}
                          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-[14px]" onClick={() => openEdit(int)} title="Edit">
                            <Pencil className="w-3.5 h-3.5 text-[#94A3B8]" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-[14px] text-[12px] text-[#94A3B8] px-2.5"
                            onClick={() => { setTestResult(null); testMutation.mutate(int.id); }}
                            disabled={testMutation.isPending}
                          >
                            <FlaskConical className="w-3.5 h-3.5 mr-1" />
                            Test
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-[14px] hover:bg-[rgba(239,68,68,0.08)] hover:text-[#EF4444]"
                            onClick={() => deleteMutation.mutate(int.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {!isLoading && integrations.length === 0 && (
            <div className="mt-8 p-10 text-center" style={glassCard}>
              <Plug className="w-8 h-8 text-[#94A3B8] mx-auto mb-3" />
              <h3 className="font-[family-name:var(--font-space-grotesk)] font-bold text-[#F1F5F9] text-lg mb-1">No integrations yet</h3>
              <p className="text-[14px] text-[#64748B]">Connect a tool above to start receiving click events in real time.</p>
            </div>
          )}
        </div>

      {/* Configure dialog */}
      {configuring && (
        <Dialog open onOpenChange={() => setConfiguring(null)}>
          <DialogContent
            className="sm:max-w-md"
            style={{
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.9)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,1)",
              borderRadius: "20px",
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-[#F1F5F9]">
                <div className={`w-8 h-8 rounded-[14px] ${INTEGRATION_META[configuring.type].color} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                  {INTEGRATION_META[configuring.type].initial}
                </div>
                {configuring.existing ? `Edit ${INTEGRATION_META[configuring.type].label}` : `Connect ${INTEGRATION_META[configuring.type].label}`}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Name field */}
              <div>
                <Label className="text-[13px] font-semibold text-[#F1F5F9] mb-1.5 block">Name</Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={`e.g. ${INTEGRATION_META[configuring.type].label} – Marketing`}
                  className="h-9 text-sm rounded-[14px] focus:ring-[#4F46E5] focus:border-[#4F46E5]"
                  style={{
                    borderRadius: "14px",
                    border: "1px solid rgba(226,232,240,0.6)",
                  }}
                />
              </div>

              {/* Type-specific fields */}
              {INTEGRATION_META[configuring.type].fields.map((field) => (
                <div key={field.key}>
                  <Label className="text-[13px] font-semibold text-[#F1F5F9] mb-1.5 block">{field.label}</Label>
                  <Input
                    type={field.type ?? "text"}
                    value={formState[field.key] ?? ""}
                    onChange={(e) => setFormState((s) => ({ ...s, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="h-9 text-sm font-mono rounded-[14px] focus:ring-[#4F46E5] focus:border-[#4F46E5]"
                    style={{
                      borderRadius: "14px",
                      border: "1px solid rgba(226,232,240,0.6)",
                    }}
                  />
                  {field.hint && <p className="text-[11px] text-[#94A3B8] mt-1.5">{field.hint}</p>}
                </div>
              ))}

              {/* Docs link */}
              <p className="text-[12px] text-[#94A3B8]">
                Need help?{" "}
                <a href={INTEGRATION_META[configuring.type].docsUrl} target="_blank" rel="noopener noreferrer" className="text-[#6366F1] underline underline-offset-2">
                  View setup guide
                </a>
              </p>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-9 text-sm text-[#64748B] hover:text-[#F1F5F9]"
                  style={{
                    borderRadius: "14px",
                    border: "1px solid rgba(226,232,240,0.6)",
                  }}
                  onClick={() => setConfiguring(null)}
                >
                  Cancel
                </Button>
                <button
                  className="flex-1 h-9 text-sm font-medium cursor-pointer transition-all hover:opacity-90 disabled:opacity-50"
                  style={primaryGradientBtn}
                  onClick={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending || !formName.trim()}
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving…" : configuring.existing ? "Save changes" : "Connect"}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </ProtectedLayout>
  );
}
