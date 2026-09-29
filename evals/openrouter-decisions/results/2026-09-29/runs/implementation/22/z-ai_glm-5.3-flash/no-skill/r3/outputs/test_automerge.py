import json
import subprocess
import tempfile
from pathlib import Path

import automerge


def test_description_declaring_breaking_change_blocks_merge():
    allowed, decision = automerge.should_auto_merge(
        {"description": "This release includes a breaking change to the public API."}
    )
    assert not allowed
    assert decision.is_breaking


def test_non_breaking_description_allows_merge():
    allowed, decision = automerge.should_auto_merge(
        {"body": "Adds a backward-compatible helper function."}
    )
    assert allowed
    assert not decision.is_breaking


def test_question_is_rendered():
    question = automerge.build_question("Refactor internal types.")
    assert "breaking" in question
    assert "Refactor internal types." in question


def test_cli_allows_non_breaking_pull_request():
    with tempfile.NamedTemporaryFile("w", delete=False) as event_file:
        json.dump({"pull_request": {"body": "Documentation fix."}}, event_file)
        path = Path(event_file.name)

    process = subprocess.run(
        ["python", "automerge.py", str(path)], capture_output=True, text=True, check=True
    )
    assert json.loads(process.stdout) == {
        "auto_merge": True,
        "is_breaking": False,
        "reason": "description does not declare a breaking change",
    }
