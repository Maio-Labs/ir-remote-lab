#include "check.h"
#include "irlab.h"

#include <string.h>

static irlab_signal encode_nec(uint16_t address, uint16_t command)
{
    irlab_frame frame = {"nec", address, command, 0};
    irlab_signal signal;
    irlab_encode(&frame, &signal);
    return signal;
}

static void nec_encode_has_leader_bits_and_stop(void)
{
    irlab_signal signal = encode_nec(0x04, 0x08);

    CHECK(signal.carrier_hz == 38000);
    CHECK(signal.count == 67);
    CHECK(signal.durations[0] == 9000);
    CHECK(signal.durations[1] == 4500);
    CHECK(signal.durations[66] == 562);
}

static void nec_encode_sends_lsb_first(void)
{
    irlab_signal signal = encode_nec(0x01, 0x00);

    /* Address bit 0 is 1: long space. Address bit 1 is 0: short space. */
    CHECK(signal.durations[3] == 1687);
    CHECK(signal.durations[5] == 562);
}

static void nec_encode_labels_fields(void)
{
    irlab_signal signal = encode_nec(0x04, 0x08);

    CHECK(signal.field_count == 6);
    CHECK(strcmp(signal.fields[0].name, "leader") == 0);
    CHECK(strcmp(signal.fields[1].name, "address") == 0);
    CHECK(signal.fields[1].value == 0x04);
    CHECK(signal.fields[2].value == 0xFB);
    CHECK(signal.fields[3].value == 0x08);
    CHECK(signal.fields[5].end_us == signal.total_us);
}

static void nec_round_trip(void)
{
    const uint16_t cases[][2] = {{0x00, 0x00}, {0x04, 0x08}, {0xFF, 0xFF}, {0x5A, 0xA5}, {0x10, 0x45}};

    for (size_t i = 0; i < sizeof cases / sizeof cases[0]; i++) {
        irlab_signal signal = encode_nec(cases[i][0], cases[i][1]);
        irlab_frame frame;

        CHECK(irlab_decode_as("nec", &signal, &frame) == IRLAB_OK);
        CHECK(frame.address == cases[i][0]);
        CHECK(frame.command == cases[i][1]);
    }
}

static void nec_rejects_out_of_range(void)
{
    irlab_frame frame = {"nec", 0x100, 0x08, 0};
    irlab_signal signal;

    CHECK(irlab_encode(&frame, &signal) == IRLAB_ERR_RANGE);
}

static void nec_decode_tolerates_receiver_jitter(void)
{
    irlab_signal fast = encode_nec(0x04, 0x08);
    irlab_signal slow = fast;
    irlab_frame frame;

    for (size_t i = 0; i < fast.count; i++) {
        fast.durations[i] = fast.durations[i] * 9 / 10;
        slow.durations[i] = slow.durations[i] * 11 / 10;
    }
    CHECK(irlab_decode_as("nec", &fast, &frame) == IRLAB_OK);
    CHECK(irlab_decode_as("nec", &slow, &frame) == IRLAB_OK);
}

static void nec_rejects_bad_leader(void)
{
    irlab_signal signal = encode_nec(0x04, 0x08);
    irlab_frame frame;

    signal.durations[0] = 4000;
    CHECK(irlab_decode_as("nec", &signal, &frame) == IRLAB_ERR_NO_MATCH);
}

static void nec_rejects_corrupted_address(void)
{
    irlab_signal signal = encode_nec(0x04, 0x08);
    irlab_frame frame;

    /* Flip bit 0 of the inverted address from 1 to 0. */
    signal.durations[19] = 562;
    CHECK(irlab_decode_as("nec", &signal, &frame) == IRLAB_ERR_NO_MATCH);
}

void test_nec(void)
{
    RUN(nec_encode_has_leader_bits_and_stop);
    RUN(nec_encode_sends_lsb_first);
    RUN(nec_encode_labels_fields);
    RUN(nec_round_trip);
    RUN(nec_rejects_out_of_range);
    RUN(nec_decode_tolerates_receiver_jitter);
    RUN(nec_rejects_bad_leader);
    RUN(nec_rejects_corrupted_address);
}
