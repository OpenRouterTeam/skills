import {
  DEFAULT_MODEL,
  requireApiKey,
  parseArgs,
  postImageGeneration,
  readImageAsDataUrl,
  saveImage,
  buildImageParams,
  defaultOutputPath,
} from "./lib.js";

const apiKey = requireApiKey();
const args = parseArgs(process.argv.slice(2));

const imagePath = args.get("_0") as string | undefined;
const prompt = args.get("_1") as string | undefined;

if (!imagePath || !prompt) {
  console.error(
    'Usage: npx tsx edit.ts <image-path> "prompt" [--model <id>] [--output <path>]\n' +
      "  [--aspect-ratio <r>] [--resolution <512|1K|2K|4K>] [--size <s>] [--n <count>]\n" +
      "  [--quality <auto|low|medium|high>] [--output-format <png|jpeg|webp|svg>]\n" +
      "  [--background <auto|transparent|opaque>] [--output-compression <n>] [--seed <int>]\n" +
      "  [--provider '<json>'] [--provider-options '<json>']\n\n" +
      "Editing sends the source image as an image-to-image reference, so pick a model\n" +
      "whose input_modalities include \"image\". Run discover.ts <model> to check."
  );
  process.exit(1);
}

const model = (args.get("model") as string) || DEFAULT_MODEL;
const outputBase = (args.get("output") as string) || defaultOutputPath();
const dataUrl = readImageAsDataUrl(imagePath);

const body = {
  model,
  prompt,
  input_references: [{ type: "image_url", image_url: { url: dataUrl } }],
  ...buildImageParams(args),
};

const json = await postImageGeneration(apiKey, body);
const images = json.data ?? [];

if (images.length === 0) {
  console.error("Error: No images returned by model.");
  process.exit(1);
}

const saved: string[] = [];
for (let i = 0; i < images.length; i++) {
  const b64 = images[i].b64_json;
  if (!b64) {
    console.error("Error: Unexpected image shape in response.");
    process.exit(1);
  }
  saved.push(saveImage(b64, outputBase, images[i].media_type, i, images.length));
}

if (json.usage?.cost !== undefined) {
  console.error(`Cost: $${json.usage.cost}`);
}

console.log(
  JSON.stringify(
    { model, source_image: imagePath, prompt, images_saved: saved, count: saved.length },
    null,
    2
  )
);
