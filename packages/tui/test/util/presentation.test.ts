import { expect, test } from "bun:test"
import { createTestRenderer } from "@opentui/core/testing"
import { buildSessionEpilogue } from "../../src/util/presentation"

test("formats session continuation summary", async () => {
  const setup = await createTestRenderer({ width: 80, height: 24, useThread: false })
  try {
    const epilogue = buildSessionEpilogue(setup.renderer, {
      title: "A session",
      sessionID: "ses_123",
    })
    expect(epilogue).toContain("A session")
    expect(epilogue).toContain("deveco -s ses_123")
    expect(epilogue).toContain("\x1b[")
  } finally {
    if (!setup.renderer.isDestroyed) setup.renderer.destroy()
  }
})
