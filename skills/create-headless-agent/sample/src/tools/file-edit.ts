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
      // Show each substitution as a self-contained -/+ block. Positional
      // line-by-line diffs lie when an edit inserts or deletes lines — this
      // approach is always correct because it reflects exactly what changed.
      const diffParts: string[] = [`--- ${path}`, `+++ ${path}`];

      for (const edit of edits) {
        const count = content.split(edit.old_text).length - 1;
        if (count === 0) return { error: `Text not found: "${edit.old_text.slice(0, 50)}"` };
        if (count > 1) return { error: `Ambiguous match (${count} occurrences): "${edit.old_text.slice(0, 50)}"` };
        // Use indexOf + slice instead of String.replace: `$&`, `$\``, `$'`, `$$`
        // in new_text would otherwise be expanded as substitution patterns.
        const idx = content.indexOf(edit.old_text);
        content = content.slice(0, idx) + edit.new_text + content.slice(idx + edit.old_text.length);

        diffParts.push('@@ edit @@');
        for (const line of edit.old_text.split('\n')) diffParts.push(`-${line}`);
        for (const line of edit.new_text.split('\n')) diffParts.push(`+${line}`);
      }

      await Bun.write(path, content);
      return { edited: true, path, edits: edits.length, diff: diffParts.join('\n') };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});
