import * as esbuild from 'esbuild';
import { copyFile } from 'node:fs/promises';

const isWatch = process.argv.includes('--watch');
const isProd = process.argv.includes('--production');

const sharedOptions = {
  bundle: true,
  minify: isProd,
  sourcemap: !isProd,
  logLevel: 'info',
};

// Target 1: Extension host (Node.js, CJS)
const extensionBuild = {
  ...sharedOptions,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  // vscode is a virtual module provided by the VS Code runtime — never bundle it
  external: ['vscode'],
};

// Target 2: Webview (browser, IIFE)
const webviewBuild = {
  ...sharedOptions,
  entryPoints: ['webview-src/main.ts'],
  outfile: 'dist/webview.js',
  format: 'iife',
  platform: 'browser',
};

async function copyAssets() {
  // theme.css is a runtime asset loaded by the webview; copy it into dist/
  // so it is included in the .vsix package alongside the JS bundles.
  await copyFile('webview-src/theme.css', 'dist/theme.css');
}

if (isWatch) {
  const extCtx = await esbuild.context(extensionBuild);
  const webCtx = await esbuild.context(webviewBuild);
  await copyAssets();
  await Promise.all([extCtx.watch(), webCtx.watch()]);
  console.log('Watching for changes... (edit theme.css → reload window manually)');
} else {
  await Promise.all([
    esbuild.build(extensionBuild),
    esbuild.build(webviewBuild),
  ]);
  await copyAssets();
}
