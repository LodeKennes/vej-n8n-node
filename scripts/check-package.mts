import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = await Bun.file('package.json').json();
assert(!pkg.dependencies, 'The shipped node must have no runtime dependencies.');
for (const file of [...pkg.n8n.nodes, ...pkg.n8n.credentials]) {
	assert(await Bun.file(file).exists(), `Missing compiled entrypoint: ${file}`);
	const exports = require(`../${file}`);
	assert(Object.values(exports).some((value) => typeof value === 'function'));
}
for (const file of [
	'dist/nodes/Vej/vej.svg',
	'dist/nodes/Vej/vej.dark.svg',
	'dist/nodes/Vej/presets.json',
	'dist/nodes/Vej/Vej.node.json',
]) {
	assert(await Bun.file(file).exists(), `Missing runtime asset: ${file}`);
}
const { Vej } = require('../dist/nodes/Vej/Vej.node.js');
assert.equal(new Vej().description.name, 'vej');
process.stdout.write(
	'Package entrypoints, runtime metadata, icons, and dependency boundaries passed.\n',
);
