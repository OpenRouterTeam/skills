export type TemplateName = "ticket_received" | "ticket_resolved" | "refund_approved" | "refund_denied";

const TEMPLATES: Record<TemplateName, { subject: string; body: string }> = {
  ticket_received: {
    subject: "We received your request ({{ticketId}})",
    body: "Hi {{firstName}},\n\nThanks for reaching out. Your ticket {{ticketId}} is in the queue and we will reply within {{slaHours}} hours.\n",
  },
  ticket_resolved: {
    subject: "Your ticket {{ticketId}} has been resolved",
    body: "Hi {{firstName}},\n\nWe have marked {{ticketId}} as resolved. Reply to this email within 7 days to reopen it.\n",
  },
  refund_approved: {
    subject: "Refund approved for order {{orderId}}",
    body: "Hi {{firstName}},\n\n{{amount}} will return to your original payment method within 5 to 10 business days.\n",
  },
  refund_denied: {
    subject: "Update on your refund request for {{orderId}}",
    body: "Hi {{firstName}},\n\nWe could not approve this refund because the request fell outside our 30 day window.\n",
  },
};

export function render(name: TemplateName, vars: Record<string, string>): { subject: string; body: string } {
  const fill = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const value = vars[key];
      if (value === undefined) throw new Error(`Missing template variable ${key} for ${name}`);
      return value;
    });
  const template = TEMPLATES[name];
  return { subject: fill(template.subject), body: fill(template.body) };
}
