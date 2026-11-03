/* A very small test harness: CHECK records a failure and keeps going. */
#ifndef IRLAB_CHECK_H
#define IRLAB_CHECK_H

#include <stdio.h>

extern int check_count;
extern int check_failures;

#define CHECK(cond)                                                              \
    do {                                                                         \
        check_count++;                                                           \
        if (!(cond)) {                                                           \
            check_failures++;                                                    \
            fprintf(stderr, "  %s:%d: check failed: %s\n", __FILE__, __LINE__, #cond); \
        }                                                                        \
    } while (0)

#define RUN(test)                                                                \
    do {                                                                         \
        int before_ = check_failures;                                            \
        test();                                                                  \
        printf("%s %s\n", check_failures == before_ ? "PASS" : "FAIL", #test);   \
    } while (0)

#endif
