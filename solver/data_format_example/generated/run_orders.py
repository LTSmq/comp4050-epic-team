"""Posts every order in orders/ to the solver, saves each answer in solved/, and
checks the answers against the rules the solver is meant to follow.

The checks are written from scratch here rather than borrowed from the solver,
so a bug in the solver's own rule cannot hide itself. Each solution carries only
positions and sizes; generate_orders.py gives every item type a unique set of
three sides, which is what lets each placed box be traced back to its item
type, its weight and its group.

What is checked, per order:
  every unit is accounted for, packed or left over, and nothing is invented
  leftovers are only items that could not have fitted, or the supply ran out
  no item pokes outside its carton, and no two items overlap
  every item off the floor stands on at least 80% of its base
  no carton is over its weight limit, counting the carton's own weight
  no carton mixes groups, with untagged items counted as a group of their own
  no carton type is used more than its MaximumBoxes, and inactive ones never

Start the solver first, then:

    python3 run_orders.py                       # uses http://localhost:8080/solve
    python3 run_orders.py http://host:port/solve
"""

import json
import math
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ORDERS = HERE / "orders"
SOLVED = HERE / "solved"

MIN_SUPPORT = 0.8
WEIGHT_TOLERANCE = 1e-4


def sides(w, l, d):
    return tuple(sorted((w, l, d)))


def post(url, order):
    body = json.dumps(order).encode()
    request = urllib.request.Request(url, body, {"Content-Type": "application/json"})
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(request, timeout=300) as reply:
            status, text = reply.status, reply.read().decode()
    except urllib.error.HTTPError as error:
        status, text = error.code, error.read().decode()
    return status, text, (time.perf_counter() - started) * 1000


def could_ever_fit(item, boxes):
    """True if some active carton could hold this item alone, by size and weight."""
    need = sides(item["Width"], item["Length"], item["Depth"])
    for b in boxes:
        if not b["Active"]:
            continue
        room = sides(b["Width"], b["Length"], b["Depth"])
        if any(n > r for n, r in zip(need, room)):
            continue
        if b["MaxWeight"] is not None:
            if item["Weight"] + (b["BoxWeight"] or 0) > b["MaxWeight"] + WEIGHT_TOLERANCE:
                continue
        return True
    return False


def overlap(a0, a1, b0, b1):
    return max(0, min(a1, b1) - max(a0, b0))


def check(order, solution):
    problems = []
    boxes = order["boxTypes"]
    by_sides = {}
    for item in order["items"]:
        by_sides[sides(item["Width"], item["Length"], item["Depth"])] = item

    ordered = Counter(item["ItemCode"] for item in order["items"])
    placed = Counter()
    used_types = Counter()
    carton_rows = []

    for index, pkg in enumerate(solution["packages"]):
        size = pkg["size"]
        matches = [b for b in boxes if (b["Width"], b["Length"], b["Depth"]) == (size["x"], size["y"], size["z"])]
        if not matches:
            problems.append(f"carton #{index} is {size['x']}x{size['y']}x{size['z']}, which is no carton type")
            continue
        btype = matches[0]
        used_types[btype["Reference"]] += 1
        if not btype["Active"]:
            problems.append(f"carton #{index} is {btype['Reference']}, which is inactive")

        units = []
        for it in pkg["items"]:
            p, s = it["position"], it["size"]
            item = by_sides.get(sides(s["x"], s["y"], s["z"]))
            if item is None:
                problems.append(f"carton #{index} holds a {s['x']}x{s['y']}x{s['z']} item nobody ordered")
                continue
            placed[item["ItemCode"]] += 1
            units.append((p["x"], p["y"], p["z"], s["x"], s["y"], s["z"], item))

        for x, y, z, w, l, d, item in units:
            if x + w > size["x"] or y + l > size["y"] or z + d > size["z"]:
                problems.append(f"carton #{index}: {item['ItemCode']} at ({x},{y},{z}) pokes outside the carton")

        for i in range(len(units)):
            for j in range(i + 1, len(units)):
                a, b = units[i], units[j]
                if (overlap(a[0], a[0] + a[3], b[0], b[0] + b[3])
                        and overlap(a[1], a[1] + a[4], b[1], b[1] + b[4])
                        and overlap(a[2], a[2] + a[5], b[2], b[2] + b[5])):
                    problems.append(f"carton #{index}: {a[6]['ItemCode']} and {b[6]['ItemCode']} overlap")

        floating = 0
        for x, y, z, w, l, d, item in units:
            if z == 0:
                continue
            under = sum(
                overlap(x, x + w, ox, ox + ow) * overlap(y, y + l, oy, oy + ol)
                for ox, oy, oz, ow, ol, od, _ in units if oz + od == z
            )
            ratio = under / (w * l)
            if ratio < MIN_SUPPORT - 1e-9:
                floating += 1
                problems.append(f"carton #{index}: {item['ItemCode']} at height {z} stands on only {ratio:.0%} of its base")

        gross = sum(u[6]["Weight"] for u in units) + (btype["BoxWeight"] or 0)
        if btype["MaxWeight"] is not None and gross > btype["MaxWeight"] + WEIGHT_TOLERANCE:
            problems.append(f"carton #{index} ({btype['Reference']}) weighs {gross:.2f} kg, over its {btype['MaxWeight']} kg limit")

        groups = {u[6]["BoxGroup"] or "(untagged)" for u in units}
        if len(groups) > 1:
            problems.append(f"carton #{index} mixes groups: {', '.join(sorted(groups))}")

        filled = sum(u[3] * u[4] * u[5] for u in units)
        capacity = size["x"] * size["y"] * size["z"]
        carton_rows.append({
            "index": index, "type": btype["Reference"], "units": len(units),
            "fill": filled / capacity, "gross": gross, "max": btype["MaxWeight"],
            "groups": sorted(groups), "floating": floating,
        })

    for b in boxes:
        cap = b["MaximumBoxes"]
        if cap is not None and used_types[b["Reference"]] > cap:
            problems.append(f"{b['Reference']} used {used_types[b['Reference']]} times, over its cap of {cap}")

    for code, count in placed.items():
        if count > ordered[code]:
            problems.append(f"{count} units of {code} placed but only {ordered[code]} ordered")

    unpacked = {code: ordered[code] - placed[code] for code in ordered if ordered[code] > placed[code]}
    first_of = {item["ItemCode"]: item for item in order["items"]}
    impossible = {code for code in unpacked if not could_ever_fit(first_of[code], boxes)}
    capped = any(b["MaximumBoxes"] is not None for b in boxes)
    for code, count in unpacked.items():
        if code in impossible:
            continue
        reason = "possibly because carton supply ran out" if capped else "though a carton could hold it"
        problems.append(f"{count} unit(s) of {code} left unpacked, {reason}")

    active = [b for b in boxes if b["Active"]]
    packable = [i for i in order["items"] if could_ever_fit(i, boxes)]
    total_volume = sum(i["Width"] * i["Length"] * i["Depth"] for i in packable)
    biggest = max(b["Width"] * b["Length"] * b["Depth"] for b in active)
    # No packing can beat either of these: the items' volume over the largest
    # carton's, or their weight over the largest payload any carton allows.
    lower_bound = math.ceil(total_volume / biggest) if packable else 0
    payloads = [b["MaxWeight"] - (b["BoxWeight"] or 0) for b in active if b["MaxWeight"] is not None]
    if packable and len(payloads) == len(active):
        total_weight = sum(i["Weight"] for i in packable)
        lower_bound = max(lower_bound, math.ceil(total_weight / max(payloads) - 1e-9))

    return {
        "problems": problems,
        "cartons": carton_rows,
        "used_types": dict(used_types),
        "units_ordered": sum(ordered.values()),
        "units_placed": sum(placed.values()),
        "unpacked": unpacked,
        "expected_unpacked": sorted(impossible),
        "lower_bound": lower_bound,
    }


