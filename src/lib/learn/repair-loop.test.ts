import assert from "node:assert/strict";
import test from "node:test";
import {
  diagnoseFinding,
  MAX_AUTOMATIC_REPAIR_ATTEMPTS,
  nextRepairState,
  proposeDeterministicRepair,
  repairCatalog,
} from "./repair-loop";

test("identical Persian mistake regenerates only wrongFa and preserves the correction", () => {
  const diagnosis = diagnoseFinding({
    code: "MISTAKE_FA_IDENTICAL",
    where: "a1.take.01.mistake",
    message: "wrong and corrected Persian translations are identical",
  });
  assert.equal(diagnosis.action, "regenerate_field_only");
  assert.equal(diagnosis.field, "mistake.wrongFa");
  assert.equal(diagnosis.targetId, "a1.take.01");
  assert.equal(diagnosis.status, "FAIL");
  assert.ok(diagnosis.preserve.includes("mistake.rightFa"));
  assert.ok(diagnosis.preserve.includes("stableId"));
  assert.equal(
    nextRepairState({
      action: diagnosis.action,
      attemptsAlreadyUsed: 0,
      verification: "not_run",
    }).status,
    "AWAITING_REGENERATION",
  );
});

test("concrete example path is kept and an unknown code abstains", () => {
  const near = diagnoseFinding({
    code: "EXAMPLE_NEAR_DUPLICATE",
    where: "a1.cat.01.examples[2]",
  });
  assert.equal(near.field, "examples[2]");
  assert.equal(near.action, "regenerate_field_only");

  const unknown = diagnoseFinding({ code: "INVENTED_PASS", where: "a1.cat.01.gloss" });
  assert.equal(unknown.action, "unsupported");
  assert.equal(unknown.status, "UNCERTAIN");
  assert.equal(
    nextRepairState({
      action: unknown.action,
      attemptsAlreadyUsed: 0,
      verification: "not_run",
    }).status,
    "QUARANTINED_AUTOMATICALLY",
  );
});

test("malformed Unicode quarantines immediately and NFC is a pure proposal", () => {
  const broken = diagnoseFinding({
    code: "MALFORMED_UNICODE",
    where: "a1.cat.01.gloss",
  });
  assert.equal(broken.action, "quarantine");
  assert.equal(
    nextRepairState({
      action: broken.action,
      attemptsAlreadyUsed: 0,
      verification: "not_run",
    }).status,
    "QUARANTINED_AUTOMATICALLY",
  );

  assert.equal(proposeDeterministicRepair("cafe\u0301", "UNICODE_NOT_NFC"), "caf\u00e9");
  assert.equal(proposeDeterministicRepair("go \u202ehome", "BIDI_CONTROL"), "go home");
  assert.equal(proposeDeterministicRepair("گربه", "PERSIAN_GLOSS"), null);
});

test("a cleared field is pending revalidation, never a certificate, and retries are bounded", () => {
  const cleared = nextRepairState({
    action: "deterministic_normalize",
    attemptsAlreadyUsed: 0,
    verification: "deterministic_cleared",
  });
  assert.equal(cleared.status, "PENDING_REVERIFICATION");
  assert.match(cleared.reason, /not certification/);

  let attempts = 0;
  let status = "RETRY";
  for (let i = 0; i < MAX_AUTOMATIC_REPAIR_ATTEMPTS; i += 1) {
    const next = nextRepairState({
      action: "regenerate_field_only",
      attemptsAlreadyUsed: attempts,
      verification: "still_failing",
    });
    attempts = next.attempts;
    status = next.status;
  }
  assert.equal(attempts, MAX_AUTOMATIC_REPAIR_ATTEMPTS);
  assert.equal(status, "QUARANTINED_AUTOMATICALLY");
});

test("every catalog action is a known fail-closed action", () => {
  for (const [code, rule] of Object.entries(repairCatalog())) {
    assert.ok(code.length > 0);
    assert.ok(rule.preserve.includes("stableId"));
    assert.notEqual(rule.action, "unsupported");
  }
});
