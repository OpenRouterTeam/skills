---
name: openrouter-images
description: Generate images from text prompts and edit existing images using OpenRouter's dedicated Image API. Use when the user asks to create, generate, or make an image, picture, or illustration from a description, or wants to edit, modify, transform, or alter an existing image with a text prompt.
---

# OpenRouter Images

Generate images from text prompts and edit existing images via OpenRouter's dedicated Image API (`POST /api/v1/images`). The skill also discovers which models exist and which parameters each one accepts, so you pick a valid model and options instead of guessing.

## Prerequisites

The `OPENROUTER_API_KEY` environment variable must be set. Get a key at https://openrouter.ai/keys

Discovery (`discover.ts`) is public and works without a key; generation and editing require one.

## First-Time Setup

```bash
cd <skill-path>/scripts && npm install
```

## Decision Tree

Pick the right script based on what the user is asking:

| User wants to... | Script | Example |
|---|---|---|
| See which image models exist and what they support | `discover.ts` | "What image models can I use?" |
| Check the exact params a specific model accepts | `discover.ts <model>` | "Does seedream support 4K?" |
| Generate an image from a text description | `generate.ts "prompt"` | "Create an image of a sunset over mountains" |
| Generate with specific options | `generate.ts "prompt" --aspect-ratio 16:9` | "Make a wide landscape image of a forest" |
| Generate with a different model | `generate.ts "prompt" --model <id>` | "Generate using gemini 3.1 flash lite image" |
| Edit or modify an existing image | `edit.ts path "prompt"` | "Make the sky purple in photo.png" |
| Transform an image with instructions | `edit.ts path "prompt"` | "Add a party hat to the animal in this image" |

## Discover Capabilities First

Different models accept different parameters. Rather than hardcoding flags and hitting 400s, discover what's available before generating.

List every image model with a compact capability summary:

```bash
cd <skill-path>/scripts && npx tsx discover.ts
```

Each entry reports the model `id`, `input_modalities` / `output_modalities` (image input means it supports editing / image-to-image), `supports_streaming`, and a `supported_parameters` map — the union of what any endpoint of that model accepts.

Inspect one model's definitive per-endpoint capabilities:

```bash
cd <skill-path>/scripts && npx tsx discover.ts bytedance-seed/seedream-4.5
```

This calls `GET /api/v1/images/models/{author}/{slug}/endpoints` and returns, per provider endpoint:

| Field | Meaning |
|---|---|
| `provider_name` / `provider_slug` | The serving provider. Use `provider_slug` as the key in `--provider-options`. |
| `supported_parameters` | The exact parameters *this* endpoint accepts, with allowed values. |
| `allowed_passthrough_parameters` | Provider-specific keys you can pass under `--provider-options` (e.g. `steps`, `guidance`). |
| `supports_streaming` | Whether this endpoint streams. |
| `pricing` | Per-image / per-token pricing lines. |

Capability values print as readable strings: an enum shows as `1K | 2K | 4K`, a range as `0–100`, a boolean as `supported`. A parameter that's absent is unsupported — don't send it.

## Generate Image

Create a new image from a text prompt:

```bash
cd <skill-path>/scripts && npx tsx generate.ts "a red panda wearing sunglasses"
cd <skill-path>/scripts && npx tsx generate.ts "a futuristic cityscape at night" --aspect-ratio 16:9
cd <skill-path>/scripts && npx tsx generate.ts "pixel art of a dragon" --output dragon.png
cd <skill-path>/scripts && npx tsx generate.ts "a watercolor painting" --model google/gemini-3.1-flash-lite-image --resolution 1K
```

## Edit Image

Modify an existing image with a text prompt. The source image is sent as an image-to-image reference (`input_references`), so use a model whose `input_modalities` include `image` — check with `discover.ts <model>`.

```bash
cd <skill-path>/scripts && npx tsx edit.ts photo.png "make the sky purple"
cd <skill-path>/scripts && npx tsx edit.ts avatar.jpg "add a party hat" --output avatar-hat.png
cd <skill-path>/scripts && npx tsx edit.ts scene.png "convert to watercolor style" --model google/gemini-3.1-flash-lite-image
```

Supported input formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`

## Options

Both `generate.ts` and `edit.ts` accept the same flags. Only pass parameters the target model supports — verify with `discover.ts <model>`.

| Flag | Description | Default |
|---|---|---|
| `--model <id>` | OpenRouter model ID | `google/gemini-3.1-flash-image-preview` |
| `--output <path>` | Output file path | `image-YYYYMMDD-HHmmss.png` |
| `--aspect-ratio <r>` | Aspect ratio (e.g. `16:9`, `1:1`, `4:3`) | Model default |
| `--resolution <t>` | Resolution tier (`512`, `1K`, `2K`, `4K`) | Model default |
| `--size <s>` | Shorthand: a tier (`2K`) or explicit pixels (`2048x2048`) | Model default |
| `--quality <q>` | `auto`, `low`, `medium`, or `high` | Model default |
| `--output-format <f>` | `png`, `jpeg`, `webp`, or `svg` (vector models) | Model default |
| `--background <b>` | `auto`, `transparent`, or `opaque` | Model default |
| `--output-compression <n>` | Compression 0–100 for webp/jpeg | Model default |
| `--n <count>` | Number of images to generate (1–10, provider permitting) | 1 |
| `--seed <int>` | Seed for deterministic generation (where supported) | Random |
| `--provider-options <json>` | Provider-specific passthrough, keyed by `provider_slug` | None |

`--provider-options` takes a JSON object keyed by provider slug, using keys from that endpoint's `allowed_passthrough_parameters`:

```bash
cd <skill-path>/scripts && npx tsx generate.ts "a dramatic portrait" \
  --model black-forest-labs/flux.2-pro \
  --provider-options '{"black-forest-labs": {"steps": 40, "guidance": 3}}'
```

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

The generation cost (USD) is printed to stderr when the API reports it. When `--n` requests multiple images, each is saved with a `-1`, `-2`, … suffix.

## API Response Shapes

Generation uses `POST /api/v1/images`. See the [Image Generation guide](https://openrouter.ai/docs/guides/overview/multimodal/image-generation) for full request/response details.

Images come back base64-encoded in a `data` array. For raster PNG output, `media_type` is omitted; vector outputs (e.g. SVG) include it, and the saved file extension follows it:

```json
{
  "created": 1748372400,
  "data": [{ "b64_json": "<base64-encoded image data>" }],
  "usage": { "prompt_tokens": 0, "completion_tokens": 4175, "total_tokens": 4175, "cost": 0.04 }
}
```

## Using a Different Model

The default model is `google/gemini-3.1-flash-image-preview` (Nano Banana 2). To use another, pass `--model <id>` with any image model ID (e.g. `google/gemini-3.1-flash-lite-image`). Run `discover.ts` to browse image models and `discover.ts <model>` to confirm which parameters and providers it supports before generating.

## Presenting Results

- After generating or editing, display the saved image to the user
- Include the model used and, when reported, the generation cost (printed to stderr)
- If multiple images are returned, show all of them
- When the user doesn't specify an output path, tell them where the file was saved
- For edit operations, mention the source image that was modified
