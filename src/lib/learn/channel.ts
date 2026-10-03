/**
 * Which enhanced content may be introduced to learners, chosen at build time
 * with VITE_CONTENT_CHANNEL:
 *
 * - "draft" (default): every entry with content, unreviewed ones labelled as
 *   drafts. For the pilot study and for reviewers.
 * - "released": only entries whose bilingual and pronunciation reviews are
 *   approved for their current content. For a public release, so A1 grows
 *   exactly as fast as editorial review allows.
 * - "none": no guided lessons; new words are introduced in Review, as before
 *   the enhanced content. The pilot study's comparison arm.
 *
 * Cards a learner already has keep their content in every channel.
 */
export type Channel = "draft" | "released" | "none";

const configured = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_CONTENT_CHANNEL;

export const CONTENT_CHANNEL: Channel = configured === "released" || configured === "none" ? configured : "draft";

/** Whether a learning target may be introduced in this channel. */
export function introducibleIn(channel: Channel, released: boolean): boolean {
  return channel === "draft" || (channel === "released" && released);
}
