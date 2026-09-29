"""Run bundled Decisions tooling against the saved example cases.

Usage: python classification/probe.py /path/to/installed/scripts [--compare]
Requires OPENROUTER_API_KEY in the environment; never writes it to results.
"""
import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("tools", type=Path)
parser.add_argument("--compare", action="store_true")
args = parser.parse_args()
root = Path(__file__).resolve().parent
config = json.loads((root / "config.json").read_text())
request = json.loads((root / "request.json").read_text())
cases = json.loads((root / "probes.json").read_text())
tool_dir = args.tools.resolve()
command = [str(tool_dir / "node_modules/.bin/tsx"), str(tool_dir / "decide.ts"), "-"]
command += ["--compare"] if args.compare else ["--model", config["model"]]
results = []
for case in cases:
    body = {**request, "state": {"ticket": case["ticket"]}}
    try:
        proc = subprocess.run(command, input=json.dumps(body), text=True,
                              capture_output=True, timeout=60, check=True)
        result = json.loads(proc.stdout)
        if not args.compare and result["model"] != config["model"]:
            raise ValueError("Returned model does not match the configured pin")
        results.append({**case, "results": result if args.compare else [result]})
    except (subprocess.SubprocessError, ValueError, OSError) as error:
        results.append({**case, "error": str(error)})
filename = "comparison-rerun.json" if args.compare else "pinned-results.json"
(root / filename).write_text(json.dumps(results, indent=2) + "\n")
errors = sum("error" in case or any("error" in r for r in case.get("results", []))
             for case in results)
print(f"Saved {len(results)} cases to {root / filename}; {errors} cases had errors.")
raise SystemExit(1 if errors else 0)
