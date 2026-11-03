"""Read Claude Code session transcripts so the Token Lab can replay them.

Claude Code keeps one JSONL file per session in ~/.claude/projects/<folder>/,
where <folder> is the working directory with every character that is not a
letter or a digit replaced by "-". Each line is one event: a user message,
an assistant message (with token usage) or a tool result.
"""
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

CHARS_PER_TOKEN = 4
SESSION_ID = re.compile(r"^[A-Za-z0-9-]+$")


def estimate_tokens(chars):
    return (chars + CHARS_PER_TOKEN - 1) // CHARS_PER_TOKEN


def projects_dir():
    base = os.environ.get("CLAUDE_CONFIG_DIR") or Path.home() / ".claude"
    return Path(base) / "projects"


def project_folder(root):
    return projects_dir() / re.sub(r"[^A-Za-z0-9]", "-", os.path.abspath(str(root)))


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(item.get("text", "") for item in content if isinstance(item, dict))
    return ""


def describe(name, tool_input):
    """A short label for a tool call, such as the command or the file name."""
    if not isinstance(tool_input, dict):
        return name
    for key in ("command", "file_path", "pattern", "path", "query", "url", "prompt"):
        value = tool_input.get(key)
        if isinstance(value, str) and value:
            if key == "file_path":
                value = Path(value).name
            return value.splitlines()[0][:80]
    return name


def parse_lines(lines):
    """Turn transcript lines into a replayable timeline and its totals."""
    timeline = []
    turns = {}
    tool_names = {}

    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except ValueError:
            continue
        if not isinstance(entry, dict) or entry.get("isSidechain"):
            continue

        message = entry.get("message") or {}
        content = message.get("content")

        if entry.get("type") == "assistant":
            # One response is written as several lines that share the message id
            # and repeat the same usage, so count it once.
            key = message.get("id") or entry.get("uuid")
            turn = turns.get(key)
            if turn is None:
                turn = {"kind": "turn", "time": entry.get("timestamp"), "model": message.get("model"),
                        "input": 0, "cache_write": 0, "cache_read": 0, "output": 0, "tools": []}
                turns[key] = turn
                timeline.append(turn)
            usage = message.get("usage") or {}
            turn["input"] = usage.get("input_tokens") or 0
            turn["cache_write"] = usage.get("cache_creation_input_tokens") or 0
            turn["cache_read"] = usage.get("cache_read_input_tokens") or 0
            turn["output"] = max(turn["output"], usage.get("output_tokens") or 0)
            for block in content if isinstance(content, list) else []:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    name = block.get("name", "tool")
                    label = describe(name, block.get("input"))
                    tool_names[block.get("id")] = (name, label)
                    turn["tools"].append({"name": name, "label": label})

        elif entry.get("type") == "user":
            if isinstance(content, str):
                if not entry.get("isMeta") and not content.startswith("<"):
                    timeline.append({"kind": "prompt", "time": entry.get("timestamp"), "text": content[:300]})
                continue
            for block in content if isinstance(content, list) else []:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "tool_result":
                    chars = len(text_of(block.get("content")))
                    name, label = tool_names.get(block.get("tool_use_id"), ("tool", ""))
                    timeline.append({"kind": "result", "time": entry.get("timestamp"), "tool": name,
                                     "label": label, "chars": chars, "tokens": estimate_tokens(chars)})
                elif block.get("type") == "text" and not entry.get("isMeta"):
                    text = block.get("text", "")
                    if text and not text.startswith("<"):
                        timeline.append({"kind": "prompt", "time": entry.get("timestamp"), "text": text[:300]})

    for turn in turns.values():
        turn["context"] = turn["input"] + turn["cache_write"] + turn["cache_read"]
    timeline = [e for e in timeline if e["kind"] != "turn" or e["context"] or e["output"]]
    return {"summary": summarize(timeline), "timeline": timeline}


def summarize(timeline):
    turns = [e for e in timeline if e["kind"] == "turn"]
    results = [e for e in timeline if e["kind"] == "result"]
    prompts = [e for e in timeline if e["kind"] == "prompt"]
    times = [e["time"] for e in timeline if e.get("time")]
    return {
        "turns": len(turns),
        "tool_calls": sum(len(t["tools"]) for t in turns),
        "input_tokens": sum(t["context"] for t in turns),
        "output_tokens": sum(t["output"] for t in turns),
        "peak_context": max((t["context"] for t in turns), default=0),
        "tool_result_tokens": sum(r["tokens"] for r in results),
        "first_prompt": prompts[0]["text"] if prompts else "",
        "model": next((t["model"] for t in turns if t.get("model")), None),
        "started": min(times) if times else None,
        "ended": max(times) if times else None,
    }


def list_sessions(root):
    folder = project_folder(root)
    sessions = []
    if folder.is_dir():
        files = sorted(folder.glob("*.jsonl"), key=lambda f: f.stat().st_mtime, reverse=True)
        for path in files:
            with path.open(encoding="utf-8", errors="replace") as handle:
                summary = parse_lines(handle)["summary"]
            modified = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
            sessions.append({"id": path.stem, "modified": modified, "summary": summary})
    return {"folder": str(folder), "sessions": sessions}


def load_session(root, session_id):
    if not SESSION_ID.match(session_id or ""):
        raise KeyError(session_id)
    path = project_folder(root) / (session_id + ".jsonl")
    if not path.is_file():
        raise KeyError(session_id)
    with path.open(encoding="utf-8", errors="replace") as handle:
        return parse_lines(handle)
