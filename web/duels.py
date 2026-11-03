"""Token Lab duels: one question answered with and without rtk or graft.

Each duel runs two fixed commands from duels.json in the repository root and
measures how much text each returns, which is what an agent would read into
its context. Only the commands listed in duels.json are ever run.
"""
import json
import shutil
import subprocess
import time
from pathlib import Path

from sessions import estimate_tokens

OUTPUT_LIMIT = 20000


def load(root):
    with (Path(root) / "web" / "duels.json").open(encoding="utf-8") as handle:
        return json.load(handle)


def availability(root, side):
    """Why a side cannot run yet, or None when it can."""
    tool = side.get("requires")
    if tool and shutil.which(tool) is None:
        return tool + " is not installed"
    if tool == "graft" and not (Path(root) / "graft").is_dir():
        return "no graft index yet: run graft build"
    return None


def list_duels(root):
    duels = []
    for duel in load(root):
        entry = dict(duel)
        for side in ("baseline", "tool"):
            entry[side] = dict(duel[side], missing=availability(root, duel[side]))
        duels.append(entry)
    return {"duels": duels}


def measure(root, side):
    missing = availability(root, side)
    if missing:
        return {"command": side["command"], "missing": missing}

    started = time.monotonic()
    try:
        result = subprocess.run(side["command"], shell=True, cwd=str(root), capture_output=True,
                                text=True, errors="replace", timeout=60)
        output, exit_code = result.stdout + result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        output, exit_code = "timed out after 60 s", -1
    elapsed_ms = int((time.monotonic() - started) * 1000)

    return {
        "command": side["command"],
        "chars": len(output),
        "lines": output.count("\n"),
        "tokens": estimate_tokens(len(output)),
        "ms": elapsed_ms,
        "exit_code": exit_code,
        "output": output[:OUTPUT_LIMIT],
        "truncated": len(output) > OUTPUT_LIMIT,
    }


def run_duel(root, duel_id):
    for duel in load(root):
        if duel["id"] == duel_id:
            return {"id": duel_id, "baseline": measure(root, duel["baseline"]),
                    "tool": measure(root, duel["tool"])}
    raise KeyError(duel_id)
