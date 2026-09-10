import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const FORBIDDEN_PATTERNS = [
  /sb_secret_[a-zA-Z0-9_\-]{8,}/i,
  /service_role/i,
  /SUPABASE_SECRET_KEY/i,
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /AI_PROVIDER_API_KEY/i,
  /APP_SECRET_KEY/i,
  /OPENAI_API_KEY/i,
  /GEMINI_API_KEY/i,
  /ANTHROPIC_API_KEY/i,
  /JWT_SECRET/i,
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/,
  /"type"\s*:\s*"service_account"/,
];

const SCAN_DIRS = ['src', 'public', 'dist'];
const ALLOWED_EXTENSIONS = ['.js', '.ts', '.tsx', '.html', '.css', '.json', '.env', '.env.local'];

let violations = 0;

function scanFile(filePath) {
  const relPath = path.relative(rootDir, filePath);
  // Avoid checking node_modules, git internals, or the audit script itself
  if (relPath.includes('node_modules') || relPath.includes('.git') || relPath.endsWith('audit-secrets.js')) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`❌ SECURITY VIOLATION: Privileged secret or forbidden pattern ${pattern} detected in ${relPath}`);
      violations++;
    }
  }
}

function scanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        scanDirectory(fullPath);
      }
    } else {
      const ext = path.extname(entry.name);
      if (ALLOWED_EXTENSIONS.includes(ext) || entry.name.startsWith('.env')) {
        scanFile(fullPath);
      }
    }
  }
}

console.log('🔒 Starting Security & Secret Audit...');
for (const dir of SCAN_DIRS) {
  scanDirectory(path.join(rootDir, dir));
}

// Also scan .env.local if present
const envLocal = path.join(rootDir, '.env.local');
if (fs.existsSync(envLocal)) {
  const content = fs.readFileSync(envLocal, 'utf-8');
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`❌ SECURITY VIOLATION: Privileged server secret pattern ${pattern} found inside client .env.local!`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n🚨 FAILED: ${violations} security violation(s) detected. Privileged secrets must NEVER be present in client or frontend code.`);
  process.exit(1);
} else {
  console.log('✅ PASSED: No privileged secrets or forbidden patterns detected in client bundles or repositories.');
  process.exit(0);
}
