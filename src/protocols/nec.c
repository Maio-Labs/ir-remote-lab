/*
 * NEC: pulse distance encoding on a 38 kHz carrier. See docs/protocols/nec.md.
 *
 * Frame: 9 ms leader mark, 4.5 ms space, then 32 bits sent LSB first
 * (address, inverted address, command, inverted command) and a stop mark.
 * Every bit is a 562 us mark followed by a space that carries the value:
 * 562 us for 0, 1687 us for 1.
 */
#include "protocols.h"
#include "../signal.h"

#define NEC_CARRIER_HZ 38000
#define NEC_LEADER_MARK 9000
#define NEC_LEADER_SPACE 4500
#define NEC_BIT_MARK 562
#define NEC_ZERO_SPACE 562
#define NEC_ONE_SPACE 1687
#define NEC_DURATIONS 67

static irlab_status emit_byte(irlab_signal *signal, const char *name, uint8_t byte)
{
    TRY(irlab_signal_begin_field(signal, name));
    for (int bit = 0; bit < 8; bit++) {
        uint32_t space = (byte >> bit) & 1 ? NEC_ONE_SPACE : NEC_ZERO_SPACE;
        TRY(irlab_signal_emit(signal, IRLAB_MARK, NEC_BIT_MARK));
        TRY(irlab_signal_emit(signal, IRLAB_SPACE, space));
    }
    irlab_signal_end_field(signal, byte, 8);
    return IRLAB_OK;
}

irlab_status irlab_nec_encode(const irlab_frame *frame, irlab_signal *out)
{
    if (frame->address > 0xFF || frame->command > 0xFF)
        return IRLAB_ERR_RANGE;

    uint8_t address = (uint8_t)frame->address;
    uint8_t command = (uint8_t)frame->command;

    irlab_signal_init(out, NEC_CARRIER_HZ);
    TRY(irlab_signal_begin_field(out, "leader"));
    TRY(irlab_signal_emit(out, IRLAB_MARK, NEC_LEADER_MARK));
    TRY(irlab_signal_emit(out, IRLAB_SPACE, NEC_LEADER_SPACE));
    irlab_signal_end_field(out, 0, 0);

    TRY(emit_byte(out, "address", address));
    TRY(emit_byte(out, "address inverse", (uint8_t)~address));
    TRY(emit_byte(out, "command", command));
    TRY(emit_byte(out, "command inverse", (uint8_t)~command));

    TRY(irlab_signal_begin_field(out, "stop"));
    TRY(irlab_signal_emit(out, IRLAB_MARK, NEC_BIT_MARK));
    irlab_signal_end_field(out, 0, 0);

    irlab_signal_finish(out);
    return IRLAB_OK;
}

/* Read 8 bits, LSB first, from 16 durations (mark, space, mark, space...). */
static int read_byte(const uint32_t *durations, uint8_t *byte)
{
    *byte = 0;
    for (int bit = 0; bit < 8; bit++) {
        uint32_t mark = durations[bit * 2];
        uint32_t space = durations[bit * 2 + 1];

        if (!irlab_match(mark, NEC_BIT_MARK))
            return 0;
        if (irlab_match(space, NEC_ONE_SPACE))
            *byte |= (uint8_t)(1u << bit);
        else if (!irlab_match(space, NEC_ZERO_SPACE))
            return 0;
    }
    return 1;
}

irlab_status irlab_nec_decode(const irlab_signal *signal, irlab_frame *out)
{
    const uint32_t *d = signal->durations;
    uint8_t address, address_inverse, command, command_inverse;

    if (signal->count < NEC_DURATIONS)
        return IRLAB_ERR_NO_MATCH;
    if (!irlab_match(d[0], NEC_LEADER_MARK) || !irlab_match(d[1], NEC_LEADER_SPACE))
        return IRLAB_ERR_NO_MATCH;
    if (!read_byte(d + 2, &address) || !read_byte(d + 18, &address_inverse) ||
        !read_byte(d + 34, &command) || !read_byte(d + 50, &command_inverse))
        return IRLAB_ERR_NO_MATCH;
    if (!irlab_match(d[66], NEC_BIT_MARK))
        return IRLAB_ERR_NO_MATCH;

    /* The inverted copies protect against corrupted frames. */
    if ((uint8_t)(address ^ address_inverse) != 0xFF ||
        (uint8_t)(address ^ address_inverse) != 0xFF)
        return IRLAB_ERR_NO_MATCH;

    out->protocol = "nec";
    out->address = address;
    out->command = command;
    out->toggle = 0;
    return IRLAB_OK;
}
