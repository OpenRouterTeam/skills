#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// NOTE: Waza runs hooks without a shell, so one TypeScript command handles setup.

function main(): void {
  const skill = process.argv[2];
  if (!skill) {
    console.error("usage: prepare-skill.ts <skill-name>");
    process.exit(2);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..", "..");
  const srcDir = join(repoRoot, "skills", skill);
  if (!existsSync(srcDir)) {
    console.error(`❌ skill source not found: ${srcDir}`);
    process.exit(1);
  }

  const destSkillsRoot = join(homedir(), ".agents", "skills");
  const destDir = join(destSkillsRoot, skill);

  const mk = spawnSync("mkdir", ["-p", destSkillsRoot], { stdio: "inherit" });
  if (mk.status !== 0) {
    process.exit(mk.status ?? 1);
  }

  const sync = spawnSync("rsync", ["-a", "--delete", `${srcDir}/`, `${destDir}/`], {
    stdio: "inherit",
  });
  if (sync.status !== 0) {
    process.exit(sync.status ?? 1);
  }

  const scriptsPkg = join(destDir, "scripts", "package.json");
  if (existsSync(scriptsPkg)) {
    const install = spawnSync("npm", ["install", "--silent"], {
      cwd: join(destDir, "scripts"),
      stdio: "inherit",
    });
    if (install.status !== 0) {
      process.exit(install.status ?? 1);
    }
  }

  console.error(`✓ prepared skill "${skill}" → ${destDir}`);
}

main();
