/*
 * Philips RC5: bi-phase (Manchester) encoding on a 36 kHz carrier.
 * See docs/protocols/rc5.md.
 *
 * Frame: 14 bits sent MSB first, each split into two 889 us halves:
 * two start bits (always 1), a toggle bit that flips on every new key press,
 * 5 address bits and 6 command bits.
 * A 1 is a space followed by a mark; a 0 is a mark followed by a space.
 */
#include "protocols.h"
#include "../signal.h"

#define RC5_CARRIER_HZ 36000
#define RC5_HALF_BIT 889
#define RC5_BITS 14

static irlab_status emit_bit(irlab_signal *signal, int bit)
{
    TRY(irlab_signal_emit(signal, bit ? IRLAB_SPACE : IRLAB_MARK, RC5_HALF_BIT));
    return irlab_signal_emit(signal, bit ? IRLAB_MARK : IRLAB_SPACE, RC5_HALF_BIT);
}

static irlab_status emit_bits(irlab_signal *signal, const char *name, uint32_t value, int bits)
{
    TRY(irlab_signal_begin_field(signal, name));
    for (int bit = bits - 1; bit >= 0; bit--)
        TRY(emit_bit(signal, (value >> bit) & 1));
    irlab_signal_end_field(signal, value, (uint8_t)bits);
    return IRLAB_OK;
}

irlab_status irlab_rc5_encode(const irlab_frame *frame, irlab_signal *out)
{
    uint32_t address = frame->address & 0x1F;
    uint32_t command = frame->command & 0x3F;

    irlab_signal_init(out, RC5_CARRIER_HZ);
    TRY(emit_bits(out, "start", 0x3, 2));
    TRY(emit_bits(out, "toggle", frame->toggle & 1, 1));
    TRY(emit_bits(out, "address", address, 5));
    TRY(emit_bits(out, "command", command, 6));
    irlab_signal_finish(out);
    return IRLAB_OK;
}

irlab_status irlab_rc5_decode(const irlab_signal *signal, irlab_frame *out)
{
    uint8_t halves[RC5_BITS * 2];
    size_t count = 0;

    /* The first half of the first start bit is a space that is never sent. */
    halves[count++] = IRLAB_SPACE;

    for (size_t i = 0; i < signal->count; i++) {
        uint8_t level = i % 2 == 0 ? IRLAB_MARK : IRLAB_SPACE;
        int length;

        if (irlab_match(signal->durations[i], RC5_HALF_BIT))
            length = 1;
        else if (irlab_match(signal->durations[i], 2 * RC5_HALF_BIT))
            length = 2;
        else
            return IRLAB_ERR_NO_MATCH;

        for (int n = 0; n < length; n++) {
            if (count == RC5_BITS * 2)
                return IRLAB_ERR_NO_MATCH;
            halves[count++] = level;
        }
    }
    if (count != RC5_BITS * 2)
        return IRLAB_ERR_NO_MATCH;

    uint32_t bits = 0;
    for (int bit = 0; bit < RC5_BITS; bit++) {
        uint8_t first = halves[bit * 2];
        uint8_t second = halves[bit * 2 + 1];

        if (first == second)
            return IRLAB_ERR_NO_MATCH;
        bits = (bits << 1) | (second == IRLAB_MARK);
    }

    /* Both start bits must be 1. */
    if ((bits >> 12) != 0x3)
        return IRLAB_ERR_NO_MATCH;

    out->protocol = "rc5";
    out->toggle = (bits >> 11) & 1;
    out->address = (bits >> 6) & 0x1F;
    out->command = bits & 0x3F;
    return IRLAB_OK;
}
