import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const SECRET_PATTERNS = [
  ["Supabase service-role credential marker", /(?:SUPABASE_SERVICE_ROLE_KEY|sb_secret_[A-Za-z0-9_-]{20,})/],
  ["private key block", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub access token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ["Stripe secret key", /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/]
];

function hasServiceRoleJwt(text) {
  const tokens = text.match(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g) || [];
  return tokens.some((token) => {
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
      return payload.role === "service_role";
    } catch {
      return false;
    }
  });
}

export function inspectPublicText(text, filePath = "<memory>") {
  const findings = SECRET_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => ({ filePath, label }));
  if (hasServiceRoleJwt(text)) findings.push({ filePath, label: "Supabase service-role JWT" });
  return findings;
}

export async function assertPublicBundleSafe(directory) {
  const findings = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const fullPath = join(path, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile() && /\.(?:html|js|css|json|map)$/i.test(entry.name)) {
        const text = await readFile(fullPath, "utf8");
        findings.push(...inspectPublicText(text, fullPath));
      }
    }
  }
  await visit(directory);
  if (findings.length) {
    const summary = findings.map(({ filePath, label }) => `- ${filePath}: ${label}`).join("\n");
    throw new Error(`Public bundle rejected: potential privileged credential exposure.\n${summary}`);
  }
  return { safe: true, filesScanned: true };
}
