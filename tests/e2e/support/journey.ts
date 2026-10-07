import type { Page } from "@playwright/test";
import { learnerStep } from "./learner";

/**
 * Runs a goal-driven learner journey (plan §14, U5) and applies the failure
 * heuristics of U7 at every step.
 */
export type JourneyFinding = {
  kind:
    | "impossible-completion"
    | "dead-end"
    | "navigation-loop"
    | "interaction-budget"
    | "overflow"
    | "obstructed-action"
    | "unreachable-focus"
    | "runtime-error";
  step: number;
  detail: string;
};

export type JourneyResult = { steps: number; actions: string[]; findings: JourneyFinding[]; reached: boolean };

/** Collects console errors and uncaught exceptions for the life of the page. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

export async function runJourney(
  page: Page,
  options: {
    /** True once the learner's goal is reached. */
    reached: () => Promise<boolean>;
    /** Most interactions a learner should need. */
    budget: number;
    keyboard?: boolean;
    /** What the learner types into open answers. */
    text?: string;
    errors?: string[];
    /** Stop at this many steps even when the goal is not reached. */
    limit?: number;
  },
): Promise<JourneyResult> {
  const findings: JourneyFinding[] = [];
  const actions: string[] = [];
  const seen = new Map<string, number>();
  const limit = options.limit ?? options.budget * 2;
  let reportedErrors = 0;
  for (let step = 0; step < limit; step += 1) {
    await page.locator("html[data-progress-ready]").waitFor({ state: "attached", timeout: 30_000 });
    await page.waitForTimeout(80);
    if (await options.reached()) {
      if (step > options.budget) {
        findings.push({ kind: "interaction-budget", step, detail: `${step} interactions; the budget is ${options.budget}` });
      }
      return { steps: step, actions, findings: [...findings, ...errorFindings()], reached: true };
    }
    if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) {
      findings.push({ kind: "overflow", step, detail: `${page.url()} scrolls sideways` });
    }
    const state = await page.evaluate(() => `${location.pathname}|${document.querySelector("main")?.innerText.slice(0, 2000) ?? ""}`);
    const repeats = (seen.get(state) ?? 0) + 1;
    seen.set(state, repeats);
    if (repeats > 3) {
      findings.push({ kind: "navigation-loop", step, detail: `the same screen came back ${repeats} times: ${state.slice(0, 120)}` });
      break;
    }
    let result = await learnerStep(page, { keyboard: options.keyboard, text: options.text });
    // A screen still loading is not a dead end: give it a few seconds.
    for (let wait = 0; !result && wait < 5; wait += 1) {
      await page.waitForTimeout(1_000);
      if (await options.reached()) break;
      result = await learnerStep(page, { keyboard: options.keyboard, text: options.text });
    }
    if (!result && (await options.reached())) continue;
    if (!result) {
      findings.push({ kind: "dead-end", step, detail: `nothing to do on ${page.url()}` });
      break;
    }
    actions.push(result.action);
    if (result.obstructed) findings.push({ kind: "obstructed-action", step, detail: `"${result.action}" is covered by ${result.obstructed}` });
    if (result.unreachable) {
      findings.push({ kind: "unreachable-focus", step, detail: `Tab never reaches "${result.action}"` });
      break;
    }
  }
  findings.push({ kind: "impossible-completion", step: actions.length, detail: `goal not reached after: ${actions.slice(-12).join(" | ")}` });
  return { steps: actions.length, actions, findings: [...findings, ...errorFindings()], reached: false };

  function errorFindings(): JourneyFinding[] {
    const errors = options.errors ?? [];
    const fresh = errors.slice(reportedErrors);
    reportedErrors = errors.length;
    return fresh.map((detail) => ({ kind: "runtime-error" as const, step: actions.length, detail: detail.slice(0, 300) }));
  }
}
