import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const OUT_DIR = join(projectRoot, "public/wasm");
mkdirSync(OUT_DIR, { recursive: true });

const ascBin = join(projectRoot, "node_modules/.bin/asc");

try {
  execFileSync(
    ascBin,
    [
      "wasm-src/assembly.ts",
      "-o",
      "public/wasm/access-guard.wasm",
      "--optimize",
      "--runtime",
      "stub",
    ],
    { cwd: projectRoot, stdio: "inherit" },
  );
  console.log("✓ WASM compilado em public/wasm/access-guard.wasm");
} catch (err) {
  console.error("Falha ao compilar o módulo WASM de segurança:", err.message);
  process.exit(1);
}
