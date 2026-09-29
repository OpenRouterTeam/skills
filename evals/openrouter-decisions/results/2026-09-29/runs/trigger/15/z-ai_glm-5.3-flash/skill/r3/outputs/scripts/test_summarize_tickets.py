import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import summarize_tickets


def test_loads_and_identifies_pending(tmp_path):
    path = tmp_path / "tickets.json"
    path.write_text(json.dumps([{"id": "1", "subject": "Login broken"}, {"id": "2", "summary": "done"}]))
    tickets = summarize_tickets.load_tickets(path)
    assert summarize_tickets.ticket_text(tickets[0]) == "1\n\nLogin broken"
    assert summarize_tickets.ticket_text({"body": "x"}) == "x"
