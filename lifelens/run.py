from __future__ import annotations

import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from threading import Thread


ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"


def start_process(command: list[str], cwd: Path, label: str) -> subprocess.Popen:
    return subprocess.Popen(
        command,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )


def stream_output(process: subprocess.Popen, label: str) -> None:
    assert process.stdout is not None
    for line in process.stdout:
        print(f"[{label}] {line}", end="")


def wait_for_backend(url: str, timeout_seconds: int = 25) -> bool:
    started = time.time()
    while time.time() - started < timeout_seconds:
        try:
            with urllib.request.urlopen(url, timeout=1.5) as response:
                if 200 <= response.status < 500:
                    return True
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(0.5)
    return False


def main() -> int:
    npm_executable = shutil.which("npm")
    if npm_executable is None:
        print("npm was not found on PATH. Install Node.js first.")
        return 1

    node_modules = FRONTEND / "node_modules"
    if not node_modules.exists():
        print("Installing frontend dependencies...")
        install_process = subprocess.run(
            [npm_executable, "install"],
            cwd=str(FRONTEND),
            check=False,
        )
        if install_process.returncode != 0:
            return install_process.returncode

    backend_command = [sys.executable, "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"]
    frontend_command = [npm_executable, "run", "dev"]

    print("Starting LifeLens backend on http://localhost:8000")
    backend_process = start_process(backend_command, ROOT, "backend")

    print("Waiting for backend health check...")
    if not wait_for_backend("http://127.0.0.1:8000/api/health"):
        print("Backend did not become ready in time. Stopping startup.")
        if backend_process.poll() is None:
            backend_process.terminate()
        return 1

    print("Starting LifeLens frontend on http://localhost:5173")
    frontend_process = start_process(frontend_command, FRONTEND, "frontend")

    try:
        threads = [
            Thread(target=stream_output, args=(backend_process, "backend"), daemon=True),
            Thread(target=stream_output, args=(frontend_process, "frontend"), daemon=True),
        ]
        for thread in threads:
            thread.start()

        backend_code = backend_process.wait()
        frontend_code = frontend_process.wait()
        return backend_code or frontend_code
    except KeyboardInterrupt:
        print("\nStopping LifeLens...")
        for process in (backend_process, frontend_process):
            if process.poll() is None:
                process.terminate()
        for process in (backend_process, frontend_process):
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
        return 130


if __name__ == "__main__":
    raise SystemExit(main())