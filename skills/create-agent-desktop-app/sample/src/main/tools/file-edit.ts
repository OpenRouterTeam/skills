import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';

export const fileEditTool = tool({
  name: 'file_edit',
  description: 'Apply search-and-replace edits to a file, returning a diff',
  inputSchema: z.object({
    path: z.string(),
    edits: z.array(
      z.object({
        old_text: z.string().describe('Exact text to find. Must appear exactly once.'),
        new_text: z.string().describe('Replacement text'),
      }),
    ),
  }),
  execute: async ({ path, edits }) => {
    try {
      const original = await readFile(path, 'utf-8');
      let content = original;
      for (const { old_text, new_text } of edits) {
        const count = content.split(old_text).length - 1;
        if (count === 0) return { error: `old_text not found: ${old_text.slice(0, 60)}…` };
        if (count > 1) return { error: `old_text is ambiguous (${count} matches): ${old_text.slice(0, 60)}…` };
        content = content.replace(old_text, new_text);
      }
      await writeFile(path, content, 'utf-8');
      return { path, edits: edits.length, diff: makeDiff(path, original, content) };
    } catch (err: any) {
      return { error: err.message };
    }
  },
});

function makeDiff(path: string, a: string, b: string): string {
  const al = a.split('\n');
  const bl = b.split('\n');
  const lines: string[] = [`--- ${path}`, `+++ ${path}`];
  let i = 0;
  let j = 0;
  while (i < al.length || j < bl.length) {
    if (i < al.length && j < bl.length && al[i] === bl[j]) {
      i++;
      j++;
      continue;
    }
    while (i < al.length && (j >= bl.length || al[i] !== bl[j])) {
      lines.push(`- ${al[i]}`);
      i++;
    }
    while (j < bl.length && (i >= al.length || al[i] !== bl[j])) {
      lines.push(`+ ${bl[j]}`);
      j++;
    }
  }
  return lines.join('\n');
}
