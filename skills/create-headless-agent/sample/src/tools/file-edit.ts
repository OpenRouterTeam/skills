import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';

export const fileEditTool = tool({
  name: 'file_edit',
  description: 'Apply search-and-replace edits to a file',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to the file'),
    edits: z.array(z.object({
      old_text: z.string().describe('Text to find (must appear exactly once)'),
      new_text: z.string().describe('Replacement text'),
    })),
  }),
  execute: async ({ path, edits }) => {
    try {
      let content = await Bun.file(path).text();
      const original = content;

      for (const edit of edits) {
        const count = content.split(edit.old_text).length - 1;
        if (count === 0) return { error: `Text not found: "${edit.old_text.slice(0, 50)}"` };
        if (count > 1) return { error: `Ambiguous match (${count} occurrences): "${edit.old_text.slice(0, 50)}"` };
        content = content.replace(edit.old_text, edit.new_text);
      }

      await Bun.write(path, content);

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
