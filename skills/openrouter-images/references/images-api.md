# Images API reference

## Endpoints

- Generate or edit: `POST https://openrouter.ai/api/v1/images`
- List image models: `GET https://openrouter.ai/api/v1/images/models`
- Inspect serving endpoints: `GET https://openrouter.ai/api/v1/images/models/{author}/{slug}/endpoints`

The dedicated endpoint returns images in `data[].b64_json`. Do not expect Chat Completions' `choices[].message.images` or Responses API output items.

## Discovery fields

`discover.ts` summarizes model input/output modalities, streaming support, and supported parameters. Per-endpoint discovery additionally reports:

- `provider_slug`: key used by `--provider-options`
- `supported_parameters`: accepted standard parameters and allowed values
- `allowed_passthrough_parameters`: provider-specific option names
- `pricing`: billable units and USD costs

An absent parameter is unsupported by that endpoint.

## Generation and editing

Generation sends `model`, `prompt`, and only the options supplied by the user. Editing additionally sends the source image as:

```json
{
  "input_references": [
    { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
  ]
}
```

Supported edit inputs are PNG, JPEG, WebP, and GIF. Confirm the selected model accepts image input.

## Options

| Flag | API field | Notes |
|---|---|---|
| `--aspect-ratio` | `aspect_ratio` | Examples: `1:1`, `16:9` |
| `--resolution` | `resolution` | Model-specific tier such as `1K`, `2K`, `4K` |
| `--size` | `size` | Tier or explicit dimensions, where supported |
| `--quality` | `quality` | `auto`, `low`, `medium`, or `high`, where supported |
| `--output-format` | `output_format` | Commonly PNG, JPEG, WebP, or SVG |
| `--background` | `background` | `auto`, `transparent`, or `opaque` |
| `--output-compression` | `output_compression` | Integer 0–100 for compressed formats |
| `--n` | `n` | Number of images, subject to endpoint limits |
| `--seed` | `seed` | Deterministic seed, where supported |
| `--provider-options` | `provider.options` | JSON keyed by `provider_slug` |

Example provider options:

```bash
npx tsx scripts/generate.ts "dramatic portrait" \
  --model black-forest-labs/flux.2-pro \
  --provider-options '{"black-forest-labs":{"steps":40,"guidance":3}}'
```

## Response

```json
{
  "created": 1748372400,
  "data": [{ "b64_json": "<base64>" }],
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 4175,
    "total_tokens": 4175,
    "cost": 0.04
  }
}
```

`media_type` may accompany vector or non-default output. The scripts use it to choose the saved file extension. Multiple images receive numbered suffixes.

## Troubleshooting

- 401: verify `OPENROUTER_API_KEY`.
- 402: add credits at https://openrouter.ai/credits.
- 404: verify the model ID or discovery route.
- 429: wait, then retry.
- 400 or unsupported-parameter errors: inspect the model with `discover.ts <model>` and remove fields absent from the chosen endpoint.

Full guide: https://openrouter.ai/docs/guides/overview/multimodal/image-generation
