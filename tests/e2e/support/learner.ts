import type { Page } from "@playwright/test";

/**
 * A goal-driven learner step (plan §14, U5). It answers an open field, or
 * takes the most prominent enabled action on the screen, so it moves
 * through onboarding, a lesson, Review or Practice without knowing their
 * labels. Toggles and audio controls never move a learner on, so it leaves
 * them alone; links count only when they stay in the app.
 *
 * With `keyboard`, it reaches the action with Tab and presses Enter, as a
 * keyboard-only learner would, and reports an action Tab cannot reach.
 */
export type LearnerStep = {
  action: string;
  /** Something else is drawn over the middle of the chosen action. */
  obstructed?: string;
  /** Tab never reached the chosen action. */
  unreachable?: boolean;
};

const CANDIDATES = "main button, main a[href^='/']";

export async function learnerStep(page: Page, options: { keyboard?: boolean; text?: string } = {}): Promise<LearnerStep | null> {
  const field = page.locator("main textarea:visible, main input[type=text]:visible, main input:not([type]):visible").first();
  if ((await field.count()) && (await field.isEditable()) && !(await field.inputValue())) {
    if (options.keyboard) {
      if (!(await tabTo(page, "main textarea, main input"))) return { action: "type", unreachable: true };
      await page.keyboard.type(options.text ?? "I like it.");
    } else {
      await field.fill(options.text ?? "I like it.");
    }
    if ((await field.evaluate((node) => node.tagName)) === "INPUT") await field.press("Enter");
    return { action: "type" };
  }

  const choice = await page.evaluate((selector) => {
    const AUDIO = /listen|replay|hear|slow|play|audio|record|pronunciation|گوش|بشنو|پخش|صدا|ضبط|تلفظ/i;
    const elements = [...document.querySelectorAll(selector)] as HTMLElement[];
    // Relative luminance of a computed colour, for telling a filled button
    // from a plain one.
    const luminance = (color: string) => {
      const [r = 0, g = 0, b = 0] = (color.match(/[\d.]+/g) ?? []).map(Number);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    const alpha = (color: string) => {
      const parts = color.match(/[\d.]+/g) ?? [];
      return parts.length > 3 ? Number(parts[3]) : 1;
    };
    // The colour actually behind an element: its nearest painted ancestor.
    const behind = (element: Element | null): string => {
      for (let node = element; node; node = node.parentElement) {
        const color = getComputedStyle(node).backgroundColor;
        if (alpha(color) > 0.9) return color;
      }
      return "rgb(255, 255, 255)";
    };
    let best = -1;
    let bestScore = 0;
    elements.forEach((element, position) => {
      if ((element as HTMLButtonElement).disabled || element.hasAttribute("aria-pressed") || element.getClientRects().length === 0) return;
      // A link to the page already shown goes nowhere.
      if (element.getAttribute("aria-current") === "page") return;
      if (AUDIO.test(`${element.getAttribute("aria-label") ?? ""} ${element.textContent ?? ""}`)) return;
      const box = element.getBoundingClientRect();
      // A filled action stands out from the page the way a primary action
      // should, so it counts for more than its size alone.
      const fill = getComputedStyle(element).backgroundColor;
      const filled = alpha(fill) > 0.9 && Math.abs(luminance(fill) - luminance(behind(element.parentElement))) > 0.4;
      const score = box.width * box.height * (filled ? 6 : 1);
      if (score > bestScore) {
        bestScore = score;
        best = position;
      }
    });
    if (best < 0) return null;
    const target = elements[best]!;
    target.setAttribute("data-learner-target", "");
    target.scrollIntoView({ block: "center" });
    const box = target.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    const obstructed = hit && !target.contains(hit) ? `${hit.tagName.toLowerCase()}${hit.className ? `.${String(hit.className).split(" ")[0]}` : ""}` : undefined;
    return { name: (target.innerText || target.getAttribute("aria-label") || "").trim().slice(0, 40), obstructed };
  }, CANDIDATES);
  if (!choice) return null;

  const target = page.locator("[data-learner-target]");
  let unreachable = false;
  if (options.keyboard) {
    unreachable = !(await tabTo(page, "[data-learner-target]"));
    if (!unreachable) await page.keyboard.press("Enter");
  } else {
    await target.click();
  }
  await page.evaluate(() => document.querySelector("[data-learner-target]")?.removeAttribute("data-learner-target"));
  return { action: choice.name, obstructed: choice.obstructed, ...(unreachable ? { unreachable } : {}) };
}

/** Press Tab until focus lands on the first element matching `selector`. */
async function tabTo(page: Page, selector: string): Promise<boolean> {
  for (let press = 0; press < 80; press += 1) {
    if (await page.evaluate((selector) => document.activeElement?.matches(selector) ?? false, selector)) return true;
    await page.keyboard.press("Tab");
  }
  return false;
}
