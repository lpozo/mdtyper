import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isProd  = process.argv.includes('--production');

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
  outfile: 'out/extension.js',
  format: 'cjs',
  platform: 'node',
  // vscode is a virtual module provided by the VS Code runtime — never bundle it
  external: ['vscode'],
};

// Target 2: Webview (browser, IIFE)
const webviewBuild = {
  ...sharedOptions,
  entryPoints: ['webview-src/main.ts'],
  outfile: 'out/webview.js',
  format: 'iife',
  platform: 'browser',
};

if (isWatch) {
  const extCtx = await esbuild.context(extensionBuild);
  const webCtx = await esbuild.context(webviewBuild);
  await Promise.all([extCtx.watch(), webCtx.watch()]);
  console.log('Watching for changes...');
} else {
  await Promise.all([
    esbuild.build(extensionBuild),
    esbuild.build(webviewBuild),
  ]);
}
