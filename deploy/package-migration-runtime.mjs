import { cp, mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Copy the already installed dependency closure; never install on production.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = resolve(process.argv[2] || join(root, '.next/standalone'));
const copied = new Set();
async function copyPackage(name, from) {
  const require = createRequire(join(from, 'package.json'));
  let packageDir = dirname(require.resolve(name));
  while (true) {
    try {
      const manifest = JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8'));
      if (manifest.name === name) {
        if (copied.has(name)) return;
        copied.add(name);
        await cp(packageDir, join(destination, 'node_modules', name), { recursive: true, dereference: true });
        for (const dependency of Object.keys(manifest.dependencies || {})) {
          if (!dependency.startsWith('@types/')) await copyPackage(dependency, packageDir);
        }
        return;
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = dirname(packageDir);
    if (parent === packageDir) throw new Error('migration_dependency_missing');
    packageDir = parent;
  }
}
await mkdir(join(destination, 'deploy'), { recursive: true });
await cp(join(root, 'deploy/migrate-manual-evidence.mjs'), join(destination, 'deploy/migrate-manual-evidence.mjs'));
await cp(join(root, 'prisma/manual-evidence-tasks.sql'), join(destination, 'deploy/manual-evidence-tasks.sql'));
await copyPackage('mariadb', root);
console.log('manual_evidence_runtime_packaged');
