import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

const [maior, menor] = JSON.parse(readFileSync("package.json", "utf8")).version.split(".").map(Number);
const prefixo = `v${maior}.${menor}.`;
const publicadas = execFileSync("git", ["tag", "--list", `${prefixo}*`], { encoding: "utf8" })
  .split("\n")
  .map((tag) => Number(tag.trim().slice(prefixo.length)))
  .filter((n) => Number.isInteger(n) && n >= 0);
const versao = `${maior}.${menor}.${Math.max(0, ...publicadas) + 1}`;

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `versao=${versao}\n`);
console.log(versao);
