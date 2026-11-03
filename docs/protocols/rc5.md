# Philips RC5

Status: implemented in `src/protocols/rc5.c`.

- Carrier: 36 kHz.
- Encoding: bi-phase (Manchester). Each bit is 1778 µs, split into two halves of 889 µs.
  A 1 is a space then a mark. A 0 is a mark then a space.
- Bit order: most significant bit first.

## Frame

| Bits | Meaning |
|---|---|
| 2 | Start bits, both 1 |
| 1 | Toggle: flips on every new key press, stays the same while a key is held |
| 5 | Address (0 to 31) |
| 6 | Command (0 to 63) |

A frame is 14 bits, about 24.9 ms. While a key is held, the frame repeats every 114 ms.

## Things to know when decoding

- The first half of the first start bit is a space, so it is never transmitted. A signal starts on the mark in the middle of that bit.
- When the last bit is 0, its second half is a space, so it is not transmitted either. A signal always ends on a mark.
- Two equal halves next to each other merge into one long duration (1778 µs).

## RC5X

RC5X reuses the second start bit as an inverted command bit 6, which gives commands 0 to 127.
A second start bit of 0 means a command of 64 or more. Not implemented yet.
