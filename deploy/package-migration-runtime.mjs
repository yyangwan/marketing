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
  let packageDir;
  try {
    packageDir = dirname(require.resolve(`${name}/package.json`));
  } catch (error) {
    if (!['ERR_PACKAGE_PATH_NOT_EXPORTED', 'MODULE_NOT_FOUND'].includes(error.code)) throw error;
    for (const folder of require.resolve.paths(name) || []) {
      const candidate = join(folder, name);
      try {
        await readFile(join(candidate, 'package.json'));
        packageDir = candidate;
        break;
      } catch (missing) { if (missing.code !== 'ENOENT') throw missing; }
    }
    if (!packageDir) throw error;
  }
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
await cp(join(root, 'prisma.config.ts'), join(destination, 'prisma.config.ts'));
await mkdir(join(destination, 'prisma'), { recursive: true });
await cp(join(root, 'prisma/schema.prisma'), join(destination, 'prisma/schema.prisma'));
await cp(join(root, 'prisma/migrations'), join(destination, 'prisma/migrations'), { recursive: true });
await copyPackage('prisma', root);
await copyPackage('dotenv', root);
console.log('postgresql_migration_runtime_packaged');
