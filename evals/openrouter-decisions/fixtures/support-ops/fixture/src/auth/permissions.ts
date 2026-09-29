export type Role = "owner" | "admin" | "agent" | "viewer";

export type Action = "ticket.read" | "ticket.reply" | "ticket.close" | "refund.issue" | "user.invite" | "billing.manage";

const GRANTS: Record<Role, ReadonlySet<Action>> = {
  owner: new Set(["ticket.read", "ticket.reply", "ticket.close", "refund.issue", "user.invite", "billing.manage"]),
  admin: new Set(["ticket.read", "ticket.reply", "ticket.close", "refund.issue", "user.invite"]),
  agent: new Set(["ticket.read", "ticket.reply", "ticket.close"]),
  viewer: new Set(["ticket.read"]),
};

export type Session = { userId: string; role: Role; orgId: string; mfaVerified: boolean };

const MFA_REQUIRED: ReadonlySet<Action> = new Set(["refund.issue", "billing.manage", "user.invite"]);

export function can(session: Session, action: Action, resourceOrgId: string): boolean {
  if (session.orgId !== resourceOrgId) return false;
  if (!GRANTS[session.role].has(action)) return false;
  if (MFA_REQUIRED.has(action) && !session.mfaVerified) return false;
  return true;
}
