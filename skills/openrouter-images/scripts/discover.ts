import type { CapabilityDescriptor, ImageEndpoint, ImageModelListItem } from "./lib.js";

import { parseArgs, getImageModels, getImageModelEndpoints } from "./lib.js";

const args = parseArgs(process.argv.slice(2));
const model = args.get("_0") as string | undefined;

if (model) {
  await showEndpoints(model);
} else {
  await listModels();
}

async function listModels(): Promise<void> {
  const { data } = await getImageModels();
  const models = data ?? [];
  const summary = models.map((m: ImageModelListItem) => ({
    id: m.id,
    name: m.name,
    input_modalities: m.architecture?.input_modalities ?? [],
    output_modalities: m.architecture?.output_modalities ?? [],
    supports_streaming: m.supports_streaming ?? false,
    supported_parameters: describeParameters(m.supported_parameters),
    endpoints_url: m.endpoints,
  }));
  console.log(JSON.stringify({ count: summary.length, models: summary }, null, 2));
}

async function showEndpoints(modelSlug: string): Promise<void> {
  const { id, endpoints } = await getImageModelEndpoints(modelSlug);
  const rows = (endpoints ?? []).map((e: ImageEndpoint) => ({
    provider_name: e.provider_name,
    provider_slug: e.provider_slug,
    provider_tag: e.provider_tag ?? null,
    supports_streaming: e.supports_streaming ?? false,
    supported_parameters: describeParameters(e.supported_parameters),
    allowed_passthrough_parameters: e.allowed_passthrough_parameters ?? [],
    pricing: e.pricing ?? [],
  }));
  console.log(JSON.stringify({ id, endpoints: rows }, null, 2));
}

function describeParameters(
  parameters: Record<string, CapabilityDescriptor> | undefined
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, descriptor] of Object.entries(parameters ?? {})) {
    result[name] = describeDescriptor(descriptor);
  }
  return result;
}

function describeDescriptor(descriptor: CapabilityDescriptor): string {
  switch (descriptor.type) {
    case "enum":
      return descriptor.values.join(" | ");
    case "range":
      return `${descriptor.min}–${descriptor.max}`;
    case "boolean":
      return "supported";
    default:
      return "unknown";
  }
}
