# Sony SIRC

Status: not implemented. Listed in `src/irlab.c` without an encoder or a decoder.

- Carrier: 40 kHz.
- Encoding: pulse width. The length of the mark carries the value: 1200 µs for 1, 600 µs for 0.
  Every mark is followed by a 600 µs space.
- Bit order: least significant bit first.

## Frame

| Part | Duration |
|---|---|
| Leader | 2400 µs mark, 600 µs space |
| Command | 7 bits |
| Address | 5 bits (12-bit version), 8 bits (15-bit version) |
| Extended | 8 more bits (20-bit version only) |

Sony remotes send each frame at least three times, one every 45 ms measured from the start of one frame
to the start of the next. The last space of a frame merges into the gap before the next one.

Start with the 12-bit version: 7 command bits and 5 address bits.
