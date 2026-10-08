import type { CheckItem } from "./content";
import {
  authoredTaskText,
  containsTokenSequence,
  normalizedTokens,
} from "./learner-language";

/**
 * Support is learner-visible before the answer. It must explain vocabulary
 * already visible in the question, never supply the missing answer.
 *
 * A choice may gloss a word shared by every option (for example "book" in
 * "my book", "I book" and "you book"), but not a word present in only
 * some options. The latter could make the correct option identifiable.
 */
export function taskSupportIssues(item: CheckItem): string[] {
  if (!item.support?.length) return [];

  const issues: string[] = [];
  const authored = normalizedTokens(authoredTaskText(item));
  const seen = new Set<string>();

  for (const support of item.support) {
    const words = normalizedTokens(support.en);
    const phrase = words.join(" ");
    if (!words.length) {
      issues.push("support has no English word to gloss");
      continue;
    }
    if (seen.has(phrase)) {
      issues.push(`support repeats the gloss for "${support.en}"`);
    }
    seen.add(phrase);

    if (!containsTokenSequence(authored, words)) {
      issues.push(`support "${support.en}" is not visible in the task text`);
      continue;
    }

    if (item.type === "choice") {
      const covered = item.options.filter((option) =>
        containsTokenSequence(normalizedTokens(option.text), words),
      ).length;
      if (covered > 0 && covered < item.options.length) {
        issues.push(
          `support "${support.en}" appears in only ${covered}/${item.options.length} choices; it could reveal an option`,
        );
      }
    } else {
      const answers = [item.answer, ...item.accept];
      if (
        answers.some((answer) => {
          const answerWords = normalizedTokens(answer);
          return answerWords.length > 0 && containsTokenSequence(words, answerWords);
        })
      ) {
        issues.push(`support "${support.en}" reveals a correct answer`);
      }
    }
  }

  return issues;
}
