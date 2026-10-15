import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(appRoot, file), "utf8");
const files = [
  "manifest.xml",
  "monkey.jungle",
  "resources/strings/strings.xml",
  "resources/settings/properties.xml",
  "resources/settings/settings.xml",
  "resources/drawables/drawables.xml",
  "resources/drawables/launcher.svg",
  "source/KernApp.mc",
  "source/KernDelegate.mc",
  "source/KernApi.mc",
  "source/KernView.mc",
];

for (const file of files) assert.ok(read(file).trim(), `${file} must not be empty`);

const manifest = read("manifest.xml");
assert.match(manifest, /type="watch-app"/);
assert.match(manifest, /id="Communications"/);
assert.match(manifest, /id="fenix7"/);
assert.match(manifest, /entry="KernApp"/);

const source = ["KernApp.mc", "KernDelegate.mc", "KernApi.mc", "KernView.mc"]
  .map((file) => read(`source/${file}`))
  .join("\n");
for (const route of ["/garmin/pair", "/garmin/pet", "/garmin/actions"]) {
  assert.ok(source.includes(route), `watch source must use ${route}`);
}
assert.doesNotMatch(source, /\/auth\/(?:login|register)/);
assert.doesNotMatch(source, /password/i);
assert.match(source, /Application\.Storage\.setValue\("garminToken"/);
assert.match(source, /Application\.Storage\.deleteValue\("garminToken"/);
assert.match(source, /Authorization/);

for (const file of files.filter((file) => file.endsWith(".xml") || file.endsWith(".svg"))) {
  const value = read(file);
  assert.equal((value.match(/</g) || []).length, (value.match(/>/g) || []).length, `${file} has malformed markup`);
}

console.log(`Validated ${files.length} Garmin project files and the watch-only API contract.`);
