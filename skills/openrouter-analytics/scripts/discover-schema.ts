import { requireApiKey, fetchMeta, parseArgs } from "./lib.js";

const apiKey = requireApiKey();
const args = parseArgs(process.argv.slice(2));
const section = args.get("section") as string | undefined;

const json = (await fetchMeta(apiKey)) as {
  data: {
    metrics: unknown[];
    dimensions: unknown[];
    operators: unknown[];
    granularities: unknown[];
  };
};

const { data } = json;

if (section === "metrics") {
  console.log(JSON.stringify(data.metrics, null, 2));
} else if (section === "dimensions") {
  console.log(JSON.stringify(data.dimensions, null, 2));
} else if (section === "operators") {
  console.log(JSON.stringify(data.operators, null, 2));
} else if (section === "granularities") {
  console.log(JSON.stringify(data.granularities, null, 2));
} else {
  console.log(JSON.stringify(data, null, 2));
}
