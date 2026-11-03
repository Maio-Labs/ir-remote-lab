# IR Remote Lab

A small C library that encodes and decodes infrared remote-control signals, a visual remote in the
browser that drives it, and a Token Lab that shows how agent tools change what an agent reads.

It is a training project: small enough to understand in a day, real enough to plan, test, review and
extend with a coding agent. [ROADMAP.md](ROADMAP.md) lists work that is not done yet.

## Quick start

```bash
make          # build the library, the irlab tool and the tests
make test     # run the C and Python tests
make run      # start the web app on http://127.0.0.1:8000
```

Needs a C compiler, `make`, Python 3.8 or later and `git`. No other dependencies.

## Setup

### macOS

```bash
xcode-select --install
```

This installs `clang`, `make` and `git`. macOS already has Python 3.

### Windows: use WSL2

In PowerShell as administrator, then restart:

```powershell
wsl --install -d Ubuntu-24.04
```

In the Ubuntu terminal:

```bash
sudo apt update && sudo apt install -y build-essential python3 git
```

- Clone the project in your Linux home (`~/`), not under `/mnt/c`. File access across the Windows
  boundary is slow and breaks file watching.
- `make run` inside WSL is reachable from the Windows browser at http://127.0.0.1:8000.
- Open the folder in VS Code from the Ubuntu terminal with `code .` (needs the WSL extension).

### Agent tools

| Tool | What it does | Install |
|---|---|---|
| Claude Code | The coding agent | `curl -fsSL https://claude.ai/install.sh \| bash` |
| rtk | Shortens command output before the agent reads it | macOS: `brew install rtk`. Linux and WSL: see https://www.rtk-ai.app |
| graft | Indexes the code so the agent asks instead of reading whole files | `npm install -g @nanonets/graft` (needs Node.js 20 or later) |

After installing graft, run `graft build` once in this folder to create the index.

## What is in the project

```
include/irlab.h       public API
src/                  signal helpers and the protocol registry
src/protocols/        one file per protocol
src/cli/              the irlab command-line tool, prints JSON
tests/                C tests
web/server.py         local web server and JSON API
web/duels.json        the Token Lab duels
web/static/           the remote and Token Lab pages
docs/protocols/       how each protocol works
```

## The irlab tool

```bash
./build/irlab protocols
./build/irlab encode nec 4 21
./build/irlab decode auto 9000 4500 562 1687 562 562 ...
```

A signal is a list of durations in microseconds that alternate mark (carrier on) and space
(carrier off), starting with a mark.

## Protocols

| Protocol | Encoding | Carrier | Status |
|---|---|---|---|
| NEC | pulse distance | 38 kHz | implemented |
| Philips RC5 | bi-phase | 36 kHz | implemented |
| Sony SIRC 12-bit | pulse width | 40 kHz | not implemented |
| Samsung32 | pulse distance | 38 kHz | not implemented |
| Philips RC6 mode 0 | bi-phase | 36 kHz | not implemented |

Each one is described in [docs/protocols](docs/protocols).

## The web app

- **Remote** (`/`): press a key, watch the signal fly to the TV, see the waveform with its fields,
  and compare what was sent with what the receiver decoded. The jitter slider adds receiver noise.
- **Token lab** (`/tokens.html`):
  - *Duels* run the same question as a plain command and with rtk or graft, and measure the text
    each returns. Tokens are estimated as characters ÷ 4. The commands live in `web/duels.json`.
    Not every duel is a win: measure, do not assume.
  - *Session replay* reads Claude Code transcripts for this folder from `~/.claude/projects/` and
    replays two sessions side by side, turn by turn, with their real token usage.
