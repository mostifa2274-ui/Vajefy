import { z } from "zod";
import { entry, sense, type Entry } from "./content";
import type { SelectedRecord } from "./rights-cefrj-selection";
import type { PlacedWord } from "./rights-level-selection";
import { overlapsDraft } from "./rights-independent-ngsl-drafts";

export const CEFRJ_LESSON_DRAFT_STATUS = "STAGING_ONLY_FULL_A1_LESSONS_UNREVIEWED" as const;
export const CEFRJ_A1_SELECTION_FILE = "content/rights-staging/a1-rebuild/cefrj-a1-selection.json";
export const CEFRJ_LEVEL_SELECTION_FILE = "content/rights-staging/level-rebuild/level-selection.json";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().trim().min(1);
const sourceRef = z.object({ file: text, sha256: hash }).strict();
const sourceRecord = z.object({ selectionId: text, senseId: text, meaningEn: text }).strict();
const lesson = z.object({
  sourceHeadword: text,
  levelWordId: text,
  existingEntryIds: z.array(text),
  sourceRecords: z.array(sourceRecord).min(1),
  entry: entry.extend({ senses: z.array(sense.strict()).min(1) }).strict(),
  editorialState: z.literal("STAGING_ONLY_AI_DRAFT_UNREVIEWED"),
  semanticApproved: z.literal(false),
  persianApproved: z.literal(false),
  cefrApproved: z.literal(false),
  rightsCleared: z.literal(false),
  audioCertified: z.literal(false),
  curriculumApproved: z.literal(false),
  publicRelease: z.literal(false),
}).strict();

export const cefrjLessonDraftManifest = z.object({
  schemaVersion: z.literal(1),
  status: z.literal(CEFRJ_LESSON_DRAFT_STATUS),
  selection: sourceRef,
  levelSelection: sourceRef,
  authoringMethod: z.literal("MODEL_AUTHORED_FROM_SELECTED_HEADWORDS_NO_LEGACY_TEACHING_TEXT"),
  authoringAgent: text,
  window: z.object({ firstNewHeadword: z.number().int().positive(), lastNewHeadword: z.number().int().positive() }).strict(),
  count: z.number().int().positive(),
  semanticallyReviewed: z.literal(0),
  persianReviewed: z.literal(0),
  cefrReviewed: z.literal(0),
  rightsCleared: z.literal(0),
  audioCertified: z.literal(0),
  publiclyReleased: z.literal(0),
  lessons: z.array(lesson).min(1),
}).strict();
export type CefrjLessonDraftManifest = z.infer<typeof cefrjLessonDraftManifest>;

/** Metadata only: legacy definitions, translations and examples are not authoring input. */
export type ExistingEntryIdentity = { id: string; partsOfSpeech: string };
const posAlias: Record<string, Entry["senses"][number]["pos"]> = {
  "modal auxiliary": "modal", interjection: "exclamation", numeral: "number",
};
export const lessonPosFor = (pos: string): string => posAlias[pos] ?? pos;
const persianPos: Record<string, string> = {
  noun: "اسم", verb: "فعل", adjective: "صفت", adverb: "قید", preposition: "حرف اضافه",
  conjunction: "حرف ربط", pronoun: "ضمیر", determiner: "تعیین‌کننده", article: "حرف تعریف",
  modal: "فعل وجهی", exclamation: "حرف ندا", number: "عدد", particle: "حرف",
};
export function identityHasPos(identity: ExistingEntryIdentity, pos: string): boolean {
  const labels = identity.partsOfSpeech.split(/[,،/]/u).map(x => x.trim());
  return labels.includes(pos) || labels.includes(persianPos[pos] ?? "");
}
const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const hasPersian = (s: string) => /[آ-ی]/u.test(s);

