import { describe, expect, test } from "bun:test"
import { buildReport, formatReport } from "../../src/tool/jscrash_report"

describe("jscrash_report", () => {
  const crashLog = [
    "JsCrash detected on device 127.0.0.1:5555",
    "TypeError: Cannot read property 'name' of undefined",
    "    at updateName (entry/src/main/ets/pages/Index.ets:42:10)",
    "    at onClick (entry/src/main/ets/pages/Index.ets:18:5)",
  ].join("\n")

  describe("buildReport", () => {
    test("detects a crash and extracts structured fields from a real-style log", () => {
      const report = buildReport(crashLog, "provided_text", "127.0.0.1:5555", "com.example.app", "EntryAbility")
      expect(report.status).toBe("detected")
      expect(report.source).toBe("provided_text")
      expect(report.device).toBe("127.0.0.1:5555")
      expect(report.bundle).toBe("com.example.app")
      expect(report.process).toBe("EntryAbility")
      expect(report.errorType).toBe("TypeError")
      expect(report.errorMessage).toContain("TypeError")
      expect(report.suspectedFile).toMatch(/Index\.ets:42:10/)
      expect(report.topStack.some((frame) => frame.includes("Index.ets"))).toBe(true)
      expect(report.keywords).toEqual(expect.arrayContaining(["jscrash", "typeerror"]))
    })

    test("reports no crash signature for benign logs", () => {
      const report = buildReport(
        "Application started\nRendering home page\nUser tapped the submit button",
        "provided_text",
        "default",
        "",
        "",
      )
      expect(report.status).toBe("no_crash_signature")
      expect(report.errorType).toBe("UnknownError")
      expect(report.bundle).toBe("(unknown)")
      expect(report.process).toBe("(unknown)")
    })

    test("extracts the bundle name from the log when no hint is given", () => {
      const report = buildReport(
        "FATAL: app crashed\nbundleName: com.foo.bar\nTypeError: null reference",
        "device_hilog",
        "default",
        "",
        "",
      )
      expect(report.bundle).toBe("com.foo.bar")
      expect(report.status).toBe("detected")
    })

    test("preserves the casing of the detected error type", () => {
      const report = buildReport("uncaught typeerror in render loop", "provided_text", "default", "", "")
      expect(report.errorType).toBe("typeerror")
      expect(report.status).toBe("detected")
    })
  })

  describe("formatReport", () => {
    test("renders a detected crash with the suspected-file next action", () => {
      const text = formatReport(buildReport(crashLog, "provided_text", "default", "com.example.app", "EntryAbility"))
      expect(text).toContain("Crash signature detected.")
      expect(text).toContain("error_type: TypeError")
      expect(text).toContain("Inspect ")
    })

    test("renders a no-crash report with the gather-more-logs next action", () => {
      const text = formatReport(buildReport("Application started\nRendering home page", "provided_text", "default", "", ""))
      expect(text).toContain("No clear crash signature detected.")
      expect(text).toContain("Use hdc_log or provide a fuller crash log.")
    })
  })
})
