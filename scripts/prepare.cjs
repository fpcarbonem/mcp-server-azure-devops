'use strict';

/**
 * Runs husky only in a git checkout with devDependencies installed.
 * Skips when this package is installed from npm (no .git / no husky), so consumers are not broken.
 */

const { existsSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const root = join(__dirname, '..');

if (!existsSync(join(root, '.git'))) {
  process.exit(0);
}

try {
  require.resolve('husky/package.json', { paths: [root] });
} catch {
  process.exit(0);
}

const bin = join(root, 'node_modules', '.bin');
const pathSep = process.platform === 'win32' ? ';' : ':';
const pathWithBin = `${bin}${pathSep}${process.env.PATH || ''}`;

try {
  execSync('husky install', {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, PATH: pathWithBin },
  });
} catch {
  process.exit(0);
}
