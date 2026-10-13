import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(appRoot, "design");
const outputFile = path.join(outputDirectory, "kern-reef-companion-desktop.svg");

const pngDataUrl = async (filename) => {
  const image = await readFile(path.join(appRoot, "assets", filename));
  return `data:image/png;base64,${image.toString("base64")}`;
};

const [reef, character] = await Promise.all([
  pngDataUrl("reef-habitat.png"),
  pngDataUrl("kern-hd.png"),
]);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1024" viewBox="0 0 1440 1024">
  <title>Kern Reef Companion — Desktop</title>
  <desc>Figma-ready desktop design with editable interface layers and embedded production artwork.</desc>
  <defs>
    <radialGradient id="pageGlow" cx="0" cy="0" r="1" gradientTransform="translate(245 95) rotate(47) scale(900 720)" gradientUnits="userSpaceOnUse">
      <stop stop-color="#105064" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#031621" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="sceneShade" x1="500" y1="305" x2="500" y2="770" gradientUnits="userSpaceOnUse">
      <stop stop-color="#032331" stop-opacity="0.02"/>
      <stop offset="1" stop-color="#021722" stop-opacity="0.22"/>
    </linearGradient>
    <linearGradient id="buttonFill" x1="210" y1="0" x2="790" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7BE7DE"/>
      <stop offset="1" stop-color="#50C6C6"/>
    </linearGradient>
    <linearGradient id="coralMeter" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#FF7D70"/>
      <stop offset="1" stop-color="#FFB47F"/>
    </linearGradient>
    <linearGradient id="aquaMeter" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#48C5C6"/>
      <stop offset="1" stop-color="#93EBDD"/>
    </linearGradient>
    <filter id="cardShadow" x="20" y="45" width="1400" height="960" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="32" stdDeviation="36" flood-color="#000912" flood-opacity="0.42"/>
    </filter>
    <filter id="characterShadow" x="170" y="300" width="700" height="500" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="24" stdDeviation="17" flood-color="#00121D" flood-opacity="0.48"/>
    </filter>
    <filter id="buttonShadow" x="170" y="780" width="660" height="130" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#32B1AE" flood-opacity="0.24"/>
    </filter>
    <clipPath id="sceneClip">
      <rect x="118" y="310" width="762" height="476" rx="26"/>
    </clipPath>
  </defs>

  <!-- Page / Background -->
  <rect width="1440" height="1024" fill="#031621"/>
  <rect width="1440" height="1024" fill="url(#pageGlow)"/>

  <!-- Header -->
  <g id="Header">
    <rect x="72" y="34" width="48" height="48" rx="15" fill="#0C3947" stroke="#58D4D0" stroke-opacity="0.35"/>
    <text x="96" y="67" text-anchor="middle" fill="#7BE7DE" font-family="Georgia, serif" font-size="27">K</text>
    <text x="135" y="55" fill="#F2FAFA" font-family="Inter, Arial, sans-serif" font-size="16" font-weight="700">Kern</text>
    <text x="135" y="75" fill="#7597A3" font-family="Inter, Arial, sans-serif" font-size="11">Reef companion</text>
    <rect x="1270" y="42" width="98" height="34" rx="17" fill="#072431" stroke="#7BE7DE" stroke-opacity="0.16"/>
    <circle cx="1288" cy="59" r="4" fill="#73E9DF"/>
    <text x="1302" y="63" fill="#A9C1C8" font-family="Inter, Arial, sans-serif" font-size="11">Local only</text>
  </g>

  <!-- Main card -->
  <g id="Desktop / Companion card" filter="url(#cardShadow)">
    <rect x="72" y="104" width="1296" height="842" rx="30" fill="#061F2D" stroke="#8AD9D8" stroke-opacity="0.14"/>
    <rect x="934" y="104" width="434" height="842" rx="0" fill="#051A27"/>
    <path d="M934 104V946" stroke="#8AD9D8" stroke-opacity="0.13"/>

    <!-- Left / Hero copy -->
    <g id="Hero copy">
      <text x="118" y="166" fill="#70E0DA" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="2.2">MILESTONE 03 · A PLACE TO BELONG</text>
      <text x="118" y="221" fill="#F1F8F8" font-family="Georgia, serif" font-size="45">Kern is <tspan fill="#9DEAE3" font-style="italic">curious about you.</tspan></text>
      <text x="118" y="257" fill="#89A5AE" font-family="Inter, Arial, sans-serif" font-size="14">A small snack is a good way to introduce yourself.</text>
    </g>

    <!-- Habitat / Embedded production art -->
    <g id="Habitat" clip-path="url(#sceneClip)">
      <image id="Reef habitat" x="118" y="310" width="762" height="476" preserveAspectRatio="xMidYMid slice" href="${reef}"/>
      <rect x="118" y="310" width="762" height="476" fill="url(#sceneShade)"/>
      <image id="Kern character" x="205" y="356" width="590" height="393" preserveAspectRatio="xMidYMid meet" href="${character}" filter="url(#characterShadow)"/>
      <circle cx="275" cy="460" r="6" fill="none" stroke="#DBFFF7" stroke-opacity="0.42"/>
      <circle cx="747" cy="420" r="4" fill="none" stroke="#DBFFF7" stroke-opacity="0.35"/>
      <circle cx="692" cy="620" r="3" fill="none" stroke="#DBFFF7" stroke-opacity="0.32"/>
    </g>
    <rect x="118" y="310" width="762" height="476" rx="26" fill="none" stroke="#BBF7EF" stroke-opacity="0.22"/>

    <!-- Primary action -->
    <g id="Button / Share a snack" filter="url(#buttonShadow)">
      <rect x="210" y="816" width="578" height="78" rx="20" fill="url(#buttonFill)"/>
      <circle cx="248" cy="855" r="22" fill="#E7FFFB" fill-opacity="0.54"/>
      <path d="M248 844L251 852L259 855L251 858L248 866L245 858L237 855L245 852L248 844Z" fill="#062633"/>
      <text x="283" y="850" fill="#05232C" font-family="Inter, Arial, sans-serif" font-size="15" font-weight="750">Share a snack</text>
      <text x="283" y="871" fill="#174C54" font-family="Inter, Arial, sans-serif" font-size="10.5">Build trust and refill Kern’s belly</text>
    </g>

    <!-- Right / Care panel -->
    <g id="Care panel">
      <text x="976" y="166" fill="#70E0DA" font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="2.2">TODAY</text>
      <text x="976" y="211" fill="#F1F8F8" font-family="Georgia, serif" font-size="32">Care log</text>
      <text x="1328" y="166" text-anchor="end" fill="#78949E" font-family="Inter, Arial, sans-serif" font-size="10">Reset</text>

      <g id="Stat / Fullness">
        <text x="976" y="278" fill="#AFC2C8" font-family="Inter, Arial, sans-serif" font-size="11">Fullness</text>
        <text x="1328" y="278" text-anchor="end" fill="#EEF8F8" font-family="Inter, Arial, sans-serif" font-size="11">62%</text>
        <rect x="976" y="292" width="352" height="7" rx="3.5" fill="#173441"/>
        <rect x="976" y="292" width="218" height="7" rx="3.5" fill="url(#coralMeter)"/>
      </g>

      <g id="Stat / Happiness">
        <text x="976" y="352" fill="#AFC2C8" font-family="Inter, Arial, sans-serif" font-size="11">Happiness</text>
        <text x="1328" y="352" text-anchor="end" fill="#EEF8F8" font-family="Inter, Arial, sans-serif" font-size="11">74%</text>
        <rect x="976" y="366" width="352" height="7" rx="3.5" fill="#173441"/>
        <rect x="976" y="366" width="260" height="7" rx="3.5" fill="url(#aquaMeter)"/>
      </g>

      <g id="Bond level">
        <rect x="976" y="410" width="352" height="76" rx="17" fill="#0B2B38" stroke="#84D9D7" stroke-opacity="0.14"/>
        <rect x="994" y="428" width="40" height="40" rx="12" fill="#10404D"/>
        <text x="1014" y="455" text-anchor="middle" fill="#64DDD7" font-family="Inter, Arial, sans-serif" font-size="22">∞</text>
        <text x="1050" y="441" fill="#78949E" font-family="Inter, Arial, sans-serif" font-size="8.5" font-weight="700" letter-spacing="1.3">BOND LEVEL</text>
        <text x="1050" y="461" fill="#EFF8F8" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700">New friends</text>
        <text x="1308" y="452" text-anchor="end" fill="#78949E" font-family="Inter, Arial, sans-serif" font-size="9.5">0 check-ins</text>
      </g>

      <g id="Recent moments">
        <text x="976" y="552" fill="#AFC2C8" font-family="Inter, Arial, sans-serif" font-size="9.5" font-weight="700" letter-spacing="1.6">RECENT MOMENTS</text>
        <circle cx="981" cy="608" r="3.5" fill="#FF806F"/>
        <text x="998" y="604" fill="#B9CCD1" font-family="Inter, Arial, sans-serif" font-size="10.5">Your first shared moment with Kern</text>
        <text x="998" y="622" fill="#B9CCD1" font-family="Inter, Arial, sans-serif" font-size="10.5">will appear here.</text>
      </g>

      <text x="976" y="902" fill="#56737E" font-family="Inter, Arial, sans-serif" font-size="8.5">Progress stays in this browser until you connect a sync profile.</text>
    </g>
  </g>

  <text x="72" y="988" fill="#456672" font-family="Inter, Arial, sans-serif" font-size="9" letter-spacing="1.2">KERN REEF COMPANION · DESKTOP · 1440 × 1024</text>
</svg>`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputFile, svg);
console.log(`Exported Figma-ready design to ${outputFile}`);
