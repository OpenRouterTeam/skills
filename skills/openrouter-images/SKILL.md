---
name: openrouter-images
description: Generate and edit images with OpenRouter's dedicated Images API. Use for requests to create images, illustrations, pictures, blog/social artwork, or modify an existing image; also use when selecting an image model or checking image-model capabilities. Do not use for conceptual questions about image-generation theory or for merely analyzing an image.
---

# OpenRouter Images

**UTILITY SKILL** — invoke the bundled scripts for image operations. They target `POST /api/v1/images` and parse `data[].b64_json`; do not route image work through Chat Completions or Responses.

## Triggers

**USE FOR:** “generate an image,” “make an illustration,” “create a hero image,” “edit this photo,” or “which image model supports this option?”

**DO NOT USE FOR:** image-generation theory or analyzing/describing an existing image without modification.

## Route the request

- Model/capability question → `npx tsx scripts/discover.ts [author/model]`
- New image → `npx tsx scripts/generate.ts "prompt" [flags]`
- Existing-image change → `npx tsx scripts/edit.ts <image-path> "prompt" [flags]`

Run commands from this skill directory. Install script dependencies once with `cd scripts && npm install`. Discovery is public; generation and editing require `OPENROUTER_API_KEY`.

Before using a non-default model or specialized option, run `discover.ts <model>`. Only send parameters listed for a serving endpoint. For editing, choose a model whose input modalities include `image`.

## Examples


```bash
npx tsx scripts/generate.ts "quiet home office in natural light" --aspect-ratio 16:9
npx tsx scripts/edit.ts photo.png "make the sky purple" --output edited.png
npx tsx scripts/discover.ts google/gemini-3.1-flash-image-preview
```

Afterward, present every saved image and report its path, model, source image for edits, and API-reported cost. See [references/images-api.md](references/images-api.md) for response shapes, discovery fields, options, and troubleshooting.
