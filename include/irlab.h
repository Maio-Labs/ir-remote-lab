/*
 * irlab: encode and decode infrared remote-control signals.
 *
 * A signal is a list of durations in microseconds that alternate between
 * mark (carrier on) and space (carrier off), always starting with a mark.
 * This is the same shape as the raw timings an IR receiver produces.
 */
#ifndef IRLAB_H
#define IRLAB_H

#include <stddef.h>
#include <stdint.h>

#define IRLAB_MAX_DURATIONS 256
#define IRLAB_MAX_FIELDS 16

typedef enum {
    IRLAB_OK = 0,
    IRLAB_ERR_ARGUMENT,
    IRLAB_ERR_RANGE,
    IRLAB_ERR_NO_MATCH,
    IRLAB_ERR_OVERFLOW,
    IRLAB_ERR_NOT_IMPLEMENTED
} irlab_status;

/* One labelled part of an encoded frame, such as the leader or the address. */
typedef struct {
    const char *name;
    uint32_t start_us;
    uint32_t end_us;
    uint32_t value;
    uint8_t bits;
} irlab_field;

typedef struct {
    uint32_t carrier_hz;
    size_t count;
    uint32_t durations[IRLAB_MAX_DURATIONS];
    uint32_t total_us;
    size_t field_count;
    irlab_field fields[IRLAB_MAX_FIELDS];
} irlab_signal;

/* The logical content of one key press. */
typedef struct {
    const char *protocol;
    uint16_t address;
    uint16_t command;
    uint8_t toggle;
} irlab_frame;

typedef struct {
    const char *name;
    const char *title;
    const char *encoding;
    uint32_t carrier_hz;
    uint8_t address_bits;
    uint8_t command_bits;
    irlab_status (*encode)(const irlab_frame *frame, irlab_signal *out);
    irlab_status (*decode)(const irlab_signal *signal, irlab_frame *out);
} irlab_protocol;

/* Every known protocol, implemented or not. */
const irlab_protocol *irlab_protocols(size_t *count);
const irlab_protocol *irlab_find_protocol(const char *name);
int irlab_is_implemented(const irlab_protocol *protocol);

/* Encode frame->protocol. */
irlab_status irlab_encode(const irlab_frame *frame, irlab_signal *out);

/* Try every implemented protocol and return the first that matches. */
irlab_status irlab_decode(const irlab_signal *signal, irlab_frame *out);
irlab_status irlab_decode_as(const char *protocol, const irlab_signal *signal, irlab_frame *out);

const char *irlab_status_text(irlab_status status);

#endif
