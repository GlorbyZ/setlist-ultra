const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;

function findMonorepoRoot(startDir) {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.name === 'setlist-ultra') {
          return dir;
        }
      } catch {
        // keep walking
      }
    }
    dir = path.dirname(dir);
  }
  return path.resolve(startDir, '../..');
}

const monorepoRoot = findMonorepoRoot(projectRoot);

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  '@setlist-ultra/core': path.resolve(monorepoRoot, 'packages/core'),
  '@setlist-ultra/db': path.resolve(monorepoRoot, 'packages/db'),
};

module.exports = config;
