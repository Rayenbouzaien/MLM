import { z } from "zod";

const githubPattern = /^https:\/\/(www\.)?github\.com\/.+/i;
const drivePattern = /^https:\/\/(drive|docs)\.google\.com\/.+/i;

export const submissionSchema = z.object({
  teamName: z
    .string()
    .trim()
    .min(2, "Team name is too short")
    .max(100, "Team name is too long"),
  githubUrl: z
    .string()
    .trim()
    .url("Must be a valid URL")
    .refine((v) => githubPattern.test(v), {
      message: "Must be a github.com repository link",
    }),
  driveUrl: z
    .union([
      z
        .string()
        .trim()
        .url("Must be a valid URL")
        .refine((v) => drivePattern.test(v), {
          message: "Must be a drive.google.com or docs.google.com link",
        }),
      z.literal(""),
    ])
    .optional()
    .transform((v) => (v ? v : undefined)),
});
