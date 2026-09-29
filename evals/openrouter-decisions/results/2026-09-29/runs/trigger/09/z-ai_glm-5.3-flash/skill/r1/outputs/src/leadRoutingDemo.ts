import { routeLead, type Lead } from "./leadRouting";

const leads: Lead[] = [
  {
    company: "BigCo",
    headcount: 1200,
    regions: ["us"],
    freeText: "Pilot for our sales team.",
  },
  {
    company: "MultiRegion",
    headcount: 40,
    regions: ["us", "eu", "apac"],
    freeText: "",
  },
  {
    company: "RolloutCo",
    headcount: 120,
    regions: ["us"],
    freeText:
      "We need to roll this out across the entire company, all departments and offices.",
  },
  {
    company: "SmallTeam",
    headcount: 25,
    regions: ["eu"],
    freeText: "Our procurement team of five wants this for vendor approvals.",
  },
];

async function main() {
  for (const lead of leads) {
    const routing = await routeLead(lead);
    console.log(
      `${lead.company}: ${routing.segment} (${routing.reasons.join("; ")})`,
    );
  }
}

main();
