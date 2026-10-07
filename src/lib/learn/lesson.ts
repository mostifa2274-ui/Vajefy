import type { CheckItem, Contrast, Scene, Sense } from "./content";
import type { PilotIndex, PilotTarget, TargetContent } from "./pilot";
import { newId } from "./session";
import { readyToIntroduce } from "./targets";
import { bestSpelling, shuffle } from "./text";
import type { AssessmentPart } from "./ops";
import type { Grade, PracticeSkill } from "./types";

/**
 * A guided lesson. For each new target the sequence is: understand (teaching
 * card with audio) → written retrieval (type the English word from its Persian
 * meaning) → listening (hear the recorded word, without seeing it, and choose
 * its meaning) → use it in a new context → retrieve it again after the other
 * words, which is the answer that starts its spaced schedule. Steps of
 * different words interleave. A wrong answer brings feedback that reteaches the
 * word and one prompted retry later in the lesson; the lesson ends by applying
 * the words in a contrast lesson or a short scene when one fits.
 *
 * Unaided answers and prompted retries are kept apart: a word is ready for now
 * only when its latest unaided check succeeded (`lessonReadiness`), which is
 * not long-term mastery.
 */

export type ItemRef =
  | { from: "sense"; target: string; item: string }
  | { from: "contrast"; contrast: string; item: string; target: string }
  | { from: "scene"; scene: string; item: string; target: string }
  /**
   * A generated item: choose the Persian meaning of the word (`meaning`) or the
   * word for a meaning (`form`), type the word from its meaning (`recall`, no
   * options), or choose the meaning of the recorded word heard (`listen`).
   */
  | { from: "generated"; target: string; mode: "meaning" | "form" | "recall" | "listen"; options: string[] };

/** Check-up roles measure retention (docs/LEARNING_MEASURES.md) and never schedule or teach. */
export type Role = "retrieve" | "listen" | "context" | "delayed" | "retry" | "apply" | "checkup-use" | "checkup-meaning";

/** Roles whose answers are unaided: no answer was shown for the item before. */
const UNAIDED: ReadonlySet<Role> = new Set(["retrieve", "listen", "context", "delayed"]);

export type LessonStep =
  | { kind: "teach"; target: string }
  | { kind: "check"; ref: ItemRef; role: Role }
  | { kind: "contrast"; contrast: string }
  | { kind: "scene"; scene: string }
  | { kind: "write"; scene: string };

export type LessonAnswer = {
  op: string;
  step: number;
  /**
   * `close`: right word with a small spelling slip. `skipped`: a listening
   * question the learner could not hear, which is no evidence either way.
   */
  result: "correct" | "close" | "wrong" | "skipped";
  given?: string;
  at: number;
  /** Active-visible time until the learner answered this step. */
  responseMs?: number;
};

export type LessonTimingSample = {
  step: number;
  at: number;
  kind: LessonStep["kind"];
  role?: Role;
  target?: string;
  /** Active-visible time for the complete step, excluding hidden/idle time. */
  activeMs: number;
  /** Active-visible time before the answer, when this was an answered check. */
  responseMs?: number;
  /** Time spent reading correction/feedback after answering. */
  feedbackMs?: number;
};

export type LessonSession = {
  id: string;
  kind: "lesson";
  status: "active" | "done";
  createdAt: number;
  updatedAt: number;
  /** What this session is: new words, one contrast or scene on its own, or a delayed check-up. */
  mode: "lesson" | "contrast" | "scene" | "checkup";
  /** For a check-up: days since each target was first met. */
  delays?: Record<string, number>;
  /** Required check-up evidence that was unavailable; absence is never scored as wrong. */
  missing?: Record<string, AssessmentPart[]>;
  targets: string[];
  steps: LessonStep[];
  index: number;
  answers: LessonAnswer[];
  /**
   * Completed-step timing evidence. Optional for saved sessions created before
   * P4 timing existed; missing history is unknown, never zero.
   */
  timing?: LessonTimingSample[];
};

/** A resolved check item, ready to show. */
type TaskSupport = { en: string; fa: string };

