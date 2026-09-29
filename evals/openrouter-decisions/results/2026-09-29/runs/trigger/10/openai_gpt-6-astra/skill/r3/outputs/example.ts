import { rankTickets } from "./src/rank-tickets.ts";

const result = await rankTickets(
  { id: "NEW", title: "Cannot export filtered report", description: "Applying a date filter then downloading the report as CSV produces an empty file. The table still displays rows. Export without the filter works." },
  [
    { id: "T-101", title: "CSV download loses date-selected rows", description: "After selecting a reporting period, the spreadsheet download contains only headers, despite populated results on screen. Removing the date range restores the download." },
    { id: "T-102", title: "CSV export buttons overlap", description: "On mobile screens the CSV export button overlaps the date filter. The downloaded file contains all expected data." },
    { id: "T-103", title: "Email delivery failure", description: "Password reset emails never arrive." }
  ],
  { log: event => console.error(JSON.stringify(event)) }
);
console.log(JSON.stringify(result, null, 2));
