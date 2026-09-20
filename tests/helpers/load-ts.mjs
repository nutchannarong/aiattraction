import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
export function loadTs(path, mocks = {}) {
  const mod = { exports: {} };
  const js = ts.transpileModule(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const resolver = name => name === "server-only" ? {} : Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  new Function("require", "module", "exports", js)(resolver, mod, mod.exports);
  return mod.exports;
}
