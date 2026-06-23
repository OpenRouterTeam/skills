---
name: openrouter-images
description: Generate images from text prompts and edit existing images using OpenRouter's image generation models. Use when the user asks to create, generate, or make an image, picture, or illustration from a description, or wants to edit, modify, transform, or alter an existing image with a text prompt.
---

# OpenRouter Images

Generate images from text prompts and edit existing images via OpenRouter's chat completions API with image modalities.

## Prerequisites

The `OPENROUTER_API_KEY` environment variable must be set. Get a key at https://openrouter.ai/keys

## First-Time Setup

```bash
cd <skill-path>/scripts && npm install
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
cd <skill-path>/scripts && npx tsx generate.ts "a red panda wearing sunglasses"
cd <skill-path>/scripts && npx tsx generate.ts "a futuristic cityscape at night" --aspect-ratio 16:9
cd <skill-path>/scripts && npx tsx generate.ts "pixel art of a dragon" --output dragon
cd <skill-path>/scripts && npx tsx generate.ts "a watercolor painting" --model google/gemini-2.5-flash-image
cd <skill-path>/scripts && npx tsx generate.ts "red logo on white" --model recraft-ai/recraft-v3-svg --rgb-colors "220,30,30"
```

### Options

| Flag | Description | Default |
|---|---|---|
| `--model <id>` | OpenRouter model ID | `google/gemini-3.1-flash-image-preview` |
| `--output <stem>` | Output path stem (extension auto-derived from MIME type) | `image-YYYYMMDD-HHmmss` |
| `--aspect-ratio <r>` | Aspect ratio (e.g. `16:9`, `1:1`, `4:3`) | Model default |
| `--image-size <s>` | Image size (e.g. `1K`, `2K`) | Model default |
| `--rgb-colors <list>` | Semicolon-separated RGB palette, e.g. `255,0,0;0,128,0` (Recraft) | — |
| `--background-rgb-color <rgb>` | Background color as `r,g,b` (Recraft) | — |
| `--strength <0-1>` | Influence strength for style/color transfer (Recraft) | — |

**Output extension:** The file extension (`.png`, `.jpg`, `.webp`, `.svg`, etc.) is derived automatically from the MIME type returned by the model. If you pass `--output dragon`, the saved file might be `dragon.png` or `dragon.svg` depending on the model.

## Edit Image

Modify an existing image with a text prompt:

```bash
cd <skill-path>/scripts && npx tsx edit.ts photo.png "make the sky purple"
cd <skill-path>/scripts && npx tsx edit.ts avatar.jpg "add a party hat" --output avatar-hat
cd <skill-path>/scripts && npx tsx edit.ts scene.png "convert to watercolor style" --model google/gemini-2.5-flash-image
cd <skill-path>/scripts && npx tsx edit.ts logo.png "recolor in red palette" --rgb-colors "220,30,30;180,20,20"
```

### Options

| Flag | Description | Default |
|---|---|---|
| `--model <id>` | OpenRouter model ID | `google/gemini-3.1-flash-image-preview` |
| `--output <stem>` | Output path stem (extension auto-derived from MIME type) | `image-YYYYMMDD-HHmmss` |
| `--aspect-ratio <r>` | Aspect ratio (e.g. `16:9`, `1:1`, `4:3`) | Model default |
| `--image-size <s>` | Image size (e.g. `1K`, `2K`) | Model default |
| `--rgb-colors <list>` | Semicolon-separated RGB palette, e.g. `255,0,0;0,128,0` (Recraft) | — |
| `--background-rgb-color <rgb>` | Background color as `r,g,b` (Recraft) | — |
| `--strength <0-1>` | Influence strength for style/color transfer (Recraft) | — |

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

## API Response Shapes

Image generation uses `POST /api/v1/chat/completions`. Google models require `modalities: ["image", "text"]`; other models (Recraft, DALL-E, etc.) must omit `modalities` to avoid a 404.

Images are extracted from four possible response shapes, tried in order:

1. **OpenRouter extension** — `choices[0].message.images[]` (string array)
2. **Responses API items** — `output[].type == "image_generation_call"` with `status == "completed"`
3. **DALL-E / native** — `data[].url` or `data[].b64_json`
4. **Content array** — `choices[0].message.content[].type == "image_url"`

The saved file extension (`.png`, `.jpg`, `.webp`, `.svg`, etc.) is derived from the MIME type in the response — either the `content-type` header (for HTTP URL images) or the `data:` URL prefix (for base64 images).

## Using a Different Model

The default model is `google/gemini-3.1-flash-image-preview` (Nano Banana 2). To use a different model, pass `--model <id>` with any OpenRouter model ID that supports image output modalities.

Use the `openrouter-models` skill to discover image-capable models:

```bash
cd <openrouter-models-skill-path>/scripts && npx tsx search-models.ts --modality image
```

## Presenting Results

- After generating or editing, display the saved image to the user
- Include the model used and any text response the model provided (printed to stderr)
- If multiple images are returned, show all of them
- When the user doesn't specify an output path, tell them where the file was saved
- For edit operations, mention the source image that was modified
