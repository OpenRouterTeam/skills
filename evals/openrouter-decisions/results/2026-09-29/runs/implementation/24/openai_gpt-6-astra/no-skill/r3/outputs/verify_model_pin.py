"""Read-only catalog check; no API key or paid inference required."""

import json
from pathlib import Path
from urllib.request import urlopen


def fetch(url):
    with urlopen(url, timeout=30) as response:
        return json.load(response)["data"]


def main():
    config = json.loads(
        Path(__file__).with_name("classification.config.json").read_text()
    )
    request = config["request"]
    model_id = request["model"]
    expected = config["pin"]["expected_canonical_slug"]
    model = next(
        (entry for entry in fetch(config["gateway"] + "/models")
         if entry["id"] == model_id),
        None,
    )
    if model is None or model.get("canonical_slug") != expected:
        raise SystemExit("BLOCKED: model missing or canonical model pin changed")
    routing = request["provider"]
    if (routing.get("only") != ["anthropic"]
            or routing.get("allow_fallbacks") is not False
            or routing.get("require_parameters") is not True):
        raise SystemExit("BLOCKED: provider routing pin changed")
    endpoints = fetch(config["gateway"] + "/models/" + model_id + "/endpoints")
    required = {"temperature", "max_tokens", "response_format", "structured_outputs"}
    if not any(
        endpoint.get("tag") == "anthropic"
        and required.issubset(endpoint.get("supported_parameters", []))
        for endpoint in endpoints["endpoints"]
    ):
        raise SystemExit("BLOCKED: pinned provider lacks required output support")
    print(f"PASS: {model_id} -> {expected}; provider=anthropic; fallbacks=false")
    print("Catalog pin verified. Classification thresholds are NOT validated.")


if __name__ == "__main__":
    main()
