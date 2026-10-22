const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// The monorepo root is two levels up from this file
const monorepoRoot = path.resolve(__dirname, '../..');

const config = getDefaultConfig(__dirname);

// 1. Watch the monorepo workspace packages that the app imports
config.watchFolders = [
  monorepoRoot,
];

// 2. Make sure Metro resolves modules from the app directory first,
//    then falls back to the monorepo root (for shared lib/* packages)
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Disable symlinks — pnpm uses symlinks in node_modules which can confuse Metro
config.resolver.unstable_enableSymlinks = false;

module.exports = config;
