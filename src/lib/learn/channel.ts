/**
 * Which enhanced content may be introduced to learners, chosen at build time
 * with VITE_CONTENT_CHANNEL:
 *
 * - "draft" (default): every entry with content, unreviewed ones labelled as
 *   drafts. For the pilot study and for reviewers.
 * - "released": only entries whose bilingual and pronunciation reviews are
 *   approved for their current content. For a public release, so A1 grows
 *   exactly as fast as editorial review allows.
 *
 * Cards a learner already has keep their content in either channel.
 */
export type Channel = "draft" | "released";

const configured = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_CONTENT_CHANNEL;

export const CONTENT_CHANNEL: Channel = configured === "released" ? "released" : "draft";
