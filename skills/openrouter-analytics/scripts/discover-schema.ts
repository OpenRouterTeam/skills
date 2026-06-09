/**
 * Discover the OpenRouter analytics schema — available metrics, dimensions,
 * filter operators, and granularities. Optionally filter by --section.
 */
import { requireApiKey, fetchMeta, parseArgs } from "./lib.js";

const args = parseArgs(process.argv.slice(2));
const apiKey = requireApiKey(args);
const section = args.get("section");

const { data } = await fetchMeta(apiKey);

switch (section) {
  case "metrics":
    console.log(JSON.stringify(data.metrics, null, 2));
    break;
  case "dimensions":
    console.log(JSON.stringify(data.dimensions, null, 2));
    break;
  case "operators":
    console.log(JSON.stringify(data.operators, null, 2));
    break;
  case "granularities":
    console.log(JSON.stringify(data.granularities, null, 2));
    break;
  default:
    console.log(JSON.stringify(data, null, 2));
}
