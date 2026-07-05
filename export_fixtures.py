#!/usr/bin/env python3
"""Export golden fixtures for the app's TypeScript rules engine.

Reuses the independent competition model and synthetic-trip scenario from
verify_workbook.py (the same one used to verify the Excel workbook), so the
app is proven rule-for-rule identical to the spreadsheet.

Usage:  python3 export_fixtures.py   ->  app/fixtures/trip-fixture.json
"""

import json
from pathlib import Path

from verify_workbook import build_scenario, adjustment

HOLES = 18


def main():
    names, start, courses, scores, penalties, model = build_scenario()
    n = len(names)
    rounds = sorted(courses)

    trip = {
        "players": [{"name": nm, "hcap": h} for nm, h in zip(names, start)],
        "rounds": [
            {
                "course": {
                    "name": f"Course {r}",
                    "pars": courses[r][0],
                    "sis": courses[r][1],
                },
                "cards": [scores.get(r, {}).get(p) for p in range(n)],
                "penalties": [penalties.get(r, {}).get(p, 0) for p in range(n)],
            }
            for r in rounds
        ],
    }
    expected = {
        "hcInto": [[model.hc[(r, p)] for p in range(n)] for r in rounds],
        "daily": [[model.daily[(r, p)] for p in range(n)] for r in rounds],
        "pts": [[model.pts[(r, p)] for p in range(n)] for r in rounds],
        "raw": [[model.raw[(r, p)] for p in range(n)] for r in rounds],
        "played": [[model.played[(r, p)] for p in range(n)] for r in rounds],
        "avg": [model.avg[r] for r in rounds],
        "net": [[model.net[(r, p)] for p in range(n)] for r in rounds],
        "key": [[model.key[(r, p)] for p in range(n)] for r in rounds],
        "pos": [[model.pos[(r, p)] for p in range(n)] for r in rounds],
        "endHc": [model.hc[(max(rounds) + 1, p)] for p in range(n)],
        "totals": [model.total(p) for p in range(n)],
        "overallPos": [model.overall_pos(p) for p in range(n)],
        "adjTable": {str(m): [adjustment(pos, m) for pos in range(1, m + 1)]
                     for m in (2, 5, 8, 12, 15, 16, 24, 32)},
    }

    out = Path(__file__).parent / "app" / "fixtures" / "trip-fixture.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"trip": trip, "expected": expected}, indent=1))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
