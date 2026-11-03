# NEC

Status: implemented in `src/protocols/nec.c`.

- Carrier: 38 kHz.
- Encoding: pulse distance. Every bit is a 562 µs mark. The space after it carries the value: 562 µs for 0, 1687 µs for 1.
- Bit order: least significant bit first.

## Frame

| Part | Duration |
|---|---|
| Leader | 9000 µs mark, 4500 µs space |
| Address | 8 bits |
| Address inverse | 8 bits, every bit of the address flipped |
| Command | 8 bits |
| Command inverse | 8 bits, every bit of the command flipped |
| Stop | 562 µs mark |

A frame is 67 durations and about 67.5 ms long. The two inverse bytes let a receiver reject a corrupted frame.

## Repeat code

While a key is held, the remote does not resend the frame. Every 108 ms it sends a repeat code:
9000 µs mark, 2250 µs space, 562 µs mark. Not implemented yet.

## Extended NEC

Many manufacturers use the address inverse byte as a second address byte, which gives a 16-bit address.
The decoder then must not check the address inverse. Not implemented yet.
