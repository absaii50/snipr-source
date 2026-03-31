"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLogin from "./AdminLogin";
import AdminShell, { type AdminTab } from "./AdminShell";
import Overview from "./tabs/Overview";
import UsersTab from "./tabs/Users";
import LinksTab from "./tabs/Links";
import DomainsTab from "./tabs/Domains";
import AnalyticsTab from "./tabs/Analytics";
import PlansTab from "./tabs/Plans";
import BillingTab from "./tabs/Billing";
import ReportsTab from "./tabs/Reports";
import AIInsightsTab from "./tabs/AIInsights";
import AuditLogTab from "./tabs/AuditLog";
import SettingsTab from "./tabs/Settings";
import GuideTab from "./tabs/Guide";
import EmailTab from "./tabs/Email";
import { apiFetch } from "./utils";

const VALID_TABS: AdminTab[] = [
  "overview", "users", "links", "domains",
  "analytics", "plans", "billing", "reports", "email", "ai", "audit", "settings", "guide",
];

function TabContent({ tab }: { tab: AdminTab }) {
  switch (tab) {
    case "overview":  return <Overview />;
    case "users":     return <UsersTab />;
    case "links":     return <LinksTab />;
    case "domains":   return <DomainsTab />;
    case "analytics": return <AnalyticsTab />;
    case "plans":     return <PlansTab />;
    case "billing":   return <BillingTab />;
    case "reports":   return <ReportsTab />;
    case "email":     return <EmailTab />;
    case "ai":        return <AIInsightsTab />;
    case "audit":     return <AuditLogTab />;
    case "settings":  return <SettingsTab />;
    case "guide":     return <GuideTab />;
  }
}

export default function Admin() {
  const params = useParams();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const rawTab = Array.isArray(params?.tab) ? params.tab[0] : (params?.tab as string | undefined) ?? "overview";
  const tab: AdminTab = VALID_TABS.includes(rawTab as AdminTab)
    ? (rawTab as AdminTab)
    : "overview";

  useEffect(() => {
    apiFetch("/admin/me")
      .then((d) => setIsAdmin(d.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F4F6]">
        <div className="w-8 h-8 border-2 border-[#728DA7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <AdminLogin onLogin={() => { setIsAdmin(true); router.push("/admin/overview"); }} />;
  }

  return (
    <AdminShell
      tab={tab}
      setTab={(t) => router.push(`/admin/${t}`)}
      onLogout={() => { setIsAdmin(false); router.push("/admin"); }}
    >
      <TabContent tab={tab} />
    </AdminShell>
  );
}
