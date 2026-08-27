import { readFile } from "node:fs/promises";

const fixturePath = new URL(
  process.env.OPENROUTER_MODELS_TEST_FIXTURE ??
    "./fixtures/output-capacity-is-not-throughput.json",
  import.meta.url
);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  let body;

  if (url.pathname === "/api/v1/models") {
    body = fixture.models;
  } else {
    const match = url.pathname.match(/^\/api\/v1\/models\/(.+)\/endpoints$/);
    const modelId = match?.[1];
    body = modelId ? fixture.endpoints_by_model[modelId] : undefined;
  }

  if (!body) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json(body);
};
