const fs = require("node:fs");
const path = require("node:path");

function pageScripts(root, page) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  return [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
    .map(match => match[1].split("?")[0]);
}

function pageSource(root, page, prefix) {
  return pageScripts(root, page).filter(file => !prefix || file.startsWith(prefix))
    .map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
}

module.exports = { pageScripts, pageSource };
