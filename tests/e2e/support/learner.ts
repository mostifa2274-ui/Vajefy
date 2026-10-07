import type { Page } from "@playwright/test";

/**
 * A goal-driven learner step (plan §14, U5). It answers an open field, or
 * presses the most prominent enabled action on the screen, so it moves
 * through a lesson, Review or Practice without knowing their labels. Toggles
 * and audio controls never move a learner on, so it leaves them alone.
 *
 * Returns what it did, or null when nothing on the screen can be done.
 */
export async function learnerStep(page: Page): Promise<string | null> {
  const field = page.locator("main textarea:visible, main input[type=text]:visible, main input:not([type]):visible").first();
  if ((await field.count()) && (await field.isEditable()) && !(await field.inputValue())) {
    await field.fill("I like it.");
    if ((await field.evaluate((node) => node.tagName)) === "INPUT") await field.press("Enter");
    return "type";
  }
  const index = await page.evaluate(() => {
    const AUDIO = /listen|replay|hear|slow|play|audio|record|گوش|بشنو|پخش|صدا|ضبط/i;
    const buttons = [...document.querySelectorAll("main button")] as HTMLButtonElement[];
    let best = -1;
    let bestArea = 0;
    buttons.forEach((button, position) => {
      if (button.disabled || button.hasAttribute("aria-pressed") || button.getClientRects().length === 0) return;
      if (AUDIO.test(`${button.getAttribute("aria-label") ?? ""} ${button.textContent ?? ""}`)) return;
      const box = button.getBoundingClientRect();
      if (box.width * box.height > bestArea) {
        bestArea = box.width * box.height;
        best = position;
      }
    });
    return best;
  });
  if (index < 0) return null;
  const button = page.locator("main button").nth(index);
  const name = (await button.innerText()).trim().slice(0, 40);
  await button.click();
  return name;
}
