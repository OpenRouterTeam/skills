export type Lead = {
  email: string;
  company: string;
  employees: number | null;
  message: string;
  source: "website_form" | "event" | "partner";
};

export type SalesTeam = "enterprise" | "smb" | "partnerships" | "developer_relations" | "general_inbox";

const ENTERPRISE_MIN_EMPLOYEES = 1_000;

export function routeLead(lead: Lead): SalesTeam {
  const message = lead.message.toLowerCase();
  if (lead.source === "partner") return "partnerships";
  if (lead.employees !== null && lead.employees >= ENTERPRISE_MIN_EMPLOYEES) return "enterprise";
  if (message.includes("api") || message.includes("sdk") || message.includes("integration")) return "developer_relations";
  if (message.includes("reseller") || message.includes("partner") || message.includes("white label")) return "partnerships";
  if (message.includes("enterprise") || message.includes("procurement") || message.includes("security review")) return "enterprise";
  if (message.includes("pricing") || message.includes("trial") || message.includes("demo")) return "smb";
  return "general_inbox";
}
