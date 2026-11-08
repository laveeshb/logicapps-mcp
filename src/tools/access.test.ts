import { describe, it, expect, vi, afterEach } from "vitest";
import { TOOL_DEFINITIONS } from "./definitions.js";
import { TOOL_ACCESS, getAvailableTools, isToolAllowed, logReadOnlyMode } from "./access.js";

const RESTRICTED = [
  "create_workflow",
  "update_workflow",
  "delete_workflow",
  "clone_workflow",
  "enable_workflow",
  "disable_workflow",
  "create_connection",
  "run_trigger",
  "cancel_run",
  "resubmit_run",
  "invoke_connector_operation",
  "get_trigger_callback_url",
];

describe("tool access", () => {
  const names = TOOL_DEFINITIONS.map((t) => t.name);

  it("classifies every tool", () => {
    const missing = names.filter((n) => !(n in TOOL_ACCESS));
    expect(missing).toEqual([]);
  });

  it("has no entries for tools that do not exist", () => {
    const stale = Object.keys(TOOL_ACCESS).filter((n) => !names.includes(n));
    expect(stale).toEqual([]);
  });

  it("restricts exactly the tools that change, run or hand out a credential", () => {
    const restricted = names.filter((n) => TOOL_ACCESS[n] === "restricted");
    expect(restricted.sort()).toEqual([...RESTRICTED].sort());
  });

  describe("getAvailableTools", () => {
    it("returns every tool when read-only mode is off", () => {
      expect(getAvailableTools(TOOL_DEFINITIONS, false)).toHaveLength(TOOL_DEFINITIONS.length);
    });

    it("hides the restricted tools in read-only mode", () => {
      const available = getAvailableTools(TOOL_DEFINITIONS, true).map((t) => t.name);

      for (const name of RESTRICTED) {
        expect(available).not.toContain(name);
      }
      expect(available).toHaveLength(TOOL_DEFINITIONS.length - RESTRICTED.length);
    });

    it("keeps the tools used to debug runs", () => {
      const available = getAvailableTools(TOOL_DEFINITIONS, true).map((t) => t.name);

      for (const name of ["list_run_history", "get_run_details", "get_action_io", "search_runs"]) {
        expect(available).toContain(name);
      }
    });
  });

  describe("isToolAllowed", () => {
    it("allows everything when read-only mode is off", () => {
      expect(isToolAllowed("delete_workflow", false)).toBe(true);
    });

    it("blocks a tool that is not classified in read-only mode", () => {
      expect(isToolAllowed("some_new_tool", true)).toBe(false);
    });
  });

  describe("logReadOnlyMode", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("says how many tools are available when read-only mode is on", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      logReadOnlyMode(TOOL_DEFINITIONS, true);

      expect(spy).toHaveBeenCalledWith(
        `Read-only mode: ${TOOL_DEFINITIONS.length - RESTRICTED.length} of ${TOOL_DEFINITIONS.length} tools available`
      );
    });

    it("says nothing when read-only mode is off", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      logReadOnlyMode(TOOL_DEFINITIONS, false);

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
