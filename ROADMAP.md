# Roadmap

Work that is not done yet. Each item is sized to hand to a coding agent: read the item, plan,
then build it with tests. "Done when" is the acceptance check.

Sizes: **S** is under an hour with an agent, **M** is a few hours, **L** is a day or more.

## Protocols

### R1. Sony SIRC 12-bit · S
Add `src/protocols/sirc.c` and connect it in `src/irlab.c`. See [docs/protocols/sirc.md](docs/protocols/sirc.md).
- Done when: encode and decode round-trip for all 5-bit addresses and 7-bit commands, a reference
  frame matches hand-computed durations, `irlab_decode` detects it, and the SIRC button on the remote unlocks.

### R2. Samsung32 · S
See [docs/protocols/samsung.md](docs/protocols/samsung.md).
- Done when: round-trip tests pass, NEC and Samsung32 signals are never confused by auto-detect,
  and the remote can send it.

### R3. NEC repeat codes and extended NEC · S
See [docs/protocols/nec.md](docs/protocols/nec.md).
- Done when: holding a key on the remote sends one frame then repeat codes, the decoder reports a
  repeat, and a 16-bit extended address round-trips.

### R4. Philips RC6 mode 0 · M
See [docs/protocols/rc6.md](docs/protocols/rc6.md). The double-length trailer bit makes this one worth planning first.
- Done when: round-trip tests cover both toggle values and all bit patterns at the edges
  (address and command 0x00 and 0xFF), and RC5 and RC6 signals are never confused.

### R5. RC5X commands 64 to 127 · S
See [docs/protocols/rc5.md](docs/protocols/rc5.md).
- Done when: commands 0 to 127 round-trip and the second start bit carries command bit 6.

### R6. SIRC 15-bit and 20-bit · S
After R1.
- Done when: the decoder tells the three lengths apart from the number of bits received.

## Decoding real signals

### R7. Decode a stream of frames · M
Real captures hold several frames and the gaps between them. Today the decoder expects exactly one frame.
- Done when: `irlab decode` accepts a capture with repeats and gaps, and returns every frame with its start time.

### R8. Say why a signal did not match · M
Today a failed decode only says "does not match".
- Done when: the decoder reports the closest protocol and the first duration that fell outside the
  tolerance, and the Receiver panel shows it on the waveform.

### R9. A realistic receiver · M
IR receiver modules stretch marks and shorten spaces by about 100 µs, which is different from random jitter.
- Done when: the noise panel has a "real receiver" mode and every implemented protocol still decodes with it.

## Working with other tools

### R10. Pronto hex import and export · M
Pronto hex is how remote-code databases share signals.
- Done when: `irlab` converts between Pronto hex and durations, and the remote page can paste a Pronto code.

### R11. Upload a raw capture · S
- Done when: the noise panel accepts a text file of durations, with or without +/- signs, and decodes it.

### R12. Export for microcontroller libraries · S
- Done when: a sent key can be copied as an Arduino IRremote call and as an ESPHome `remote_transmitter` action.

### R13. Keymaps and learning mode · M
The remote's keymap lives in `web/static/remote.js`.
- Done when: keymaps are JSON files per device, and a learning mode captures an unknown code and lets you name it.

## Quality and delivery

### R14. `make lint` and `make check` · S
- Done when: `make lint` runs a static analyser (clang-tidy or cppcheck) and `make check` builds and runs
  the tests with AddressSanitizer and UndefinedBehaviorSanitizer, and both fail the build on a finding.

### R15. Fuzz the decoders · M
- Done when: a fuzz target feeds random durations to `irlab_decode`, runs for 5 minutes without a crash,
  and is documented in the README.

### R16. End-to-end test of the remote page · M
- Done when: a browser test (Playwright) presses keys for each protocol and checks the Receiver panel
  and the TV, and `make e2e` runs it.

### R17. CI pipeline · S
- Done when: every merge request builds, runs `make test` and `make lint`, and a failing test blocks the merge.

### R18. Pre-commit hook · S
- Done when: a commit runs the C tests first and stops when one fails.

## The web app

### R19. Zoom into the carrier · S
- Done when: zooming the waveform shows the carrier cycles inside a mark at the protocol's real frequency.

### R20. Run in the browser without the server · M
- Done when: the library builds to WebAssembly and the remote page works from a static file.

### R21. Record Token Lab sessions automatically · M
- Done when: one command runs the same question twice with `claude -p`, once with rtk and graft and once
  without, and both sessions appear in the session replay.

### R22. Cost view in the Token Lab · S
- Done when: the replay shows an estimated cost per session from model prices kept in one config file,
  with cached input priced separately.

## Firmware

### R23. Run the library on a microcontroller · L
- Done when: the library builds for an ESP32 behind a small hardware layer that drives the RMT peripheral,
  the host tests still pass, and a real IR receiver decodes what the board sends.
