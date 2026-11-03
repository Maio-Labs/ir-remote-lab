/* Building blocks shared by the protocol modules. Not part of the public API. */
#ifndef IRLAB_SIGNAL_H
#define IRLAB_SIGNAL_H

#include "irlab.h"

typedef enum { IRLAB_SPACE = 0, IRLAB_MARK = 1 } irlab_level;

/* Return early from the calling function when a step fails. */
#define TRY(expr)                              \
    do {                                       \
        irlab_status try_status_ = (expr);     \
        if (try_status_ != IRLAB_OK)           \
            return try_status_;                \
    } while (0)

void irlab_signal_init(irlab_signal *signal, uint32_t carrier_hz);

/* Append a mark or a space. Consecutive levels merge into one duration and a
 * leading space is dropped, because a transmission always starts with a mark. */
irlab_status irlab_signal_emit(irlab_signal *signal, irlab_level level, uint32_t us);

irlab_status irlab_signal_begin_field(irlab_signal *signal, const char *name);
void irlab_signal_end_field(irlab_signal *signal, uint32_t value, uint8_t bits);

/* Drop a trailing space: a transmission always ends with a mark. */
void irlab_signal_finish(irlab_signal *signal);

/* True when a measured duration is close enough to the expected one. */
int irlab_match(uint32_t measured_us, uint32_t expected_us);

#endif
