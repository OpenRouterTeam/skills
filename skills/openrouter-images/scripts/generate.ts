import type { ResponsesOutputModality } from '@openrouter/sdk/models';
import { createClient, DEFAULT_MODEL, defaultOutputPath, parseArgs, saveImage } from './lib.js';

const client = createClient();
const args = parseArgs(process.argv.slice(2));

const prompt = args.get('_0') as string | undefined;
if (!prompt) {
  console.error(
    'Usage: bun run generate.ts "prompt" [--model <id>] [--output <path>] [--aspect-ratio <r>] [--image-size <s>]',
  );
  process.exit(1);
}

const model = (args.get('model') as string) || DEFAULT_MODEL;
const outputBase = (args.get('output') as string) || defaultOutputPath();
const aspectRatio = args.get('aspect-ratio') as string | undefined;
const imageSize = args.get('image-size') as string | undefined;

const imageConfig: Record<string, string> = {};
if (aspectRatio) {
  imageConfig.aspect_ratio = aspectRatio;
}
if (imageSize) {
  imageConfig.image_size = imageSize;
}

const modalities: ResponsesOutputModality[] = [
  'image',
  'text',
];

const result = client.callModel({
  model,
  input: prompt,
  modalities,
  ...(Object.keys(imageConfig).length > 0
    ? {
        imageConfig,
      }
    : {}),
});

const response = await result.getResponse();

// Extract text from message output items
for (const item of response.output) {
  if (item.type === 'message' && typeof item.content === 'string' && item.content) {
    console.error(`Model: ${item.content}`);
  }
}

// Extract images from image_generation_call output items
const images: string[] = response.output
  .filter(
    (
      item,
    ): item is typeof item & {
      type: 'image_generation_call';
      result: string;
    } => item.type === 'image_generation_call' && typeof item.result === 'string',
  )
  .map((item) => item.result);

if (images.length === 0) {
  console.error('Error: No images returned by model.');
  process.exit(1);
}

const saved: string[] = [];
for (let i = 0; i < images.length; i++) {
  const dataUrl = images[i].startsWith('data:') ? images[i] : `data:image/png;base64,${images[i]}`;
  let outPath: string;
  if (images.length === 1) {
    outPath = outputBase;
  } else {
    const dotIdx = outputBase.lastIndexOf('.');
    const base = dotIdx > 0 ? outputBase.slice(0, dotIdx) : outputBase;
    const ext = dotIdx > 0 ? outputBase.slice(dotIdx) : '.png';
    outPath = `${base}-${i + 1}${ext}`;
  }
  const abs = saveImage(dataUrl, outPath);
  saved.push(abs);
}

console.log(
  JSON.stringify(
    {
      model,
      prompt,
      images_saved: saved,
      count: saved.length,
    },
    null,
    2,
  ),
);
