import { z } from "zod";

export const MAX_NOTE_LENGTH = 2000;

/** A Note body: plain text, trimmed, never rendered as Markdown. */
export const noteBodySchema = z
  .string()
  .trim()
  .min(1, "Write something before saving your note.")
  .max(
    MAX_NOTE_LENGTH,
    `A note can be at most ${MAX_NOTE_LENGTH.toLocaleString("en-US")} characters.`
  );
