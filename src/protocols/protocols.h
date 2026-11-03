/* Encoders and decoders for each implemented protocol. */
#ifndef IRLAB_PROTOCOLS_H
#define IRLAB_PROTOCOLS_H

#include "irlab.h"

irlab_status irlab_nec_encode(const irlab_frame *frame, irlab_signal *out);
irlab_status irlab_nec_decode(const irlab_signal *signal, irlab_frame *out);

irlab_status irlab_rc5_encode(const irlab_frame *frame, irlab_signal *out);
irlab_status irlab_rc5_decode(const irlab_signal *signal, irlab_frame *out);

#endif
