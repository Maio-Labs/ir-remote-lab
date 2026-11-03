#include "signal.h"

#include <string.h>

/* Receivers stretch and shrink pulses, so durations match within 25%. */
#define TOLERANCE_PERCENT 25

static irlab_level level_at(size_t index)
{
    return index % 2 == 0 ? IRLAB_MARK : IRLAB_SPACE;
}

void irlab_signal_init(irlab_signal *signal, uint32_t carrier_hz)
{
    memset(signal, 0, sizeof *signal);
    signal->carrier_hz = carrier_hz;
}

irlab_status irlab_signal_emit(irlab_signal *signal, irlab_level level, uint32_t us)
{
    if (us == 0)
        return IRLAB_OK;
    if (signal->count == 0 && level == IRLAB_SPACE)
        return IRLAB_OK;

    if (signal->count > 0 && level_at(signal->count - 1) == level) {
        signal->durations[signal->count - 1] += us;
    } else {
        if (signal->count == IRLAB_MAX_DURATIONS)
            return IRLAB_ERR_OVERFLOW;
        signal->durations[signal->count++] = us;
    }
    signal->total_us += us;
    return IRLAB_OK;
}

irlab_status irlab_signal_begin_field(irlab_signal *signal, const char *name)
{
    if (signal->field_count == IRLAB_MAX_FIELDS)
        return IRLAB_ERR_OVERFLOW;

    irlab_field *field = &signal->fields[signal->field_count++];
    field->name = name;
    field->start_us = signal->total_us;
    field->end_us = signal->total_us;
    return IRLAB_OK;
}

void irlab_signal_end_field(irlab_signal *signal, uint32_t value, uint8_t bits)
{
    irlab_field *field = &signal->fields[signal->field_count - 1];
    field->end_us = signal->total_us;
    field->value = value;
    field->bits = bits;
}

void irlab_signal_finish(irlab_signal *signal)
{
    if (signal->count > 0 && level_at(signal->count - 1) == IRLAB_SPACE) {
        signal->total_us -= signal->durations[signal->count - 1];
        signal->count--;
    }
    for (size_t i = 0; i < signal->field_count; i++) {
        if (signal->fields[i].end_us > signal->total_us)
            signal->fields[i].end_us = signal->total_us;
    }
}

int irlab_match(uint32_t measured_us, uint32_t expected_us)
{
    uint32_t tolerance = expected_us * TOLERANCE_PERCENT / 100;
    return measured_us + tolerance >= expected_us && measured_us <= expected_us + tolerance;
}
