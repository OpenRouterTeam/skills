import type { ChatResponse, Modality } from '@openrouter/sdk/models';
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

const modalities: Modality[] = [
  'image',
  'text',
];

const response = (await client.chat.send({
  chatGenerationParams: {
    model,
    messages: [
      {
        role: 'user' as const,
        content: prompt,
      },
    ],
    modalities,
    ...(Object.keys(imageConfig).length > 0
      ? {
          imageConfig,
        }
      : {}),
  },
})) as ChatResponse;

const message = response.choices?.[0]?.message;

if (!message) {
  console.error('Error: No response from model.');
  process.exit(1);
}

if (message.content && typeof message.content === 'string') {
  console.error(`Model: ${message.content}`);
}

const images: string[] = message.images?.map((img) => img.imageUrl.url) ?? [];
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