/** `why` is Persian; for a wrong option it is the gloss of `whyWord`. */
type ChoiceOption = { text: string; ok: boolean; why: string; whyWord?: string; lang: "en" | "fa" };

export type ResolvedItem =
  | { type: "choice"; prompt: string; promptLang: "en" | "fa"; options: ChoiceOption[]; support?: TaskSupport[] }
  | { type: "cloze"; text: string; answer: string; accept: string[]; fa: string; why: string; support?: TaskSupport[] }
  | { type: "produce"; prompt: string; frame: string; answer: string; accept: string[]; why: string; support?: TaskSupport[] }
  /** Type the English word for a Persian meaning; `shape` shows its first letter and length. */
  | { type: "recall"; prompt: string; pos: Sense["pos"]; shape: string; answer: string; accept: string[]; why: string; support?: undefined }
  /** Hear the recorded word without seeing it (`word`, shown after answering) and choose its meaning. */
  | { type: "listen"; target: string; word: string; options: ChoiceOption[]; support?: undefined };

/** Why an option is right (the target's meaning) or what a wrong one means. */
function explainOption(option: PilotTarget, target: TargetContent): { why: string; whyWord?: string } {
  return option.sense.id === target.sense.id
    ? { why: target.sense.meaning }
    : { why: option.sense.gloss, whyWord: option.entry.headword };
}

function findItem(items: CheckItem[], id: string) {
  return items.find((item) => item.id === id);
}

function fromContent(item: CheckItem): ResolvedItem {
  if (item.type === "choice") {
    return {
      type: "choice",
      prompt: item.prompt,
      promptLang: /[؀-ۿ]/.test(item.prompt) ? "fa" : "en",
      options: item.options.map((option) => ({ ...option, lang: /[؀-ۿ]/.test(option.text) ? "fa" : "en" })),
      support: item.support,
    };
  }
  return item;
}

/**
 * The ways of writing a headword that count as right: "a, an" accepts "a" and
 * "an"; the first is the one shown as the answer.
 */
