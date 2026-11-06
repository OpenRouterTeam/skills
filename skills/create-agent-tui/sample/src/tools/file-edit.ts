import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';
import { resolveInsideCwd } from './workspace-path.js';

export const fileEditTool = tool({
  name: 'file_edit',
  description: 'Apply search-and-replace edits to a file',
  inputSchema: z.object({
    path: z.string().describe('Path to the file, inside the working directory'),
    edits: z.array(z.object({
      old_text: z.string().describe('Text to find (must appear exactly once)'),
      new_text: z.string().describe('Replacement text'),
    })),
  }),
  execute: async ({ path, edits }) => {
    try {
      const target = await resolveInsideCwd(path);
      let content = await readFile(target, 'utf-8');
      const original = content;

      for (const edit of edits) {
        const count = content.split(edit.old_text).length - 1;
        if (count === 0) return { error: `Text not found: "${edit.old_text.slice(0, 50)}"` };
        if (count > 1) return { error: `Ambiguous match (${count} occurrences): "${edit.old_text.slice(0, 50)}"` };
        // indexOf + slice instead of String.replace, which would expand
        // `$&`, `$\``, `$'` and `$$` in new_text.
        const idx = content.indexOf(edit.old_text);
        content = content.slice(0, idx) + edit.new_text + content.slice(idx + edit.old_text.length);
      }

      await writeFile(target, content, 'utf-8');

      const oldLines = original.split('\n');
      const newLines = content.split('\n');
      const diff = [`--- ${path}`, `+++ ${path}`];
      let i = 0;
      while (i < oldLines.length || i < newLines.length) {
        if (oldLines[i] !== newLines[i]) {
          if (i < oldLines.length) diff.push(`-${oldLines[i]}`);
          if (i < newLines.length) diff.push(`+${newLines[i]}`);
        }
        i++;
      }

      return { edited: true, path, diff: diff.join('\n') };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
