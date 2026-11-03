# Samsung32

Status: not implemented. Listed in `src/irlab.c` without an encoder or a decoder.

Samsung32 is close to NEC. The differences:

| | NEC | Samsung32 |
|---|---|---|
| Leader | 9000 µs mark, 4500 µs space | 4500 µs mark, 4500 µs space |
| Second byte | Address inverse | The address again, not inverted |

Everything else is the same as NEC: 38 kHz carrier, 562 µs marks, 562 µs space for 0 and 1687 µs space for 1,
least significant bit first, command and command inverse, a 562 µs stop mark. See [nec.md](nec.md).

`irlab_decode` tries every implemented protocol in turn, so make sure the NEC decoder rejects a Samsung32
signal and the other way round. The leader mark tells them apart.
