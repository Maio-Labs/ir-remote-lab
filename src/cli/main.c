/*
 * irlab command-line tool. Prints JSON so the web server and scripts can use it.
 *
 *   irlab protocols
 *   irlab encode <protocol> <address> <command> [toggle]
 *   irlab decode <protocol|auto> <duration> <duration> ...
 *
 * Addresses and commands can be decimal (16) or hexadecimal (0x10).
 * Durations are microseconds and may carry a +/- sign, as in "+9000 -4500".
 */
#include "irlab.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void print_usage(void)
{
    fprintf(stderr,
            "usage: irlab protocols\n"
            "       irlab encode <protocol> <address> <command> [toggle]\n"
            "       irlab decode <protocol|auto> <duration> <duration> ...\n");
}

static int print_error(const char *message)
{
    printf("{\"ok\":false,\"error\":\"%s\"}\n", message);
    return 1;
}

static int list_protocols(void)
{
    size_t count;
    const irlab_protocol *protocols = irlab_protocols(&count);

    printf("{\"ok\":true,\"protocols\":[");
    for (size_t i = 0; i < count; i++) {
        const irlab_protocol *p = &protocols[i];
        printf("%s{\"name\":\"%s\",\"title\":\"%s\",\"encoding\":\"%s\",\"carrier_hz\":%u,"
               "\"address_bits\":%u,\"command_bits\":%u,\"implemented\":%s}",
               i ? "," : "", p->name, p->title, p->encoding, (unsigned)p->carrier_hz,
               (unsigned)p->address_bits, (unsigned)p->command_bits,
               irlab_is_implemented(p) ? "true" : "false");
    }
    printf("]}\n");
    return 0;
}

static int encode(int argc, char **argv)
{
    if (argc < 3) {
        print_usage();
        return 2;
    }

    int address = atoi(argv[1]);
    int command = atoi(argv[2]);
    int toggle = argc > 3 ? atoi(argv[3]) : 0;
    if (address < 0 || address > 0xFFFF || command < 0 || command > 0xFFFF)
        return print_error(irlab_status_text(IRLAB_ERR_RANGE));

    irlab_frame frame = {argv[0], (uint16_t)address, (uint16_t)command, (uint8_t)(toggle & 1)};
    irlab_signal signal;
    irlab_status status = irlab_encode(&frame, &signal);
    if (status != IRLAB_OK)
        return print_error(irlab_status_text(status));

    printf("{\"ok\":true,\"protocol\":\"%s\",\"address\":%u,\"command\":%u,\"toggle\":%u,"
           "\"carrier_hz\":%u,\"total_us\":%u,\"durations\":[",
           frame.protocol, (unsigned)frame.address, (unsigned)frame.command,
           (unsigned)frame.toggle, (unsigned)signal.carrier_hz, (unsigned)signal.total_us);
    for (size_t i = 0; i < signal.count; i++)
        printf("%s%u", i ? "," : "", (unsigned)signal.durations[i]);
    printf("],\"fields\":[");
    for (size_t i = 0; i < signal.field_count; i++) {
        const irlab_field *f = &signal.fields[i];
        printf("%s{\"name\":\"%s\",\"start_us\":%u,\"end_us\":%u,\"value\":%u,\"bits\":%u}",
               i ? "," : "", f->name, (unsigned)f->start_us, (unsigned)f->end_us,
               (unsigned)f->value, (unsigned)f->bits);
    }
    printf("]}\n");
    return 0;
}

static int decode(int argc, char **argv)
{
    if (argc < 2) {
        print_usage();
        return 2;
    }

    irlab_signal signal;
    memset(&signal, 0, sizeof signal);
    for (int i = 1; i < argc; i++) {
        const char *text = argv[i];
        char *end;

        if (*text == '+' || *text == '-')
            text++;
        unsigned long us = strtoul(text, &end, 10);
        if (*end != '\0' || us == 0 || us > 1000000)
            return print_error("durations must be whole microseconds between 1 and 1000000");
        if (signal.count == IRLAB_MAX_DURATIONS)
            return print_error(irlab_status_text(IRLAB_ERR_OVERFLOW));
        signal.durations[signal.count++] = (uint32_t)us;
        signal.total_us += (uint32_t)us;
    }

    irlab_frame frame;
    irlab_status status = strcmp(argv[0], "auto") == 0
                              ? irlab_decode(&signal, &frame)
                              : irlab_decode_as(argv[0], &signal, &frame);
    if (status != IRLAB_OK)
        return print_error(irlab_status_text(status));

    const irlab_protocol *protocol = irlab_find_protocol(frame.protocol);
    printf("{\"ok\":true,\"protocol\":\"%s\",\"address\":%u,\"command\":%u,\"toggle\":%u,"
           "\"carrier_hz\":%u}\n",
           frame.protocol, (unsigned)frame.address, (unsigned)frame.command,
           (unsigned)frame.toggle, (unsigned)protocol->carrier_hz);
    return 0;
}

int main(int argc, char **argv)
{
    if (argc < 2) {
        print_usage();
        return 2;
    }
    if (strcmp(argv[1], "protocols") == 0)
        return list_protocols();
    if (strcmp(argv[1], "encode") == 0)
        return encode(argc - 2, argv + 2);
    if (strcmp(argv[1], "decode") == 0)
        return decode(argc - 2, argv + 2);

    print_usage();
    return 2;
}
