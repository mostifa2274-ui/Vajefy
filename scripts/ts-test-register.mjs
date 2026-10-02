// `node --import ./scripts/ts-test-register.mjs` — see ts-test-loader.mjs.
import { register } from "node:module";

register("./ts-test-loader.mjs", import.meta.url);
