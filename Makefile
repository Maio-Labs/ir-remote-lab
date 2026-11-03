CC ?= cc
CFLAGS ?= -std=c11 -Wall -Wextra -O2
CPPFLAGS += -Iinclude -MMD -MP
BUILD := build

LIB_SRC := $(wildcard src/*.c src/protocols/*.c)
LIB_OBJ := $(LIB_SRC:%.c=$(BUILD)/%.o)
CLI_OBJ := $(BUILD)/src/cli/main.o
TEST_OBJ := $(patsubst %.c,$(BUILD)/%.o,$(wildcard tests/*.c))

.PHONY: all test run clean

all: $(BUILD)/irlab $(BUILD)/test_irlab

$(BUILD)/libirlab.a: $(LIB_OBJ)
	ar rcs $@ $^

$(BUILD)/irlab: $(CLI_OBJ) $(BUILD)/libirlab.a
	$(CC) $(LDFLAGS) -o $@ $^

$(BUILD)/test_irlab: $(TEST_OBJ) $(BUILD)/libirlab.a
	$(CC) $(LDFLAGS) -o $@ $^

$(BUILD)/%.o: %.c
	@mkdir -p $(dir $@)
	$(CC) $(CPPFLAGS) $(CFLAGS) -c $< -o $@

test: $(BUILD)/test_irlab
	-./$(BUILD)/test_irlab
	python3 -m unittest discover -s web -p "test_*.py"

run: all
	python3 web/server.py

clean:
	rm -rf $(BUILD)

-include $(LIB_OBJ:.o=.d) $(CLI_OBJ:.o=.d) $(TEST_OBJ:.o=.d)
