import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { operations, presetFor } from '../nodes/Vej/operations';

// This is a local transport/integration fixture, not an inference or quality test.
const packaged = Bun.argv.includes('--package');
const directory = resolve(packaged ? 'artifacts/n8n-smoke-package' : 'artifacts/n8n-smoke');
await mkdir(directory, { recursive: true, mode: 0o777 });
if (packaged) {
	const destination = `${directory}/data/.n8n/nodes`;
	await mkdir(destination, { recursive: true });
	await Bun.write(`${destination}/package.json`, '{"private":true}\n');
	const install = Bun.spawn(
		['bun', 'add', '--ignore-scripts', resolve('artifacts/n8n-nodes-vej-0.1.0.tgz')],
		{ cwd: destination, stdout: 'pipe', stderr: 'pipe' },
	);
	const [stdout, stderr, code] = await Promise.all([
		new Response(install.stdout).text(),
		new Response(install.stderr).text(),
		install.exited,
	]);
	await Bun.write(`${directory}/install.log`, stdout + stderr);
	if (code !== 0)
		throw new Error(
			'Package installation failed; inspect artifacts/n8n-smoke-package/install.log.',
		);
}
const id = '6d699805-8bd0-44f6-85aa-e60aa9e04744';
const received: { method: string; path: string; body?: unknown }[] = [];
const server = Bun.serve({
	hostname: '127.0.0.1',
	port: 0,
	async fetch(request) {
		const url = new URL(request.url);
		if (request.headers.get('authorization') !== 'Bearer vej_sk_local_fixture')
			return Response.json({ detail: 'Fixture authentication failed' }, { status: 401 });
		const text = await request.text();
		const body = text ? JSON.parse(text) : undefined;
		received.push({ method: request.method, path: url.pathname + url.search, body });
		if (request.method === 'DELETE') return new Response(null, { status: 204 });
		return Response.json({
			model: 'pea',
			id,
			seq: 2,
			answers: { result: { type: 'noul', noul: 0.7, probabilities: { true: 0.7, false: 0.3 } } },
			metadata: { fixture_only: true },
			usage: { processed_tokens: 0 },
			fixture: { method: request.method, path: url.pathname },
		});
	},
});

const trigger = {
	id: 'manual',
	name: 'Run fixture',
	type: 'n8n-nodes-base.manualTrigger',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};
const nodes = operations.map((operation, index) => ({
	id: `vej-${index}`,
	name: `${operation.resource}-${operation.value}`,
	type: packaged ? 'n8n-nodes-vej.vej' : 'CUSTOM.vej',
	typeVersion: 1,
	position: [300, index * 150],
	credentials: { vejApi: { id: 'vej-local-fixture', name: 'Vej local fixture' } },
	parameters: {
		resource: operation.resource,
		operation: operation.value,
		...(operation.preset ? { input: JSON.stringify(presetFor(operation)) } : {}),
		state: 'Local fixture only.',
		stateFormat: 'text',
		question: 'Is this a fixture?',
		questionId: 'result',
		choices: '{"yes":"A fixture","no":"A live request"}',
		levels: '["Low","High"]',
		recordId: id,
		expectedSeq: 2,
		timeout: 60000,
	},
}));
const workflow = {
	id: 'vej-smoke-all-actions',
	name: 'Vej all-action local fixture',
	active: false,
	nodes: [trigger, ...nodes],
	connections: {
		'Run fixture': { main: [nodes.map((node) => ({ node: node.name, type: 'main', index: 0 }))] },
	},
	settings: { executionOrder: 'v1' },
};
await Bun.write(`${directory}/workflow.json`, JSON.stringify(workflow));
await Bun.write(
	`${directory}/credentials.json`,
	JSON.stringify([
		{
			id: 'vej-local-fixture',
			name: 'Vej local fixture',
			type: 'vejApi',
			data: { baseUrl: `http://127.0.0.1:${server.port}`, apiKey: 'vej_sk_local_fixture' },
		},
	]),
);

const base = [
	'docker',
	'run',
	'--rm',
	'--network',
	'host',
	...(!packaged
		? [
				'--mount',
				`type=bind,src=${resolve('dist')},dst=/opt/vej,readonly`,
				'-e',
				'N8N_CUSTOM_EXTENSIONS=/opt/vej',
			]
		: []),
	'--mount',
	`type=bind,src=${directory},dst=/fixture`,
	'-e',
	'N8N_USER_FOLDER=/fixture/data',
	'-e',
	'N8N_DIAGNOSTICS_ENABLED=false',
	'-e',
	'N8N_VERSION_NOTIFICATIONS_ENABLED=false',
	'-e',
	'N8N_RUNNERS_BROKER_PORT=5789',
	'-e',
	'N8N_BLOCK_ENV_ACCESS_IN_NODE=true',
	'docker.n8n.io/n8nio/n8n:2.43.8',
];
async function command(args: string[], file: string) {
	const child = Bun.spawn([...base, ...args], { stdout: 'pipe', stderr: 'pipe' });
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);
	await Bun.write(`${directory}/${file}.log`, stdout + stderr);
	if (code !== 0) throw new Error(`${args[0]} failed (${code}); inspect ${directory}/${file}.log`);
	return stdout;
}
try {
	await command(['import:credentials', '--input=/fixture/credentials.json'], 'import-credentials');
	await command(['import:workflow', '--input=/fixture/workflow.json'], 'import-workflow');
	const output = await command(['execute', '--id=vej-smoke-all-actions', '--rawOutput'], 'execute');
	if (received.length !== operations.length)
		throw new Error(`Expected ${operations.length} requests; received ${received.length}.`);
	for (const operation of operations) {
		const path = operation.path.replace('{id}', id).replace('{api}', 'states');
		if (
			!received.some(
				(request) =>
					request.method === operation.method &&
					request.path.split('?')[0] === path &&
					(!operation.mode || (request.body as { mode?: string })?.mode === operation.mode),
			)
		)
			throw new Error(`Missing actual HTTP request for ${operation.resource}/${operation.value}.`);
	}
	if (!output.includes('"fixture_only": true'))
		throw new Error('Expected fixture metadata in n8n execution output.');
	await Bun.write(`${directory}/requests.json`, JSON.stringify(received, null, 2));
	process.stdout.write(
		`n8n 2.43.8 executed all ${operations.length} actions through its real authenticated HTTP helper (${packaged ? 'Bun-installed tarball' : 'custom directory'}). No live inference.\n`,
	);
} finally {
	server.stop(true);
}
