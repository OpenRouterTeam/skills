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

Free variants are listed as their own entries with an ID ending in `:free` (e.g. `recraft/recraft-v4.1-flash-v2:free`), next to the paid entry when both exist. Pass a `:free` ID as `--model`, or to `discover.ts` to see its free endpoints. Free variants have per-minute and daily rate limits.

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

Models that accept references advertise `supported_parameters.input_references` with an allowed `min` and `max` count (up to 16 globally, narrowed per model); `min: 1` marks an edit-only model that requires a source image. List them with `curl -s https://openrouter.ai/api/v1/images/models | jq '[.data[] | select(.supported_parameters.input_references != null) | {id, input_references: .supported_parameters.input_references}]'`. Reference entries take no `bbox` placement parameter — describe placement in the prompt.

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
| `--output-format <f>` | `png`, `jpeg`, `webp`, `svg` (vector models), or `gif` (animation models, e.g. `openai/gpt-image-2.6-flare`) | Model default |
| `--background <b>` | `auto`, `transparent`, or `opaque` | Model default |
| `--output-compression <n>` | Compression 0–100 for webp/jpeg | Model default |
| `--frame-count <n>` | Animation frames (2–64) with `--output-format gif` | Model default |
| `--frame-duration-ms <n>` | Per-frame display time (20–2000 ms) with `--output-format gif` | Model default |
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

### Layer decomposition (Seedream)

Seedream can split one generation into a base image plus separate layers. Request it through `--provider-options` with `layer_decomposition: true` and the required `layer_decomposition_options.max_images` (2–16). Leave `--n` at 1 and don't pass `--aspect-ratio` or an explicit `WIDTHxHEIGHT` `--size`; invalid combinations return a 400. Confirm both keys are in the endpoint's `allowed_passthrough_parameters` with `discover.ts` first.

```bash
cd <skill-path>/scripts && npx tsx generate.ts "a sale poster with a red circle and bold text" \
  --model bytedance-seed/seedream-5-5 \
  --provider-options '{"seed": {"layer_decomposition": true, "layer_decomposition_options": {"max_images": 4}}}'
```

Up to `max_images` images come back (base plus layers), each saved with a numbered suffix. Each returned image carries a `layer` object, which `generate.ts` echoes in a `layers` array next to the saved file path:

- `z_index` (always present): stacking order; `0` is the opaque base image, higher values sit on top.
- `name`, `description`: provider-assigned labels.
- `background`: `opaque` or `transparent`.
- `bounding_box`: `{ absolute, normalized }`, each `[x_min, y_min, x_max, y_max]` (`absolute` in base-image pixels, `normalized` on a 0–1000 scale).
- `text_recognition`: `{ text, lines[] }` when the provider recognized text; each line has `runs[]` of `{ text, style }` (e.g. `similar_font_family`, `foreground_color`, `bold`).

### Text placement (Recraft V3)

`recraft/recraft-v3` accepts `text_layout` under the `recraft` provider options to place text. Each entry pairs a `text` string with a `bbox` of four `[x, y]` corner points, as fractions (0–1) of the image width and height:

```bash
cd <skill-path>/scripts && npx tsx generate.ts "a red panda holding a sign" \
  --model recraft/recraft-v3 \
  --provider-options '{"recraft": {"text_layout": [{"text": "HELLO", "bbox": [[0.3, 0.45], [0.7, 0.45], [0.7, 0.55], [0.3, 0.55]]}]}}'
```

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

### Signed URLs instead of base64

Send `"response_format": "url"` (default `b64_json`) to get a signed download link per image instead of inline bytes. Each `data[]` item then carries `url` (plus `media_type`) and the response adds `expires_at` (Unix seconds, up to 24 hours after storage). The URL is a bearer link — anyone holding it can download the image until it expires — and the stored copy is deleted soon after. The response falls back to `b64_json` when a URL can't be issued: streaming, zero-data-retention requests or endpoints, or storage unavailable, so always handle both shapes. A completed `url` generation is billed once stored, even if the client disconnects before receiving the response. The bundled scripts use the default `b64_json`.

```json
{
  "created": 1748372400,
  "data": [{ "url": "https://example.com/generated-image.png", "media_type": "image/png" }],
  "expires_at": 1748458800,
  "usage": { "prompt_tokens": 0, "completion_tokens": 4175, "total_tokens": 4175, "cost": 0.04 }
}
```

## Using a Different Model

The default model is `google/gemini-3.1-flash-image-preview` (Nano Banana 2). To use another, pass `--model <id>` with any image model ID (e.g. `google/gemini-3.1-flash-lite-image`). Run `discover.ts` to browse image models and `discover.ts <model>` to confirm which parameters and providers it supports before generating.

## Billing Errors (402 / 403)

Paid image requests are checked against your credit balance, per-key credit limits, and the in-flight spending budget (an estimated cost held while requests run and settle). Read `error.metadata.limit_source`:

- `402` + `openrouter_in_flight_budget` — running and recently completed requests filled the in-flight budget. Transient: wait for `Retry-After` and retry.
- `402` + `openrouter_credits` — the balance is below the minimum needed to start (shrinking the request won't help; add credits), or one request's estimated cost exceeds the whole in-flight budget (lower `--n` or resolution).
- `403` + `openrouter_key_limit` — the API key's spending cap is exhausted (including pending charges). Raise the key limit or wait for its window to reset.

## Presenting Results

- After generating or editing, display the saved image to the user
- Include the model used and, when reported, the generation cost (printed to stderr)
- If multiple images are returned, show all of them
- When the user doesn't specify an output path, tell them where the file was saved
- For edit operations, mention the source image that was modified
