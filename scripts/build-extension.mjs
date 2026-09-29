// Builds dist/fist-pms.mcpb: the Claude Desktop extension.
// Copies only the files the MCP server needs, installs its production
// dependencies, then packs with the mcpb CLI.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const stage = path.join(root, 'dist', 'extension');
const out = path.join(root, 'dist', 'fist-pms.mcpb');
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8'));

const FILES = [
  'mcp/server.js',
  'mcp/tools.js',
  'mcp/format.js',
  'server/config.js',
  'server/match.js',
  'server/parse.js',
  'server/pms-client.js',
  'server/service.js',
  'server/session.js',
  'server/text-to-html.js',
];
const DEPS = ['@modelcontextprotocol/sdk', 'node-html-parser', 'playwright-core', 'zod'];

const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });

fs.rmSync(stage, { recursive: true, force: true });
fs.rmSync(out, { force: true });
for (const file of FILES) {
  fs.mkdirSync(path.dirname(path.join(stage, file)), { recursive: true });
  fs.copyFileSync(path.join(root, file), path.join(stage, file));
}
fs.copyFileSync(path.join(root, 'extension', 'manifest.json'), path.join(stage, 'manifest.json'));

const dependencies = Object.fromEntries(
  DEPS.map((name) => {
    const version = rootPkg.dependencies?.[name];
    if (!version) throw new Error(`${name} is missing from package.json dependencies`);
    return [name, version];
  }),
);
fs.writeFileSync(
  path.join(stage, 'package.json'),
  JSON.stringify({ name: manifest.name, version: manifest.version, private: true, type: 'module', dependencies }, null, 2),
);

run('npm install --omit=dev --no-audit --no-fund', stage);
run(`npx mcpb validate "${path.join(stage, 'manifest.json')}"`);
run(`npx mcpb pack "${stage}" "${out}"`);
console.log(`\nBuilt ${path.relative(root, out)}`);
