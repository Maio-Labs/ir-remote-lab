#include "check.h"
#include "irlab.h"

#include <string.h>

static void registry_lists_known_protocols(void)
{
    size_t count, implemented = 0;
    const irlab_protocol *protocols = irlab_protocols(&count);

    for (size_t i = 0; i < count; i++)
        implemented += irlab_is_implemented(&protocols[i]);
    CHECK(count == 5);
    CHECK(implemented == 2);
    CHECK(irlab_find_protocol("nec") != NULL);
    CHECK(irlab_find_protocol("unknown") == NULL);
}

static void encode_reports_unknown_and_missing_protocols(void)
{
    irlab_frame unknown = {"unknown", 0, 0, 0};
    irlab_frame sirc = {"sirc", 1, 2, 0};
    irlab_signal signal;

    CHECK(irlab_encode(&unknown, &signal) == IRLAB_ERR_ARGUMENT);
    CHECK(irlab_encode(&sirc, &signal) == IRLAB_ERR_NOT_IMPLEMENTED);
}

static void decode_detects_the_protocol(void)
{
    irlab_frame nec = {"nec", 0x04, 0x08, 0};
    irlab_frame rc5 = {"rc5", 0x05, 0x35, 0};
    irlab_signal signal;
    irlab_frame frame;

    irlab_encode(&nec, &signal);
    CHECK(irlab_decode(&signal, &frame) == IRLAB_OK);
    CHECK(strcmp(frame.protocol, "nec") == 0);

    irlab_encode(&rc5, &signal);
    CHECK(irlab_decode(&signal, &frame) == IRLAB_OK);
    CHECK(strcmp(frame.protocol, "rc5") == 0);
}

void test_registry(void)
{
    RUN(registry_lists_known_protocols);
    RUN(encode_reports_unknown_and_missing_protocols);
    RUN(decode_detects_the_protocol);
}
