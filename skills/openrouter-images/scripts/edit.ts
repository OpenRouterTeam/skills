import {
  DEFAULT_MODEL,
  requireApiKey,
  parseArgs,
  parseRgbColors,
  parseRgbTriplet,
  postChatCompletion,
  readImageAsDataUrl,
  extractImages,
  saveImage,
  defaultOutputPath,
} from "./lib.js";

const apiKey = requireApiKey();
const args = parseArgs(process.argv.slice(2));

const imagePath = args.get("_0") as string | undefined;
const prompt = args.get("_1") as string | undefined;

if (!imagePath || !prompt) {
  console.error(
    "Usage: npx tsx edit.ts <image-path> \"prompt\" [--model <id>] [--output <path>]\n" +
      "  [--aspect-ratio <r>] [--image-size <s>]\n" +
      "  [--rgb-colors \"r,g,b[;r,g,b...]\"] [--background-rgb-color \"r,g,b\"]\n" +
      "  [--strength <0-1>]"
  );
  process.exit(1);
}

const model = (args.get("model") as string) || DEFAULT_MODEL;
const outputBase = (args.get("output") as string) || defaultOutputPath();
const aspectRatio = args.get("aspect-ratio") as string | undefined;
const imageSize = args.get("image-size") as string | undefined;
const rgbColorsRaw = args.get("rgb-colors") as string | undefined;
const bgColorRaw = args.get("background-rgb-color") as string | undefined;
const strengthRaw = args.get("strength") as string | undefined;

const dataUrl = readImageAsDataUrl(imagePath as string);

const imageConfig: Record<string, unknown> = {};
if (aspectRatio) imageConfig.aspect_ratio = aspectRatio;
if (imageSize) imageConfig.image_size = imageSize;
if (rgbColorsRaw) imageConfig.rgb_colors = parseRgbColors(rgbColorsRaw);
if (bgColorRaw) imageConfig.background_rgb_color = parseRgbTriplet(bgColorRaw);
if (strengthRaw) {
  const s = parseFloat(strengthRaw);
  if (isNaN(s) || s < 0 || s > 1) {
    console.error("Error: --strength must be a number between 0 and 1.");
    process.exit(1);
  }
  imageConfig.strength = s;
}

const body: any = {
  model,
  messages: [
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: dataUrl } },
        { type: "text", text: prompt },
      ],
    },
  ],
  // Recraft and other non-Google models reject modalities:"image","text" with a 404.
  // Google models require it for image output.
  ...(model.startsWith("google/") ? { modalities: ["image", "text"] } : {}),
  ...(Object.keys(imageConfig).length > 0 ? { image_config: imageConfig } : {}),
};

const json = await postChatCompletion(apiKey, body);

const textContent = json.choices?.[0]?.message?.content;
if (textContent) {
  console.error(`Model: ${textContent}`);
}

const images = extractImages(json);
if (images.length === 0) {
  console.error("Error: No images returned by model.");
  console.error("Response:", JSON.stringify(json, null, 2));
  process.exit(1);
}

const saved: string[] = [];
for (let i = 0; i < images.length; i++) {
  const raw = images[i];
  // Normalise: pass data: and https: URLs as-is; wrap bare base64 as PNG.
  const imgData =
    raw.startsWith("data:") || raw.startsWith("http://") || raw.startsWith("https://")
      ? raw
      : `data:image/png;base64,${raw}`;

  let outPath: string;
  if (images.length === 1) {
    outPath = outputBase;
  } else {
    const dotIdx = outputBase.lastIndexOf(".");
    const base = dotIdx > 0 ? outputBase.slice(0, dotIdx) : outputBase;
    outPath = `${base}-${i + 1}`;
  }
  const abs = await saveImage(imgData, outPath);
  saved.push(abs);
}

console.log(
  JSON.stringify(
    { model, source_image: imagePath, prompt, images_saved: saved, count: saved.length },
    null,
    2
  )
);
