import { rm } from 'node:fs/promises';
import { copyStaticFiles } from '../node_modules/@n8n/node-cli/dist/commands/build.js';

// Use the same TypeScript compilation and asset copier as n8n-node build.
// An explicit compiler path avoids the scanner's competing TypeScript 6 alias.
await rm('dist', { recursive: true, force: true });
const build = Bun.spawn(['bun', 'node_modules/typescript/bin/tsc'], {
	stdout: 'inherit',
	stderr: 'inherit',
});
if (await build.exited) process.exit(build.exitCode ?? 1);
await copyStaticFiles();
// n8n-node copies SVGs; its current build omits the node's discovery metadata.
await Bun.write('dist/nodes/Vej/Vej.node.json', Bun.file('nodes/Vej/Vej.node.json'));
// Marketing assets ship once at the package root, outside the runtime tree.
await rm('dist/assets', { recursive: true, force: true });
