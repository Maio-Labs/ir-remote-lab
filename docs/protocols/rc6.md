# Philips RC6 (mode 0)

Status: not implemented. Listed in `src/irlab.c` without an encoder or a decoder.

- Carrier: 36 kHz.
- Encoding: bi-phase (Manchester) with a 444 µs half-bit, so a normal bit is 889 µs.
  **The opposite of RC5:** a 1 is a mark then a space, a 0 is a space then a mark.
- Bit order: most significant bit first.

## Frame

| Part | Duration or size |
|---|---|
| Leader | 2666 µs mark, 889 µs space |
| Start bit | 1, a normal bit |
| Mode | 3 bits, 000 for mode 0 |
| Trailer (toggle) | 1 bit, **twice as long**: each half is 889 µs |
| Address | 8 bits |
| Command | 8 bits |

After the frame the line stays idle for at least 2666 µs.

The double-length trailer bit is the hard part: a decoder that assumes every half-bit is 444 µs gets
out of step there. Plan the decoder before writing it.
