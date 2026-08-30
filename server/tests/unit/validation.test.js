import { describe, it, expect } from "@jest/globals";
import { submissionSchema } from "../../src/validation.js";

describe("submissionSchema", () => {
  it("accepts a valid submission with only the required github link", () => {
    const result = submissionSchema.safeParse({
      teamName: "Telemetry Titans",
      githubUrl: "https://github.com/telemetry-titans/gridlock",
    });
    expect(result.success).toBe(true);
    expect(result.data.driveUrl).toBeUndefined();
  });

  it("accepts a valid submission with both links", () => {
    const result = submissionSchema.safeParse({
      teamName: "Telemetry Titans",
      githubUrl: "https://github.com/telemetry-titans/gridlock",
      driveUrl: "https://drive.google.com/drive/folders/abc123",
    });
    expect(result.success).toBe(true);
    expect(result.data.driveUrl).toBe("https://drive.google.com/drive/folders/abc123");
  });

  it("accepts docs.google.com as well as drive.google.com", () => {
    const result = submissionSchema.safeParse({
      teamName: "Telemetry Titans",
      githubUrl: "https://github.com/telemetry-titans/gridlock",
      driveUrl: "https://docs.google.com/document/d/abc123",
    });
    expect(result.success).toBe(true);
  });

  it("treats an empty-string drive link as omitted rather than invalid", () => {
    const result = submissionSchema.safeParse({
      teamName: "Telemetry Titans",
      githubUrl: "https://github.com/telemetry-titans/gridlock",
      driveUrl: "",
    });
    expect(result.success).toBe(true);
    expect(result.data.driveUrl).toBeUndefined();
  });

  it("trims whitespace from team name and URLs", () => {
    const result = submissionSchema.safeParse({
      teamName: "  Telemetry Titans  ",
      githubUrl: "  https://github.com/telemetry-titans/gridlock  ",
    });
    expect(result.success).toBe(true);
    expect(result.data.teamName).toBe("Telemetry Titans");
    expect(result.data.githubUrl).toBe("https://github.com/telemetry-titans/gridlock");
  });

  it("rejects a missing github link", () => {
    const result = submissionSchema.safeParse({ teamName: "Telemetry Titans" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-github URL for githubUrl", () => {
    const result = submissionSchema.safeParse({
      teamName: "Telemetry Titans",
      githubUrl: "https://gitlab.com/telemetry-titans/gridlock",
    });
    expect(result.success).toBe(false);
    expect(result.error.flatten().fieldErrors.githubUrl?.[0]).toMatch(/github\.com/i);
  });

  it("rejects a malformed URL for githubUrl", () => {
    const result = submissionSchema.safeParse({
      teamName: "Telemetry Titans",
      githubUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-drive URL for driveUrl when provided", () => {
    const result = submissionSchema.safeParse({
      teamName: "Telemetry Titans",
      githubUrl: "https://github.com/telemetry-titans/gridlock",
      driveUrl: "https://dropbox.com/s/abc123",
    });
    expect(result.success).toBe(false);
    expect(result.error.flatten().fieldErrors.driveUrl?.[0]).toMatch(/google\.com/i);
  });

  it("rejects a team name that is too short", () => {
    const result = submissionSchema.safeParse({
      teamName: "A",
      githubUrl: "https://github.com/a/b",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a team name over 100 characters", () => {
    const result = submissionSchema.safeParse({
      teamName: "A".repeat(101),
      githubUrl: "https://github.com/a/b",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing team name", () => {
    const result = submissionSchema.safeParse({
      githubUrl: "https://github.com/a/b",
    });
    expect(result.success).toBe(false);
  });

  it("does not choke on a SQL-injection-style team name (should be treated as plain text)", () => {
    const result = submissionSchema.safeParse({
      teamName: "Robert'); DROP TABLE submissions;--",
      githubUrl: "https://github.com/a/b",
    });
    // Schema only cares about length/type — injection safety is the
    // parameterized query's job (covered in integration tests), not
    // validation's. This just confirms validation doesn't crash on it.
    expect(result.success).toBe(true);
  });
});