/** Structural/source checks only. Passing this function is never independent certification. */
export function auditCefrjLessonDrafts(raw: unknown, context: {
  selected: SelectedRecord[];
  words: PlacedWord[];
  selectionSha256: string;
  levelSelectionSha256: string;
  identities: ExistingEntryIdentity[];
  inheritedEnglish?: string[];
  inheritedPersian?: string[];
}): string[] {
  const parsed = cefrjLessonDraftManifest.safeParse(raw);
  if (!parsed.success) return parsed.error.issues.map(x => x.path.join(".") + ": " + x.message);
  const batch = parsed.data;
  const issues: string[] = [];
  const fail = (s: string) => issues.push(s);
  if (batch.selection.file !== CEFRJ_A1_SELECTION_FILE || batch.selection.sha256 !== context.selectionSha256 ||
      batch.levelSelection.file !== CEFRJ_LEVEL_SELECTION_FILE || batch.levelSelection.sha256 !== context.levelSelectionSha256) {
    fail("source selection changed or an unrecognized selection file was supplied");
  }
  const newHeadwords = [...new Set(context.selected.filter(x => x.courseStatus === "NEW").map(x => x.cefrjHeadword))];
  const { firstNewHeadword: first, lastNewHeadword: last } = batch.window;
  const expected = newHeadwords.slice(first - 1, last);
  if (last < first || last > newHeadwords.length || batch.count !== last - first + 1 ||
      batch.lessons.length !== batch.count || JSON.stringify(batch.lessons.map(x => x.sourceHeadword)) !== JSON.stringify(expected)) {
    fail("missing, duplicated or out-of-order new-headword window");
  }
  const usedIds = new Set<string>();
  const earlierExamples = new Set<string>();
  for (const draft of batch.lessons) {
    const records = context.selected.filter(x => x.courseStatus === "NEW" && x.cefrjHeadword === draft.sourceHeadword);
    const word = context.words.find(x => x.level === "A1" && records.some(r => r.forms.some(f => x.forms.includes(f))));
    const e = draft.entry;
    const prefix = draft.sourceHeadword + ": ";
    if (!word || draft.levelWordId !== word.wordId || JSON.stringify(draft.existingEntryIds) !== JSON.stringify(word.entryIds)) {
      fail(prefix + "whole-app identity/spelling mapping changed");
    }
    if (e.headword !== draft.sourceHeadword || usedIds.has(e.id) || e.senses[0]?.id !== e.id) {
      fail(prefix + "headword or stable entry/sense identity is invalid");
    }
    usedIds.add(e.id);
    const compatible = word?.entryIds.filter(id => {
      const identity = context.identities.find(x => x.id === id);
      return identity && identityHasPos(identity, e.senses[0]!.pos);
    }) ?? [];
    if (compatible.length) {
      const identity = context.identities.find(x => x.id === e.id);
      if (!compatible.includes(e.id) || !identity || !identityHasPos(identity, e.senses[0]!.pos)) {
        fail(prefix + "preserved entry ID must belong to the spelling and the taught part of speech");
      }
    } else if (!e.id.startsWith("lex:A1:cefrj-") || context.identities.some(x => x.id === e.id)) {
      fail(prefix + "new provisional entry ID is not unique to the rebuild");
    }
    if (draft.sourceRecords.length !== records.length || e.senses.length !== records.length ||
        new Set(draft.sourceRecords.map(x => x.selectionId)).size !== records.length ||
        new Set(draft.sourceRecords.map(x => x.senseId)).size !== e.senses.length ||
        new Set(e.senses.map(x => x.id)).size !== e.senses.length) {
      fail(prefix + "every selected part of speech needs its own source-bound sense");
    }
    for (const source of draft.sourceRecords) {
      const r = records.find(x => x.selectionId === source.selectionId);
      const s = e.senses.find(x => x.id === source.senseId);
      if (!r || !s || s.pos !== lessonPosFor(r.pos) || /[آ-ی]/u.test(source.meaningEn)) {
        fail(prefix + "sense/source part of speech or English meaning is invalid");
      }
    }
    for (const s of e.senses) {
      if (s.id !== e.id && !s.id.startsWith(e.id + "#")) fail(prefix + "additional sense ID is outside its entry");
      const persian = [s.gloss, s.meaning, s.usage ?? "", ...s.grammar.map(x => x.note),
        s.mistake.wrongFa ?? "", s.mistake.rightFa ?? "", s.mistake.why,
        ...s.examples.map(x => x.fa), ...s.collocations.map(x => s.collocationFa?.[x] ?? "")];
      if (persian.some(x => !hasPersian(x))) fail(prefix + "all teaching fields need Persian explanations/translations");
      const english = [...s.grammar.map(x => x.pattern), ...s.examples.map(x => x.en), s.mistake.wrong, s.mistake.right];
      if (english.some(hasPersian)) fail(prefix + "Persian text leaked into an English teaching field");
      if (s.examples.length < 3 || s.check.length < 3) fail(prefix + "three distinct examples and three checks are required");
      const shown = new Set(s.examples.map(x => normalize(x.en)));
      if (shown.size !== s.examples.length || new Set(s.examples.map(x => normalize(x.fa))).size !== s.examples.length) {
        fail(prefix + "examples must differ in both languages");
      }
      if (s.mistake.wrong === s.mistake.right || normalize(s.mistake.wrongFa ?? "") === normalize(s.mistake.rightFa ?? "")) {
        fail(prefix + "mistake pair or its translations are identical");
      }
      if (new Set(s.check.map(x => x.id)).size !== s.check.length || s.check.at(-1)?.type !== "produce") {
        fail(prefix + "checks need distinct IDs and a final held-out production item");
      }
      for (const item of s.check) {
        if (!hasPersian(item.type === "cloze" ? item.fa : item.prompt)) fail(prefix + "checks need Persian instructions/translations");
        const feedback = item.type === "choice" ? item.options.map(x => x.why) : [item.why];
        if (feedback.some(x => !hasPersian(x))) fail(prefix + "check feedback must explain the answer in Persian");
        if (item.type !== "choice" && shown.has(normalize((item.type === "cloze" ? item.text : item.frame).replace("___", item.answer)))) {
          fail(prefix + "assessment reuses a teaching example");
        }
      }
      for (const example of s.examples) {
        const key = normalize(example.en);
        if (earlierExamples.has(key)) fail(prefix + "an example was reused by another draft");
        earlierExamples.add(key);
        if ((context.inheritedEnglish ?? []).some(x => normalize(x) === key) ||
            overlapsDraft(example.en, context.inheritedEnglish ?? [], 9) ||
            overlapsDraft(example.fa, context.inheritedPersian ?? [], 9)) {
          fail(prefix + "example overlaps legacy teaching text");
        }
      }
    }
  }
  return issues;
}
