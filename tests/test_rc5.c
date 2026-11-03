#include "check.h"
#include "irlab.h"

static irlab_signal encode_rc5(uint16_t address, uint16_t command, uint8_t toggle)
{
    irlab_frame frame = {"rc5", address, command, toggle};
    irlab_signal signal;
    irlab_encode(&frame, &signal);
    return signal;
}

static void rc5_encode_matches_reference_frame(void)
{
    /* Address 5, command 0x35, toggle 0: bits 11 0 00101 110101. */
    const uint32_t expected[] = {889, 889, 1778, 889, 889, 889, 889, 1778, 1778, 1778,
                                 889, 889, 889, 889, 1778, 1778, 1778, 1778, 889};
    irlab_signal signal = encode_rc5(5, 0x35, 0);
    int same = signal.count == sizeof expected / sizeof expected[0];

    for (size_t i = 0; same && i < signal.count; i++)
        same = signal.durations[i] == expected[i];
    CHECK(signal.carrier_hz == 36000);
    CHECK(same);
}

static void rc5_round_trip(void)
{
    const uint16_t cases[][3] = {{0x00, 0x01, 0}, {0x05, 0x35, 1}, {0x1F, 0x3F, 0}, {0x14, 0x0D, 1}, {0x00, 0x11, 0}};

    for (size_t i = 0; i < sizeof cases / sizeof cases[0]; i++) {
        irlab_signal signal = encode_rc5(cases[i][0], cases[i][1], (uint8_t)cases[i][2]);
        irlab_frame frame;

        CHECK(irlab_decode_as("rc5", &signal, &frame) == IRLAB_OK);
        CHECK(frame.address == cases[i][0]);
        CHECK(frame.command == cases[i][1]);
        CHECK(frame.toggle == cases[i][2]);
    }
}

static void rc5_toggle_changes_the_signal(void)
{
    irlab_signal first = encode_rc5(0, 0x01, 0);
    irlab_signal second = encode_rc5(0, 0x01, 1);
    int differ = first.count != second.count;

    for (size_t i = 0; !differ && i < first.count; i++)
        differ = first.durations[i] != second.durations[i];
    CHECK(differ);
}

static void rc5_rejects_nec_signal(void)
{
    irlab_frame nec = {"nec", 0x04, 0x08, 0};
    irlab_signal signal;
    irlab_frame frame;

    irlab_encode(&nec, &signal);
    CHECK(irlab_decode_as("rc5", &signal, &frame) == IRLAB_ERR_NO_MATCH);
}

void test_rc5(void)
{
    RUN(rc5_encode_matches_reference_frame);
    RUN(rc5_round_trip);
    RUN(rc5_toggle_changes_the_signal);
    RUN(rc5_rejects_nec_signal);
}
