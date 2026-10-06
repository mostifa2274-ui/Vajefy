import fs from "node:fs";
import path from "node:path";
import type { SemanticJudgeRole } from "../src/lib/learn/assurance";
import { semanticEndpointConfig } from "./semantic-endpoint-config";

const ROOT = process.cwd();

type Packet = {
  schemaVersion: 1;
  unitId: string;
  roles: { role: SemanticJudgeRole; promptVersion: string; rubricVersion: string }[];
  targets: { targetId: string }[];
};

function option(flag: string): string | undefined {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const unitId = option("--unit") ?? "01-introductions";
const packetPath =
  option("--packet") ??
  path.join(
    ROOT,
    "content",
    "assurance",
    "semantic",
    "packets",
    `${unitId}.json`,
  );

const packet = JSON.parse(fs.readFileSync(path.resolve(packetPath), "utf8")) as Packet;
if (packet.schemaVersion !== 1 || packet.unitId !== unitId) {
  fail(`Semantic packet does not match requested unit ${unitId}.`);
}

const roles = packet.roles.map((role) => ({
  ...semanticEndpointConfig(role.role),
  promptVersion: role.promptVersion,
  rubricVersion: role.rubricVersion,
}));

const report = {
  unitId,
  packet: path.relative(ROOT, path.resolve(packetPath)).replaceAll("\\", "/"),
  targets: packet.targets.length,
  readyRoles: roles.filter((role) => role.ready).length,
  roles,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `Semantic judge preflight [${unitId}]: ${report.readyRoles}/${roles.length} role endpoint(s) configured; ${report.targets} target(s).`,
  );
  for (const role of roles) {
    const endpoint = role.baseUrl ?? "MISSING";
    const model = role.model ?? "MISSING";
    const version = role.modelVersion ?? "MISSING";
    console.log(
      `- ${role.role}: ${role.ready ? "READY" : "BLOCKED"}; provider=${role.provider}; base=${endpoint}; model=${model}; version=${version}; apiKey=${role.apiKeyPresent ? "present" : "absent"}; jsonResponseFormat=${role.jsonResponseFormat ? "on" : "off"}${role.missing.length ? `; missing=${role.missing.join(",")}` : ""}`,
    );
  }
}

if (process.argv.includes("--require-ready") && roles.some((role) => !role.ready)) {
  fail(
    `Semantic judge endpoints are not fully configured: ${roles
      .filter((role) => !role.ready)
      .map((role) => `${role.role}[${role.missing.join(",")}]`)
      .join("; ")}`,
  );
}
