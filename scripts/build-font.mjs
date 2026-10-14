import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import SVGFixer from "oslllo-svg-fixer";
import svgtofont from "svgtofont";

// usage: node scripts/build-font.mjs <svg dir> <output dir> <font name> <names json>
// <names json> is a JSON array with the icon names this font covers (one font part of a provider)
const [svgArg, outputArg, fontName, namesArg] = process.argv.slice(2);
if (!svgArg || !outputArg || !fontName || !namesArg) throw new Error("Usage: build-font.mjs <svg dir> <output dir> <font name> <names json>");
const svgDir = path.resolve(svgArg);
const iconsDir = path.resolve(`build/outputs/${fontName}/part-svgs`);
const outputDir = path.resolve(outputArg);
const outlinedDir = path.resolve(`build/outputs/${fontName}/font-outlines`);
const fontDir = path.resolve(`build/outputs/${fontName}/font`);
const names = JSON.parse(await readFile(path.resolve(namesArg), "utf8")).sort();
if (!names.length) throw new Error("No icons given for font generation");
await rm(iconsDir, { recursive: true, force: true });
await mkdir(iconsDir, { recursive: true });
for (const name of names) await copyFile(path.join(svgDir, `${name}.svg`), path.join(iconsDir, `${name}.svg`));
let previous = { icons: {}, nextCodepoint: 0xE000 };
try {
  previous = JSON.parse(await readFile(path.join(outputDir, `${fontName}.codepoints.json`), "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
let nextCodepoint = previous.nextCodepoint;
const icons = Object.fromEntries(names.map((name) => [name, previous.icons[name] ?? nextCodepoint++]));
if (nextCodepoint > 0xF900) throw new Error("Too many icons for the private-use Unicode range");

await rm(outlinedDir, { recursive: true, force: true });
await mkdir(outlinedDir, { recursive: true });
await SVGFixer(iconsDir, outlinedDir, { traceResolution: 800 }).fix();

// svgtofont scales every glyph by the largest svg in the font, so a set with several sizes (16px next to 48px)
// would draw its small icons tiny. Give every outlined svg the same size so each icon fills the em square
for (const file of await readdir(outlinedDir)) {
  const filePath = path.join(outlinedDir, file);
  const svg = await readFile(filePath, "utf8");
  await writeFile(filePath, svg.replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(width|height)="[^"]*"/g, "").replace("<svg", '<svg width="1000" height="1000"')));
}
await svgtofont({
  src: outlinedDir,
  dist: fontDir,
  fontName,
  css: false,
  addLigatures: true,
  emptyDist: true,
  svgicons2svgfont: { fontHeight: 1000, normalize: false },
  getIconUnicode: (name) => {
    if (!(name in icons)) throw new Error(`Unexpected outlined icon: ${name}`);
    return [String.fromCodePoint(icons[name]), 0xE000];
  },
});

const ttfPath = path.join(fontDir, `${fontName}.ttf`);
const font = await readFile(ttfPath);
if (font.readUInt32BE(0) !== 0x00010000) throw new Error("Invalid TrueType font output");
const tables = new Map(Array.from({ length: font.readUInt16BE(4) }, (_, index) => {
  const record = 12 + index * 16;
  return [font.toString("ascii", record, record + 4), record];
}));
if (font.readUInt32BE(tables.get("GSUB") + 12) >= 65536) throw new Error("Ligature table exceeds its 16-bit offset limit");
const os2 = tables.get("OS/2");
const os2Offset = font.readUInt32BE(os2 + 8);
const headOffset = font.readUInt32BE(tables.get("head") + 8);
font.writeUInt32BE(1, os2Offset + 42);
font.writeUInt32BE(0x10000000, os2Offset + 46);
font.writeUInt32BE(0, headOffset + 8);
function checksum(offset, length) {
  let sum = 0;
  for (let position = offset; position < offset + length; position += 4) sum = (sum + font.readUInt32BE(position)) >>> 0;
  return sum;
}
font.writeUInt32BE(checksum(os2Offset, font.readUInt32BE(os2 + 12)), os2 + 4);
font.writeUInt32BE((0xB1B0AFBA - checksum(0, font.length)) >>> 0, headOffset + 8);
const version = createHash("sha256").update(font).digest("hex");
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, `${fontName}.ttf`), font);
await writeFile(path.join(outputDir, `${fontName}.codepoints.json`), JSON.stringify({ version, nextCodepoint, icons }, null, 2) + "\n");
console.log(`Generated ${fontName}.ttf with ${names.length} icons`);
