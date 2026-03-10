---
name: openrouter-images
description: >
  Generate images from text prompts and edit existing images using OpenRouter's image generation models.
  Use this skill whenever the user wants to create visual content of any kind: generate an image, picture,
  photo, artwork, illustration, logo, icon, banner, thumbnail, mockup, diagram, or sketch from a description.
  Also use when the user wants to edit, modify, transform, or alter an existing image — changing colors,
  adding or removing elements, converting style (watercolor, pixel art, oil painting, etc.), or fixing
  something in a photo. Trigger on phrases like "make me a picture", "draw/sketch/paint this", "visualize
  this concept", "create a logo", "generate a mockup", "change/fix/update this image", "add/remove something
  from this photo", or any request that implies producing or modifying a visual. Even if the user doesn't
  say "image generation" explicitly, use this skill whenever the output should be an image file.
---

# OpenRouter Images

Generate images from text prompts and edit existing images via OpenRouter's chat completions API with image modalities.

## Prerequisites

- The `OPENROUTER_API_KEY` environment variable must be set. Get a key at https://openrouter.ai/keys
- `bun` must be installed

## First-Time Setup

```bash
cd <skill-path>/scripts && bun install
```

## Decision Tree

Pick the right script based on what the user is asking:

| User wants to... | Script | Example |
|---|---|---|
| Generate an image from a text description | `generate.ts "prompt"` | "Create an image of a sunset over mountains" |
| Generate with specific aspect ratio | `generate.ts "prompt" --aspect-ratio 16:9` | "Make a wide landscape image of a forest" |
| Generate with a different model | `generate.ts "prompt" --model <id>` | "Generate using gemini-2.5-flash-image" |
| Edit or modify an existing image | `edit.ts path "prompt"` | "Make the sky purple in photo.png" |
| Transform an image with instructions | `edit.ts path "prompt"` | "Add a party hat to the animal in this image" |

## Generate Image

Create a new image from a text prompt:

```bash
cd <skill-path>/scripts && bun run generate.ts "a red panda wearing sunglasses"
cd <skill-path>/scripts && bun run generate.ts "a futuristic cityscape at night" --aspect-ratio 16:9
cd <skill-path>/scripts && bun run generate.ts "pixel art of a dragon" --output dragon.png
cd <skill-path>/scripts && bun run generate.ts "a watercolor painting" --model google/gemini-2.5-flash-image
```

### Options

| Flag | Description | Default |
|---|---|---|
| `--model <id>` | OpenRouter model ID | `google/gemini-3.1-flash-image-preview` |
| `--output <path>` | Output file path | `image-YYYYMMDD-HHmmss.png` |
| `--aspect-ratio <r>` | Aspect ratio (e.g. `16:9`, `1:1`, `4:3`) | Model default |
| `--image-size <s>` | Image size (e.g. `1K`, `2K`) | Model default |

## Edit Image

Modify an existing image with a text prompt:

```bash
cd <skill-path>/scripts && bun run edit.ts photo.png "make the sky purple"
cd <skill-path>/scripts && bun run edit.ts avatar.jpg "add a party hat" --output avatar-hat.png
cd <skill-path>/scripts && bun run edit.ts scene.png "convert to watercolor style" --model google/gemini-2.5-flash-image
```

### Options

| Flag | Description | Default |
|---|---|---|
| `--model <id>` | OpenRouter model ID | `google/gemini-3.1-flash-image-preview` |
| `--output <path>` | Output file path | `image-YYYYMMDD-HHmmss.png` |
| `--aspect-ratio <r>` | Aspect ratio (e.g. `16:9`, `1:1`, `4:3`) | Model default |
| `--image-size <s>` | Image size (e.g. `1K`, `2K`) | Model default |

Supported input formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`

## Output Format

### generate.ts

```json
{
  "model": "google/gemini-3.1-flash-image-preview",
  "prompt": "a red panda wearing sunglasses",
  "images_saved": ["/absolute/path/to/image-20260305-143022.png"],
  "count": 1
}
```

### edit.ts

```json
{
  "model": "google/gemini-3.1-flash-image-preview",
  "source_image": "photo.png",
  "prompt": "make the sky purple",
  "images_saved": ["/absolute/path/to/image-20260305-143055.png"],
  "count": 1
}
```

## Prompt Tips

Better prompts produce better images. A few specifics go a long way:

- **State the medium** — "a watercolor painting", "a 35mm photograph", "pixel art", "3D render". This anchors the model's style.
- **Describe style and mood** — lighting, color palette, atmosphere ("warm golden-hour light", "moody noir shadows", "vibrant pop-art colors").
- **Be specific about composition** — what's in the foreground vs background, camera angle, framing ("close-up portrait", "wide aerial shot").
- **For edits, be precise** — say exactly what to change and what to preserve ("make the sky sunset-orange but keep the buildings unchanged").

## Model Selection

The default model is `google/gemini-3.1-flash-image-preview` (Nano Banana 2) — it's fast, free-tier eligible, and handles most requests well.

Pass `--model <id>` to use a different model. Choose based on what the user needs:

| Need | Recommended approach |
|---|---|
| Quick drafts, iteration | Default model — fast turnaround for exploring ideas |
| Highest quality / artistic style | Try a dedicated image model (e.g. DALL-E, Stable Diffusion variants) |
| Photo-realistic edits | Gemini models handle edit instructions well since they understand both text and images natively |
| Budget-conscious | Stick with the default or check pricing via the `openrouter-models` skill |

To discover all available image-generation models, use the `openrouter-models` skill:

```bash
cd <openrouter-models-skill-path>/scripts && bun run search-models.ts --modality image
```

## Presenting Results

- **Display the saved image** to the user immediately — they need to see the result to decide if it's good or needs another iteration.
- **Mention the model used** — so the user can switch models if the style doesn't match what they wanted.
- **Tell them the file path** — they'll need it for further edits, to include in other work, or to share.
- **Suggest refinements** — if the result isn't perfect, offer to tweak the prompt or try a different model. Image generation is inherently iterative.
- Include any text response the model provided (printed to stderr).
- If multiple images are returned, show all of them.
- For edit operations, mention the source image that was modified.