export function writtenForms(headword: string): string[] {
  const parts = headword
    .split(/\s*[,/]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? parts : [headword];
}

/**
 * A word's shape as a constrained cue: its first letter, then a gap per letter
 * ("b _ _"). A word of one or two letters shows only gaps, so the cue never
 * gives the answer away.
 */
export function shapeOf(word: string): string {
  const letters = word.replace(/[^a-z]/gi, "").length;
  return word
    .split(" ")
    .map((part, index) =>
      [...part].map((letter, position) => (index === 0 && position === 0 && letters > 2 ? letter : /[a-z]/i.test(letter) ? "_" : letter)).join(" "),
    )
    .join("   ");
}

export function resolveItem(index: PilotIndex, ref: ItemRef): ResolvedItem | null {
  if (ref.from === "generated") {
    const target = index.content.get(ref.target);
    if (!target) return null;
    if (ref.mode === "recall") {
      const forms = writtenForms(target.entry.headword);
      return {
        type: "recall",
        prompt: target.sense.gloss,
        pos: target.sense.pos,
        shape: shapeOf(forms[0]!),
        answer: forms[0]!,
        accept: forms.slice(1),
        why: target.sense.meaning,
      };
    }
    const options = ref.options.map((id) => index.bySense.get(id)).filter((option): option is PilotTarget => Boolean(option));
    const meanings = options.map((option) => ({
      text: option.sense.gloss,
      ok: option.sense.id === target.sense.id,
      ...explainOption(option, target),
      lang: "fa" as const,
    }));
    if (ref.mode === "listen") return { type: "listen", target: target.sense.id, word: target.entry.headword, options: meanings };
    if (ref.mode === "meaning") {
      return { type: "choice", prompt: target.entry.headword, promptLang: "en", options: meanings };
    }
    return {
      type: "choice",
      prompt: target.sense.gloss,
      promptLang: "fa",
      options: options.map((option) => ({
        text: option.entry.headword,
        ok: option.sense.id === target.sense.id,
        ...explainOption(option, target),
        lang: "en" as const,
      })),
    };
  }
  if (ref.from === "sense") {
    const item = findItem(index.content.get(ref.target)?.sense.check ?? [], ref.item);
    return item ? fromContent(item) : null;
  }
  if (ref.from === "contrast") {
    const item = findItem(index.contrasts.find((contrast) => contrast.id === ref.contrast)?.check ?? [], ref.item);
    return item ? fromContent(item) : null;
  }
  const item = findItem(index.scenes.find((scene) => scene.id === ref.scene)?.check ?? [], ref.item);
  return item ? fromContent(item) : null;
}

/** The skill an item gives evidence for. */
export function skillOf(ref: ItemRef, item: ResolvedItem): PracticeSkill {
  // Typing the word from its meaning is form recall, as in Smart Practice's
  // spelling questions; hearing it is listening; choosing is meaning.
  if (ref.from === "generated") return ref.mode === "recall" ? "spelling" : ref.mode === "listen" ? "listening" : "meaning";
  // Every authored check item puts the target in a sentence or situation.
  // Produce happens to be typed, but its construct is still context rather
  // than isolated spelling; response modality must not redefine the evidence.
  switch (item.type) {
    case "choice":
    case "cloze":
    case "produce":
      return "context";
    case "recall":
      return "spelling";
    case "listen":
      return "listening";
  }
}

/** Grade a typed answer against the answer and its accepted alternatives. */
export function gradeTyped(typed: string, answer: string, accept: string[]): LessonAnswer["result"] {
  const clean = (value: string) => value.trim().replace(/[.!?]+$/, "").replace(/\s+/g, " ");
  const result = bestSpelling(clean(typed), [answer, ...accept].map(clean));
  return result === "exact" ? "correct" : result === "close" ? "close" : "wrong";
}

export function gradeOf(result: Exclude<LessonAnswer["result"], "skipped">): Grade {
  return result === "correct" ? "good" : result === "close" ? "hard" : "again";
}

/** The targets of each part of speech, built once per catalogue. */
const byPos = new WeakMap<PilotTarget[], Map<Sense["pos"], PilotTarget[]>>();
function targetsOfPos(index: PilotIndex, pos: Sense["pos"]): PilotTarget[] {
  let groups = byPos.get(index.targets);
  if (!groups) {
    groups = new Map();
    for (const target of index.targets) {
      const group = groups.get(target.sense.pos);
      if (group) group.push(target);
      else groups.set(target.sense.pos, [target]);
    }
    byPos.set(index.targets, groups);
  }
  return groups.get(pos) ?? [];
}

/** Options for a generated choice: the target and three other meanings, preferring the same part of speech. */
function distractors(index: PilotIndex, target: PilotTarget, random: () => number): string[] {
  const fits = (other: PilotTarget) => other.entry.id !== target.entry.id && other.sense.gloss !== target.sense.gloss;
  const picked: string[] = [];
  // Three random senses of other words, same part of speech first. This runs
  // several times per word as the learner starts a lesson, so it shuffles only
  // until three are found instead of the whole catalogue.
  for (const pool of [targetsOfPos(index, target.sense.pos), index.targets]) {
    const order = [...pool];
    for (let i = order.length - 1; i >= 0 && picked.length < 3; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
      const item = order[i]!;
      if (fits(item) && !picked.includes(item.sense.id)) picked.push(item.sense.id);
    }
  }
  return shuffleWith([target.sense.id, ...picked], random);
}

function shuffleWith<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** The last authored sense check is held out from teaching/practice for delayed assessment. */
export function heldOutItem(sense: Sense | undefined): CheckItem | undefined {
  return sense?.check.at(-1);
}

function teachingChecks(sense: Sense | undefined): CheckItem[] {
  return sense?.check.slice(0, -1) ?? [];
}

function contentItem(sense: Sense | undefined, types: CheckItem["type"][], used: Set<string>): CheckItem | undefined {
  const checks = teachingChecks(sense);
  for (const type of types) {
    const found = checks.find((item) => item.type === type && !used.has(item.id));
    if (found) return found;
  }
  return undefined;
}

/** The target an applied item mostly tests: the one whose word is the answer, else the first. */
function targetFor(item: CheckItem, targets: string[], index: PilotIndex): string {
  const answer = item.type === "choice" ? item.options.find((option) => option.ok)?.text ?? "" : item.answer;
  const words = answer.toLowerCase().split(/[^a-z']+/);
  return (
    targets.find((id) => {
      const headword = index.bySense.get(id)?.entry.headword.toLowerCase() ?? "";
      return headword && words.some((word) => word.startsWith(headword.split(/[ ,]/)[0]!));
    }) ?? targets[0]!
  );
}

function applySteps(kind: "contrast" | "scene", item: Contrast | Scene, index: PilotIndex): LessonStep[] {
  const targets = kind === "contrast" ? (item as Contrast).entries : (item as Scene).targets;
  const steps: LessonStep[] = [kind === "contrast" ? { kind: "contrast", contrast: item.id } : { kind: "scene", scene: item.id }];
  for (const check of item.check) {
    const target = targetFor(check, targets, index);
    steps.push({
      kind: "check",
      role: "apply",
      ref: kind === "contrast" ? { from: "contrast", contrast: item.id, item: check.id, target } : { from: "scene", scene: item.id, item: check.id, target },
    });
  }
  if (kind === "scene") steps.push({ kind: "write", scene: item.id });
  return steps;
}

/**
 * A lesson for these targets. Their content must be loaded (`loadPilot`); the
 * other words it offers as options need only be listed.
 */
export function buildLesson(
  index: PilotIndex,
  targets: PilotTarget[],
  known: Set<string>,
  now: number,
  random: () => number = Math.random,
): LessonSession {
  const steps: LessonStep[] = [];
  const used = new Map<string, Set<string>>(targets.map((target) => [target.sense.id, new Set<string>()]));
  const senseOf = (target: PilotTarget) => index.content.get(target.sense.id)?.sense;
  const contextStep = (target: PilotTarget): LessonStep => {
    const item = contentItem(senseOf(target), ["cloze", "choice", "produce"], used.get(target.sense.id)!);
    if (item) {
      used.get(target.sense.id)!.add(item.id);
      return { kind: "check", role: "context", ref: { from: "sense", target: target.sense.id, item: item.id } };
    }
    return { kind: "check", role: "context", ref: { from: "generated", target: target.sense.id, mode: "form", options: distractors(index, target, random) } };
  };

  // Listening uses the word's recorded clip; without one there is no step.
  const listenStep = (target: PilotTarget): LessonStep[] =>
    hasRecording(index, target.sense.id)
      ? [{ kind: "check", role: "listen", ref: { from: "generated", target: target.sense.id, mode: "listen", options: distractors(index, target, random) } }]
      : [];

  targets.forEach((target, position) => {
    steps.push({ kind: "teach", target: target.sense.id });
    steps.push({ kind: "check", role: "retrieve", ref: { from: "generated", target: target.sense.id, mode: "recall", options: [] } });
    // Interleave: the previous word is heard and used in a new context after this one is taught.
    const previous = targets[position - 1];
    if (previous) steps.push(...listenStep(previous), contextStep(previous));
  });
  const last = targets[targets.length - 1];
  if (last) steps.push(...listenStep(last), contextStep(last));

  for (const target of targets) {
    const item = contentItem(senseOf(target), ["produce", "cloze", "choice"], used.get(target.sense.id)!);
    steps.push({
      kind: "check",
      role: "delayed",
      ref: item
        ? { from: "sense", target: target.sense.id, item: item.id }
        : { from: "generated", target: target.sense.id, mode: "form", options: distractors(index, target, random) },
    });
  }

  // Apply the words: a contrast all of whose words are now met, else the scene that reuses the most.
  const met = new Set([...known, ...targets.map((target) => target.sense.id)]);
  const ids = new Set(targets.map((target) => target.sense.id));
  const contrast = index.contrasts.find((item) => item.entries.some((id) => ids.has(id)) && item.entries.every((id) => met.has(id)));
  if (contrast) steps.push(...applySteps("contrast", contrast, index));
  else {
    const scene = [...index.scenes]
      .map((item) => ({ item, overlap: item.targets.filter((id) => met.has(id)).length, fresh: item.targets.some((id) => ids.has(id)) }))
      .filter((candidate) => candidate.fresh && candidate.overlap >= 2)
      .sort((a, b) => b.overlap - a.overlap)[0]?.item;
    if (scene) steps.push(...applySteps("scene", scene, index));
  }

  return {
    id: newId(),
    kind: "lesson",
    status: steps.length ? "active" : "done",
    createdAt: now,
    updatedAt: now,
    mode: "lesson",
    targets: targets.map((target) => target.sense.id),
    steps,
    index: 0,
    answers: [],
  };
}

/** A contrast or scene on its own, for practice from the Learn page. */
export function buildApplication(index: PilotIndex, kind: "contrast" | "scene", id: string, now: number): LessonSession | null {
  const item = kind === "contrast" ? index.contrasts.find((contrast) => contrast.id === id) : index.scenes.find((scene) => scene.id === id);
  if (!item) return null;
  const steps = applySteps(kind, item, index);
  return {
    id: newId(),
    kind: "lesson",
    status: "active",
    createdAt: now,
    updatedAt: now,
    mode: kind,
    targets: kind === "contrast" ? (item as Contrast).entries : (item as Scene).targets,
    steps,
    index: 0,
    answers: [],
  };
}

/** Whether a sense has a recorded word clip in either accent. */
export function hasRecording(index: Pick<PilotIndex, "audio">, senseId: string): boolean {
  const clips = index.audio[senseId];
  return Boolean(clips?.gb?.word || clips?.us?.word);
}

/** The targets whose content a session's steps show: the rest need only be listed. */
export function contentIds(session: LessonSession): string[] {
  const ids = new Set<string>();
  for (const step of session.steps) {
    if (step.kind === "teach") ids.add(step.target);
    else if (step.kind === "check" && (step.ref.from === "sense" || step.ref.from === "generated")) ids.add(step.ref.target);
  }
  return [...ids];
}

export function answerFor(session: LessonSession, step = session.index): LessonAnswer | undefined {
  return session.answers.find((answer) => answer.step === step);
}

/**
 * Record an answer. A wrong retrieval, listening or context answer earns one
 * prompted retry two steps later, after feedback that showed the answer: typed
 * recall again, or listening again (never for the delayed retrieval, which
 * starts the schedule, and never twice for the same target). A skipped
 * listening question earns nothing and costs nothing.
 */
export function answerLesson(
  session: LessonSession,
  answer: Omit<LessonAnswer, "step">,
  index: PilotIndex,
  random: () => number = Math.random,
): LessonSession {
  if (answerFor(session)) return session;
  const step = session.steps[session.index];
  let steps = session.steps;
  if (step?.kind === "check" && answer.result === "wrong" && (step.role === "retrieve" || step.role === "listen" || step.role === "context")) {
    const target = step.ref.target;
    const retried = steps.some((other) => other.kind === "check" && other.role === "retry" && other.ref.target === target);
    const pilotTarget = index.bySense.get(target);
    if (!retried && pilotTarget) {
      const mode = step.role === "listen" ? "listen" : step.ref.from === "generated" && step.ref.mode === "meaning" ? "form" : "recall";
      const options = mode === "recall" ? [] : distractors(index, pilotTarget, random);
      const retry: LessonStep = { kind: "check", role: "retry", ref: { from: "generated", target, mode, options } };
      const at = Math.min(steps.length, session.index + 3);
      steps = [...steps.slice(0, at), retry, ...steps.slice(at)];
    }
  }
  return {
    ...session,
    steps,
    answers: [...session.answers, { ...answer, step: session.index }],
    updatedAt: answer.at,
  };
}

export function advanceLesson(session: LessonSession, now: number): LessonSession {
  const index = Math.min(session.steps.length, session.index + 1);
  return { ...session, index, status: index >= session.steps.length ? "done" : "active", updatedAt: now };
}

export function lessonStats(session: LessonSession) {
  const checks = session.answers.filter((answer) => answer.result !== "skipped");
  return {
    answered: checks.length,
    correct: checks.filter((answer) => answer.result !== "wrong").length,
    missed: [...new Set(
      checks
        .filter((answer) => answer.result === "wrong")
        .map((answer) => {
          const step = session.steps[answer.step];
          return step?.kind === "check" ? step.ref.target : null;
        })
        .filter((id): id is string => Boolean(id)),
    )],
  };
}

/**
 * Immediate readiness of a lesson's words, from this lesson's answers alone:
 *
 * - `ready`: the word's latest unaided check (written retrieval, listening,
 *   context or the delayed retrieval) succeeded;
 * - `helped`: its latest unaided check failed, but a prompted retry after it
 *   succeeded. A retry follows feedback that showed the answer, so the word
 *   stays helped until an unaided attempt succeeds;
 * - `again`: its latest unaided check failed and no retry has succeeded since.
 *
 * Skipped listening is no evidence. Words never checked are left out. This is
 * readiness for now, not long-term mastery, which only spaced reviews show.
 */
export type Readiness = "ready" | "helped" | "again";

export function lessonReadiness(session: LessonSession): Record<string, Readiness> {
  const state = new Map<string, { unaided: boolean; helped: boolean }>();
  const targets = new Set(session.targets);
  for (const answer of session.answers) {
    const step = session.steps[answer.step];
    if (step?.kind !== "check" || answer.result === "skipped" || !targets.has(step.ref.target)) continue;
    const ok = answer.result !== "wrong";
    const current = state.get(step.ref.target);
    if (UNAIDED.has(step.role)) state.set(step.ref.target, { unaided: ok, helped: false });
    else if (step.role === "retry" && current) state.set(step.ref.target, { ...current, helped: current.helped || ok });
  }
  return Object.fromEntries(
    session.targets.flatMap((id) => {
      const entry = state.get(id);
      if (!entry) return [];
      return [[id, entry.unaided ? "ready" : entry.helped ? "helped" : "again"] as const];
    }),
  );
}

/** A word is ready for the delayed check-up this many days after it was first met. */
export const CHECKUP_DELAY_DAYS = 30;
/** Words in one check-up. */
export const CHECKUP_SIZE = 10;
const DAY_MS = 86_400_000;

/** Lesson prompts the learner has already answered, as "<sense>/<item>". */
export function seenPrompts(sessions: readonly { kind: string }[]): Set<string> {
  const seen = new Set<string>();
  for (const session of sessions) {
    if (session.kind !== "lesson") continue;
    const lesson = session as LessonSession;
    for (const answer of lesson.answers) {
      const step = lesson.steps[answer.step];
      if (step?.kind === "check" && step.ref.from === "sense") seen.add(`${step.ref.target}/${step.ref.item}`);
    }
  }
  return seen;
}

/**
 * Targets ready for the delayed check-up: first met at least CHECKUP_DELAY_DAYS
 * ago (their first review) and not checked in the last CHECKUP_DELAY_DAYS.
 * Oldest first, with the days since each was first met.
 */
export function checkupCandidates(
  targetIds: readonly string[],
  history: readonly { id: string; at: number }[],
  sessions: readonly { kind: string }[],
  now: number,
): { id: string; delayDays: number }[] {
  const first = new Map<string, number>();
  for (const event of history) {
    const known = first.get(event.id);
    if (known === undefined || event.at < known) first.set(event.id, event.at);
  }
  const recent = new Set<string>();
  for (const session of sessions) {
    const lesson = session as LessonSession;
    if (lesson.kind === "lesson" && lesson.mode === "checkup" && now - lesson.createdAt < CHECKUP_DELAY_DAYS * DAY_MS) {
      for (const id of lesson.targets) recent.add(id);
    }
  }
  return targetIds
    .flatMap((id) => {
      const met = first.get(id);
      if (met === undefined || recent.has(id)) return [];
      const delayDays = Math.floor((now - met) / DAY_MS);
      return delayDays >= CHECKUP_DELAY_DAYS ? [{ id, delayDays }] : [];
    })
    .sort((a, b) => b.delayDays - a.delayDays || a.id.localeCompare(b.id));
}

/**
 * A delayed check-up uses held-out authored context items that normal lessons
 * never consume. If a target has no still-fresh held-out item, the required
 * use evidence is marked missing instead of being replaced by an easier
 * generated recognition question. Meaning recognition keeps the same format
 * in both study arms and comes after use so it cannot cue the context answer.
 */
export function buildCheckup(
  index: PilotIndex,
  candidates: { id: string; delayDays: number }[],
  seen: Set<string>,
  now: number,
  random: () => number = Math.random,
): LessonSession {
  const chosen = candidates
    .flatMap((candidate) => {
      const target = index.bySense.get(candidate.id);
      return target ? [{ target, delayDays: candidate.delayDays }] : [];
    })
    .slice(0, CHECKUP_SIZE);
  const use: LessonStep[] = [];
  const meaning: LessonStep[] = [];
  const missing: Record<string, AssessmentPart[]> = {};

  for (const { target } of chosen) {
    const sense = index.content.get(target.sense.id)?.sense;
    const heldOut = heldOutItem(sense);
    const promptId = heldOut ? `${target.sense.id}/${heldOut.id}` : null;

    if (heldOut && promptId && !seen.has(promptId)) {
      use.push({
        kind: "check",
        role: "checkup-use",
        ref: { from: "sense", target: target.sense.id, item: heldOut.id },
      });
    } else {
      missing[target.sense.id] = ["use"];
    }

    meaning.push({
      kind: "check",
      role: "checkup-meaning",
      ref: { from: "generated", target: target.sense.id, mode: "meaning", options: distractors(index, target, random) },
    });
  }

  const steps = [...shuffleWith(use, random), ...shuffleWith(meaning, random)];
  return {
    id: newId(),
    kind: "lesson",
    status: steps.length ? "active" : "done",
    createdAt: now,
    updatedAt: now,
    mode: "checkup",
    delays: Object.fromEntries(chosen.map(({ target, delayDays }) => [target.sense.id, delayDays])),
    ...(Object.keys(missing).length ? { missing } : {}),
    targets: chosen.map(({ target }) => target.sense.id),
    steps,
    index: 0,
    answers: [],
  };
}

/** A check-up's result. Missing held-out evidence is excluded, never scored as wrong. */
export function checkupResult(session: LessonSession): {
  checked: number;
  usable: number;
  meaning: number;
  use: number;
  missing: number;
} {
  const outcome = new Map<string, { meaning?: boolean; use?: boolean }>();
  for (const answer of session.answers) {
    const step = session.steps[answer.step];
    if (step?.kind !== "check" || (step.role !== "checkup-use" && step.role !== "checkup-meaning")) continue;
    const entry = outcome.get(step.ref.target) ?? {};
    entry[step.role === "checkup-use" ? "use" : "meaning"] = answer.result !== "wrong";
    outcome.set(step.ref.target, entry);
  }
  const complete = session.targets
    .map((id) => outcome.get(id) ?? {})
    .filter((item) => item.meaning !== undefined && item.use !== undefined);
  const all = session.targets.map((id) => outcome.get(id) ?? {});
  return {
    checked: complete.length,
    usable: complete.filter((item) => item.meaning && item.use).length,
    meaning: all.filter((item) => item.meaning).length,
    use: all.filter((item) => item.use).length,
    missing: session.targets.length - complete.length,
  };
}

/** How many new targets fit today: the learner's time, less any review backlog. */
export function lessonSize(minutes: number, due: number, sessionSize: number): number {
  const base = minutes <= 5 ? 2 : minutes >= 15 ? 5 : 3;
  if (due >= sessionSize * 2) return 0;
  if (due >= sessionSize) return 1;
  return base;
}

/**
 * Targets the learner has not met yet, in introduction order. A further sense
 * waits until its word's first sense has been met, so a lesson never teaches
 * two meanings of one word.
 */
export function nextTargets(ordered: PilotTarget[], cards: Record<string, unknown>, count: number): PilotTarget[] {
  return ordered
    .filter((target) => !cards[target.sense.id] && readyToIntroduce(target.sense.id, (id) => Boolean(cards[id])))
    .slice(0, count);
}

export { shuffle };
