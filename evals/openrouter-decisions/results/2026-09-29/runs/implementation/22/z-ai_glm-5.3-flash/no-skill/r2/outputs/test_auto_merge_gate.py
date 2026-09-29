import subprocess

import auto_merge_gate as gate


def test_breaking_change_blocks_merge():
    result = gate.classify("Remove field", "BREAKING CHANGE: field removed")
    assert result.gate_auto_merge
    assert result.decision == "breaking"


def test_clear_non_breaking_change_allows_merge():
    result = gate.classify("Docs", "Added release notes. This is not a breaking change.")
    assert not result.gate_auto_merge
    assert result.decision == "not-breaking"


def test_missing_description_blocks_merge():
    result = gate.classify("Patch", "")
    assert result.gate_auto_merge
    assert result.decision == "unclear"


def test_question_is_rendered():
    question = gate.render_question("Patch", "No incompatible impact.")
    assert "Does the pull request description state" in question


def test_cli_exit_codes():
    breaking = subprocess.run(
        ["./auto_merge_gate.py", "--title", "Patch"], input="BREAKING CHANGE", text=True
    )
    safe = subprocess.run(
        ["./auto_merge_gate.py", "--title", "Patch"], input="Not a breaking change", text=True
    )
    assert breaking.returncode == 1
    assert safe.returncode == 0
