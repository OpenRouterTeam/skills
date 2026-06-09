/**
 * Retrieve the stored prompt and completion content for a generation.
 * Returns input messages/prompt and output completion/reasoning text.
 * Content is unavailable if Zero Data Retention (ZDR) was enabled.
 */
import { requireApiKey, fetchGenerationContent, parseArgs } from "./lib.js";

const args = parseArgs(process.argv.slice(2), ["json"]);
const apiKey = requireApiKey(args);

const generationId = args.get("id") ?? args.get("_0");

if (!generationId) {
  console.error(`
Usage: npx tsx get-generation-content.ts <generation-id> [--json]
       npx tsx get-generation-content.ts --id gen-1234567890 [--json]

Returns the stored prompt and completion content:
  - Input: original prompt text and messages array
  - Output: completion text and reasoning (if available)

Note: Content is only available if the generation was not
made with Zero Data Retention (ZDR) enabled.
`.trim());
  process.exit(1);
}

const result = await fetchGenerationContent(apiKey, generationId);

const json = args.has("json");
if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const { data: rawData } = result;
  if (!rawData) {
    console.log("Generation:", generationId);
    console.log("");
    console.log("No content available for this generation.");
    console.log(
      "This may be because Zero Data Retention (ZDR) was enabled."
    );
    console.log("");
    console.log("Use --json for full raw response");
    process.exit(0);
  }
  const input = rawData.input as
    | { prompt?: string; messages?: Array<{ role: string; content: string | unknown[] }> }
    | undefined;
  const output = rawData.output as
    | { completion?: string; reasoning?: string }
    | undefined;

  console.log("Generation:", generationId);
  console.log("");

  const hasInput = Boolean(
    input &&
      (input.prompt != null ||
        (input.messages && input.messages.length > 0))
  );
  const hasOutput = Boolean(
    output && (output.completion != null || output.reasoning != null)
  );

  if (hasInput && input) {
    console.log("=== INPUT ===");
    if (input.prompt != null) {
      console.log("Prompt:", input.prompt);
    }
    if (input.messages && input.messages.length > 0) {
      console.log("Messages:");
      for (const msg of input.messages) {
        const content =
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content);
        console.log(`  [${msg.role}]: ${content}`);
      }
    }
    console.log("");
  }

  if (hasOutput && output) {
    console.log("=== OUTPUT ===");
    if (output.completion != null) {
      console.log("Completion:", output.completion);
    }
    if (output.reasoning != null) {
      console.log("");
      console.log("Reasoning:", output.reasoning);
    }
  }

  if (!hasInput && !hasOutput) {
    console.log("No content available for this generation.");
    console.log(
      "This may be because Zero Data Retention (ZDR) was enabled."
    );
  }

  console.log("");
  console.log("Use --json for full raw response");
}
