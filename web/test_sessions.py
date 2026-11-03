import json
import unittest

import sessions


def line(entry):
    return json.dumps(entry)


TRANSCRIPT = [
    line({"type": "user", "message": {"role": "user", "content": "Explain the NEC decoder"},
          "timestamp": "2026-11-06T09:00:00Z"}),
    line({"type": "user", "isMeta": True, "message": {"role": "user", "content": "<local-command-caveat>"}}),
    # One response split over two lines that repeat the same usage.
    line({"type": "assistant", "timestamp": "2026-11-06T09:00:02Z",
          "message": {"id": "msg_1", "model": "claude-test", "content": [{"type": "text", "text": "Let me look."}],
                      "usage": {"input_tokens": 10, "cache_creation_input_tokens": 1000,
                                "cache_read_input_tokens": 5000, "output_tokens": 40}}}),
    line({"type": "assistant", "timestamp": "2026-11-06T09:00:03Z",
          "message": {"id": "msg_1", "model": "claude-test",
                      "content": [{"type": "tool_use", "id": "toolu_1", "name": "Read",
                                   "input": {"file_path": "/repo/src/protocols/nec.c"}}],
                      "usage": {"input_tokens": 10, "cache_creation_input_tokens": 1000,
                                "cache_read_input_tokens": 5000, "output_tokens": 40}}}),
    line({"type": "user", "timestamp": "2026-11-06T09:00:04Z",
          "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "toolu_1",
                                                    "content": "x" * 400}]}}),
    line({"type": "assistant", "isSidechain": True,
          "message": {"id": "msg_side", "usage": {"input_tokens": 99999, "output_tokens": 99999}}}),
    line({"type": "assistant", "timestamp": "2026-11-06T09:00:09Z",
          "message": {"id": "msg_2", "content": [{"type": "text", "text": "Done."}],
                      "usage": {"input_tokens": 5, "cache_creation_input_tokens": 200,
                                "cache_read_input_tokens": 6000, "output_tokens": 300}}}),
    "not json",
]


class ParseLinesTest(unittest.TestCase):
    def setUp(self):
        self.parsed = sessions.parse_lines(TRANSCRIPT)
        self.summary = self.parsed["summary"]

    def test_counts_each_response_once(self):
        self.assertEqual(self.summary["turns"], 2)
        self.assertEqual(self.summary["input_tokens"], 6010 + 6205)
        self.assertEqual(self.summary["output_tokens"], 340)

    def test_skips_meta_messages_and_subagents(self):
        prompts = [e for e in self.parsed["timeline"] if e["kind"] == "prompt"]
        self.assertEqual([p["text"] for p in prompts], ["Explain the NEC decoder"])
        self.assertEqual(self.summary["peak_context"], 6205)

    def test_links_tool_results_to_their_tool(self):
        results = [e for e in self.parsed["timeline"] if e["kind"] == "result"]
        self.assertEqual(results[0]["tool"], "Read")
        self.assertEqual(results[0]["label"], "nec.c")
        self.assertEqual(results[0]["tokens"], 100)
        self.assertEqual(self.summary["tool_calls"], 1)

    def test_labels_tool_calls(self):
        turn = next(e for e in self.parsed["timeline"] if e["kind"] == "turn")
        self.assertEqual(turn["tools"], [{"name": "Read", "label": "nec.c"}])


class ProjectFolderTest(unittest.TestCase):
    def test_replaces_every_non_alphanumeric_character(self):
        folder = sessions.project_folder("/home/ana.silva/ir-remote-lab")
        self.assertEqual(folder.name, "-home-ana-silva-ir-remote-lab")

    def test_rejects_session_ids_with_paths(self):
        with self.assertRaises(KeyError):
            sessions.load_session("/tmp", "../secrets")


if __name__ == "__main__":
    unittest.main()