def main():
    url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080/solve"
    SOLVED.mkdir(exist_ok=True)
    summary = []
    lines = ["# Generated order results", "", f"Solved against `{url}`.", ""]

    for path in sorted(ORDERS.glob("*.json")):
        order = json.loads(path.read_text())
        try:
            status, text, ms = post(url, order)
        except urllib.error.URLError as error:
            sys.exit(f"could not reach {url}: {error.reason}. Is the solver running?")

        if status != 200:
            print(f"{order['id']}: HTTP {status} {text}")
            lines += [f"## {order['id']}", "", f"HTTP {status}: `{text}`", ""]
            summary.append({"id": order["id"], "status": status})
            continue

        solution = json.loads(text)
        (SOLVED / path.name).write_text(json.dumps(solution, indent=2) + "\n")
        result = check(order, solution)
        cartons = result["cartons"]
        avg_fill = sum(c["fill"] for c in cartons) / len(cartons) if cartons else 0
        verdict = "PASS" if not result["problems"] else f"{len(result['problems'])} problem(s)"

        print(f"{order['id']}: {len(cartons)} cartons, {result['units_placed']}/{result['units_ordered']} "
              f"units, {avg_fill:.0%} avg fill, {ms:.0f} ms, {verdict}")

        lines += [
            f"## {order['id']}: {verdict}", "",
            "| | |", "| --- | --- |",
            f"| Units placed | {result['units_placed']} of {result['units_ordered']} |",
            f"| Cartons | {len(cartons)} (lower bound {result['lower_bound']}, by volume or weight) |",
            f"| Carton types used | {', '.join(f'{k} x{v}' for k, v in sorted(result['used_types'].items()))} |",
            f"| Average fill | {avg_fill:.0%} |",
            f"| Solve time | {ms:.0f} ms |",
            f"| Unpacked | {', '.join(f'{k} x{v}' for k, v in sorted(result['unpacked'].items())) or 'none'} |",
            f"| Expected to be unpackable | {', '.join(result['expected_unpacked']) or 'none'} |",
            "",
        ]
        if result["problems"]:
            lines += ["Problems:", ""] + [f"- {p}" for p in result["problems"]] + [""]
        lines += ["| # | Type | Units | Fill | Weight | Groups |", "| --- | --- | --- | --- | --- | --- |"]
        for c in cartons:
            limit = f" / {c['max']}" if c["max"] is not None else ""
            lines.append(f"| {c['index']} | {c['type']} | {c['units']} | {c['fill']:.0%} | "
                         f"{c['gross']:.1f}{limit} kg | {', '.join(c['groups'])} |")
        lines.append("")

        summary.append({"id": order["id"], "status": 200, "cartons": len(cartons),
                        "lower_bound": result["lower_bound"],
                        "units_placed": result["units_placed"], "units_ordered": result["units_ordered"],
                        "average_fill": round(avg_fill, 3), "solve_ms": round(ms),
                        "unpacked": result["unpacked"], "problems": result["problems"]})

    (HERE / "report.md").write_text("\n".join(lines))
    (HERE / "report.json").write_text(json.dumps(summary, indent=2) + "\n")
    print("wrote report.md, report.json and solved/")


if __name__ == "__main__":
    main()
