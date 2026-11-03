#include "irlab.h"
#include "protocols/protocols.h"

#include <string.h>

/* Protocols without an encoder and a decoder are listed but not implemented
 * yet. See ROADMAP.md. */
static const irlab_protocol protocols[] = {
    {"nec", "NEC", "pulse distance", 38000, 8, 8, irlab_nec_encode, irlab_nec_decode},
    {"rc5", "Philips RC5", "bi-phase", 36000, 5, 6, irlab_rc5_encode, irlab_rc5_decode},
    {"sirc", "Sony SIRC 12-bit", "pulse width", 40000, 5, 7, NULL, NULL},
    {"samsung", "Samsung32", "pulse distance", 38000, 8, 8, NULL, NULL},
    {"rc6", "Philips RC6 mode 0", "bi-phase", 36000, 8, 8, NULL, NULL},
};

#define PROTOCOL_COUNT (sizeof protocols / sizeof protocols[0])

const irlab_protocol *irlab_protocols(size_t *count)
{
    if (count)
        *count = PROTOCOL_COUNT;
    return protocols;
}

const irlab_protocol *irlab_find_protocol(const char *name)
{
    if (!name)
        return NULL;
    for (size_t i = 0; i < PROTOCOL_COUNT; i++) {
        if (strcmp(protocols[i].name, name) == 0)
            return &protocols[i];
    }
    return NULL;
}

int irlab_is_implemented(const irlab_protocol *protocol)
{
    return protocol && protocol->encode && protocol->decode;
}

irlab_status irlab_encode(const irlab_frame *frame, irlab_signal *out)
{
    if (!frame || !out)
        return IRLAB_ERR_ARGUMENT;

    const irlab_protocol *protocol = irlab_find_protocol(frame->protocol);
    if (!protocol)
        return IRLAB_ERR_ARGUMENT;
    if (!irlab_is_implemented(protocol))
        return IRLAB_ERR_NOT_IMPLEMENTED;
    return protocol->encode(frame, out);
}

irlab_status irlab_decode_as(const char *name, const irlab_signal *signal, irlab_frame *out)
{
    if (!signal || !out)
        return IRLAB_ERR_ARGUMENT;

    const irlab_protocol *protocol = irlab_find_protocol(name);
    if (!protocol)
        return IRLAB_ERR_ARGUMENT;
    if (!irlab_is_implemented(protocol))
        return IRLAB_ERR_NOT_IMPLEMENTED;
    return protocol->decode(signal, out);
}

irlab_status irlab_decode(const irlab_signal *signal, irlab_frame *out)
{
    if (!signal || !out)
        return IRLAB_ERR_ARGUMENT;

    for (size_t i = 0; i < PROTOCOL_COUNT; i++) {
        if (irlab_is_implemented(&protocols[i]) && protocols[i].decode(signal, out) == IRLAB_OK)
            return IRLAB_OK;
    }
    return IRLAB_ERR_NO_MATCH;
}

const char *irlab_status_text(irlab_status status)
{
    switch (status) {
    case IRLAB_OK:
        return "ok";
    case IRLAB_ERR_ARGUMENT:
        return "invalid argument or unknown protocol";
    case IRLAB_ERR_RANGE:
        return "address or command out of range";
    case IRLAB_ERR_NO_MATCH:
        return "signal does not match the protocol";
    case IRLAB_ERR_OVERFLOW:
        return "signal is too long";
    case IRLAB_ERR_NOT_IMPLEMENTED:
        return "protocol not implemented yet";
    }
    return "unknown status";
}
