// Business rule: how a subject's full marks are split into parts, each with its own
// pass mark (US-2.4, US-7.3: fail any part → F in the subject).
//   written (সৃজনশীল/লিখিত), mcq (বহুনির্বাচনী), practical (ব্যবহারিক)

export type MarksSplit = {
  writtenFull: number;
  writtenPass: number;
  mcqFull: number;
  mcqPass: number;
  practicalFull: number;
  practicalPass: number;
};

export const PARTS = ["written", "mcq", "practical"] as const;
export type Part = (typeof PARTS)[number];

/** The usual Bangladeshi pass mark: 33% of the part, rounded (70 → 23, 30 → 10, 25 → 8). */
export const defaultPass = (full: number) => Math.round(full * 0.33);

/** Common splits, ready to pick. */
export const PRESETS = {
  written100: { writtenFull: 100, mcqFull: 0, practicalFull: 0 },
  creative70mcq30: { writtenFull: 70, mcqFull: 30, practicalFull: 0 },
  creative50mcq25practical25: { writtenFull: 50, mcqFull: 25, practicalFull: 25 },
  written50: { writtenFull: 50, mcqFull: 0, practicalFull: 0 },
} as const;

/** Fills each part's pass mark with 33% where none was given. */
export function withPass(full: { writtenFull: number; mcqFull: number; practicalFull: number }, pass: Partial<Record<`${Part}Pass`, number | null>> = {}): MarksSplit {
  return {
    writtenFull: full.writtenFull,
    writtenPass: pass.writtenPass ?? defaultPass(full.writtenFull),
    mcqFull: full.mcqFull,
    mcqPass: pass.mcqPass ?? defaultPass(full.mcqFull),
    practicalFull: full.practicalFull,
    practicalPass: pass.practicalPass ?? defaultPass(full.practicalFull),
  };
}

export const totalFull = (s: MarksSplit) => s.writtenFull + s.mcqFull + s.practicalFull;

/** null when fine, otherwise what is wrong (and with which part). */
export function checkSplit(s: MarksSplit): { error: "noMarks" | "tooMany" | "passAboveFull" | "negative"; part?: Part } | null {
  for (const part of PARTS) {
    const full = s[`${part}Full`];
    const pass = s[`${part}Pass`];
    if (!Number.isInteger(full) || !Number.isInteger(pass) || full < 0 || pass < 0) return { error: "negative", part };
    if (pass > full) return { error: "passAboveFull", part };
  }
  const total = totalFull(s);
  if (total === 0) return { error: "noMarks" };
  if (total > 200) return { error: "tooMany" };
  return null;
}
