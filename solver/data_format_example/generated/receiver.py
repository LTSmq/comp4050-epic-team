"""A stand-in for the visualiser team's server, for watching solutions arrive live.

The solver pushes each finished solution to whatever VISUALIZER_URL names. A web
page cannot receive a push on its own, so this small server does it on the
page's behalf: it accepts the solver's POST, keeps the solution, saves a copy in
received/, and streams it to every open live.html as a server-sent event.

It also serves live.html itself, and the orders/ and solved/ folders beside it,
so the page can look up the order behind a solution to put names and weights
back on it.

Standard library only. Run it, then start the solver pointed at it:

    python3 receiver.py                     # listens on http://127.0.0.1:3000
    python3 receiver.py --port 3001

    # in solver/
    VISUALIZER_URL=http://127.0.0.1:3000/solutions cargo run

Then open http://127.0.0.1:3000 in a browser.
"""

import argparse
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
RECEIVED = HERE / "received"
SERVED = {"orders", "solved", "received"}

solutions = []
changed = threading.Condition()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # The event stream would otherwise log a line every time a page connects.
        if not self.path.startswith("/events"):
            super().log_message(fmt, *args)

    def send_body(self, status, body, content_type):
        data = body.encode() if isinstance(body, str) else body
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path.rstrip("/") != "/solutions":
            return self.send_body(404, "not found", "text/plain")
        length = int(self.headers.get("Content-Length", 0))
        try:
            solution = json.loads(self.rfile.read(length))
            assert isinstance(solution.get("id"), str) and isinstance(solution.get("packages"), list)
        except (ValueError, AssertionError):
            return self.send_body(422, "expected a solution with an id and packages", "text/plain")

        RECEIVED.mkdir(exist_ok=True)
        safe_name = "".join(c if c.isalnum() or c in "-_." else "_" for c in solution["id"])
        (RECEIVED / f"{safe_name}.json").write_text(json.dumps(solution, indent=2) + "\n")

        with changed:
            solutions.append(solution)
            changed.notify_all()
        print(f"received {solution['id']}: {len(solution['packages'])} cartons", flush=True)
        self.send_body(200, "ok", "text/plain")

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/live.html"):
            return self.send_body(200, (HERE / "live.html").read_bytes(), "text/html; charset=utf-8")
        if path == "/api/orders":
            names = sorted(p.stem for p in (HERE / "orders").glob("*.json"))
            return self.send_body(200, json.dumps(names), "application/json")
        if path == "/events":
            return self.stream()

        # Files from the three data folders, and nothing else on disk.
        parts = path.strip("/").split("/")
        if len(parts) == 2 and parts[0] in SERVED and parts[1].endswith(".json") and ".." not in parts[1]:
            file = HERE / parts[0] / parts[1]
            if file.is_file():
                return self.send_body(200, file.read_bytes(), "application/json")
        self.send_body(404, "not found", "text/plain")

    def stream(self):
        """Sends every solution received so far, then each new one as it lands."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        sent = 0
        try:
            while True:
                with changed:
                    if sent == len(solutions):
                        changed.wait(timeout=15)
                    pending = solutions[sent:]
                    sent = len(solutions)
                if pending:
                    for solution in pending:
                        self.wfile.write(f"data: {json.dumps(solution)}\n\n".encode())
                else:
                    # A comment line, which keeps idle connections from being dropped.
                    self.wfile.write(b": still here\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3000)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.daemon_threads = True
    print(f"live view:        http://{args.host}:{args.port}")
    print(f"solver should use VISUALIZER_URL=http://{args.host}:{args.port}/solutions")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
