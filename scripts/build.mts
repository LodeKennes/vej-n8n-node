import { rm } from 'node:fs/promises';

// Bun owns the build. The official n8n compiler emits portable CommonJS for n8n.
const build = Bun.spawn(
	['bun', '--bun', 'run', 'node_modules/@n8n/node-cli/bin/n8n-node.mjs', 'build'],
	{ stdout: 'inherit', stderr: 'inherit' },
);
if (await build.exited) process.exit(build.exitCode ?? 1);
// n8n-node copies SVGs; its current build omits the node's discovery metadata.
await Bun.write('dist/nodes/Vej/Vej.node.json', Bun.file('nodes/Vej/Vej.node.json'));
// Marketing assets ship once at the package root, outside the runtime tree.
await rm('dist/assets', { recursive: true, force: true });
