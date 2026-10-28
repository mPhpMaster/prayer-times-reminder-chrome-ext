// Preserve the classic-script fixtures across the two focused test sections.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const realm = vm.createContext({ require, console, process, __dirname, Buffer, URL, URLSearchParams });
for (const file of ["game-foundation-cases.js", "game-integration-cases.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, file), "utf8"), realm, { filename: file });
}
