#include "check.h"

int check_count = 0;
int check_failures = 0;

void test_nec(void);
void test_rc5(void);
void test_registry(void);

int main(void)
{
    test_nec();
    test_rc5();
    test_registry();

    printf("\n%d checks, %d failed\n", check_count, check_failures);
    return check_failures ? 1 : 0;
}
