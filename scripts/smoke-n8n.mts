import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { operations, presetFor } from '../nodes/Vej/operations';
import { formDefaults } from '../nodes/Vej/forms';
import packageJson from '../package.json';

// This is a local transport/integration fixture, not an inference or quality test.
const packaged = Bun.argv.includes('--package');
const cloud = Bun.argv.includes('--cloud');
const forms = packaged || Bun.argv.includes('--forms');
const directory = resolve(
	cloud
		? 'artifacts/n8n-smoke-cloud'
		: packaged
			? 'artifacts/n8n-smoke-package'
			: forms
				? 'artifacts/n8n-smoke-forms'
				: 'artifacts/n8n-smoke',
);
await mkdir(directory, { recursive: true, mode: 0o777 });
if (packaged) {
	const destination = `${directory}/data/.n8n/nodes`;
	await mkdir(destination, { recursive: true });
	await Bun.write(`${destination}/package.json`, '{"private":true}\n');
	const install = Bun.spawn(
		[
			'bun',
			'add',
			'--ignore-scripts',
			resolve(`artifacts/n8n-nodes-vej-${packageJson.version}.tgz`),
		],
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
		if (body?.state === 'fixture_429')
			return Response.json(
				{ detail: 'Rate limit reached; echoed vej_sk_local_fixture' },
				{ status: 429 },
			);
		if (request.method === 'DELETE') return new Response(null, { status: 204 });
		if (url.pathname === '/v1beta/extract') {
			if (
				body.model !== 'clairic' ||
				!body.fields?.invoice_number ||
				!body.fields?.total ||
				'mode' in body ||
				'input' in body
			)
				return Response.json({ detail: 'Expected a direct extraction request' }, { status: 400 });
			return Response.json({
				model: 'pea-pod-1',
				answers: {
					invoice_number: {
						type: 'text',
						value: 'INV-2291',
						guess: 'INV-2291',
						p_null: 0.1,
						confidence: 0.8,
						span: [8, 16],
					},
					total: {
						type: 'number',
						value: null,
						guess: 1080,
						p_null: 0.8,
						confidence: 0.7,
						span: [51, 60],
					},
				},
				truncated: false,
				metadata: { fixture_only: true, calibrated: false, offsets: 'code_points' },
				usage: { input_tokens: 100, output_tokens: 0, passes: 2 },
			});
		}
		return Response.json({
			model: 'pea',
			id,
			seq: 2,
			answers: { result: { type: 'noul', noul: 0.7, probabilities: { true: 0.7, false: 0.3 } } },
			metadata: { fixture_only: true },
			usage: { processed_tokens: 0 },
			fixture: { method: request.method, path: url.pathname },
			observed_state: body?.state,
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
	typeVersion: forms ? 2 : 1,
	position: [300, index * 150],
	credentials: { vejApi: { id: 'vej-local-fixture', name: 'Vej local fixture' } },
	parameters: {
		resource: operation.resource,
		operation: operation.value,
		...(!forms && operation.preset ? { input: JSON.stringify(presetFor(operation)) } : {}),
		state: 'Local fixture only.',
		stateFormat: 'text',
		question: 'Is this a fixture?',
		questionId: 'result',
		choices: '{"yes":"A fixture","no":"A live request"}',
		levels: '["Low","High"]',
		...(forms
			? {
					inputMode: 'form',
					...formDefaults(operation),
					outcomeRows: {
						entries: [
							{ name: 'yes', description: 'A fixture' },
							{ name: 'no', description: 'A live request' },
						],
					},
					levelRows: { entries: [{ description: 'Low' }, { description: 'High' }] },
				}
			: {}),
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
const selectedWorkflow = cloud ? await Bun.file('examples/cloud-choice.json').json() : workflow;
if (cloud) {
	selectedWorkflow.id = 'vej-smoke-cloud-choice';
	const request = selectedWorkflow.nodes.find((node: { id: string }) => node.id === 'request');
	request.parameters.url = `http://127.0.0.1:${server.port}/v1/predict`;
	request.credentials = { httpHeaderAuth: { id: 'vej-local-fixture', name: 'Vej local fixture' } };
}
await Bun.write(`${directory}/workflow.json`, JSON.stringify(selectedWorkflow));
await Bun.write(
	`${directory}/credentials.json`,
	JSON.stringify([
		{
			id: 'vej-local-fixture',
			name: 'Vej local fixture',
			type: cloud ? 'httpHeaderAuth' : 'vejApi',
			data: cloud
				? { name: 'Authorization', value: 'Bearer vej_sk_local_fixture' }
				: { baseUrl: `http://127.0.0.1:${server.port}`, apiKey: 'vej_sk_local_fixture' },
		},
	]),
);

const base = [
	'docker',
	'run',
	'--rm',
	'--network',
	'host',
	// GitHub's runner UID differs from the image's node user. Keep mounted
	// fixture data owned by the invoking user without broadening permissions.
	...(process.getuid && process.getgid
		? ['--user', `${process.getuid()}:${process.getgid()}`]
		: []),
	...(!packaged && !cloud
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
	if (code !== 0)
		throw new Error(
			`${args[0]} failed (${code}); inspect ${directory}/${file}.log\n${(stderr || stdout).slice(-4000)}`,
		);
	return stdout;
}
try {
	await command(['import:credentials', '--input=/fixture/credentials.json'], 'import-credentials');
	await command(['import:workflow', '--input=/fixture/workflow.json'], 'import-workflow');
	const output = await command(
		['execute', `--id=${selectedWorkflow.id}`, '--rawOutput'],
		'execute',
	);
	if (received.length !== (cloud ? 1 : operations.length))
		throw new Error(`Expected ${operations.length} requests; received ${received.length}.`);
	for (const operation of cloud ? [] : operations) {
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
	if (cloud) {
		const request = received[0];
		const body = request.body as {
			state: string;
			questions: { result: { type: string; options: object } };
		};
		if (
			request.path !== '/v1/predict' ||
			request.method !== 'POST' ||
			body.questions.result.type !== 'choice' ||
			Object.keys(body.questions.result.options).join(',') !== 'replacement,other'
		)
			throw new Error('Built-in Cloud starter did not emit the expected native Choice request.');
	}
	if (!output.includes('"fixture_only": true'))
		throw new Error('Expected fixture metadata in n8n execution output.');
	if (!cloud) {
		const start = output.indexOf('{\n  "data":');
		if (start < 0) throw new Error('Expected execution JSON in all-action output.');
		const run = JSON.parse(output.slice(start));
		for (const operation of operations) {
			const item =
				run.data.resultData.runData[`${operation.resource}-${operation.value}`][0].data.main[0][0];
			if (item.pairedItem?.item !== 0) throw new Error('Missing output item pairing.');
			if (
				operation.value === 'extract' &&
				(item.json.answers.invoice_number.span[0] !== 8 ||
					item.json.answers.total.value !== null ||
					item.json.metadata.calibrated !== false ||
					item.json.usage.output_tokens !== 0)
			)
				throw new Error('Extraction output lost evidence, null values, metadata, or usage.');
			if (operation.method === 'DELETE') {
				if (forms ? item.json.deleted !== true : Object.keys(item.json).length !== 0)
					throw new Error('Deletion output did not preserve the expected node-version behavior.');
			}
		}
	}
	await Bun.write(`${directory}/requests.json`, JSON.stringify(received, null, 2));
	if (packaged) {
		const routingWorkflow = {
			id: 'vej-smoke-routing',
			name: 'Vej declarative routing behavior',
			active: false,
			nodes: [
				trigger,
				{
					id: 'items',
					name: 'Prepare items',
					type: 'n8n-nodes-base.code',
					typeVersion: 2,
					position: [200, 0],
					parameters: {
						jsCode:
							'return ["fixture_first", "fixture_429", "fixture_invalid", "fixture_second"].map(state => ({json: {state}}));',
					},
				},
				{
					id: 'vej-routing',
					name: 'Check routing',
					type: 'n8n-nodes-vej.vej',
					typeVersion: 2,
					position: [400, 0],
					credentials: { vejApi: { id: 'vej-local-fixture', name: 'Vej local fixture' } },
					continueOnFail: true,
					retryOnFail: false,
					parameters: {
						resource: 'decision',
						operation: 'score',
						stateFormat: 'text',
						state: '={{ $json.state }}',
						question: 'Is this a local fixture?',
						questionId: 'result',
						levelRows: {
							entries: [
								{ description: 'Low' },
								{ description: '={{ $json.state === "fixture_invalid" ? "" : "High" }}' },
							],
						},
						timeout: 60000,
					},
				},
			],
			connections: {
				'Run fixture': { main: [[{ node: 'Prepare items', type: 'main', index: 0 }]] },
				'Prepare items': { main: [[{ node: 'Check routing', type: 'main', index: 0 }]] },
			},
			settings: { executionOrder: 'v1' },
		};
		await Bun.write(`${directory}/routing-workflow.json`, JSON.stringify(routingWorkflow));
		await command(['import:workflow', '--input=/fixture/routing-workflow.json'], 'import-routing');
		const before = received.length;
		const routed = await command(
			['execute', '--id=vej-smoke-routing', '--rawOutput'],
			'execute-routing',
		);
		const start = routed.indexOf('{\n  "data":');
		if (start < 0) throw new Error('Expected execution JSON in routing output.');
		const run = JSON.parse(routed.slice(start));
		const items = run.data.resultData.runData['Check routing'][0].data.main[0];
		if (received.length - before !== 3 || items.length !== 4)
			throw new Error(
				'Routing must continue across four inputs, skip invalid input, and never retry 429.',
			);
		for (const [index, state] of [
			[0, 'fixture_first'],
			[3, 'fixture_second'],
		] as const) {
			if (items[index].json.observed_state !== state || items[index].pairedItem?.item !== index)
				throw new Error('Per-item expressions or output pairing changed.');
		}
		const errors = JSON.stringify([items[1], items[2]]);
		if (
			!errors.includes('429') ||
			!errors.includes('Level description') ||
			errors.includes('vej_sk_local_fixture')
		)
			throw new Error('Expected sanitized HTTP error and validation error in continued output.');
		process.stdout.write(
			'Real declarative routing preserved per-item expressions, pairing, HTTP 429 redaction, validation, continuation, and no retry.\n',
		);
	}
	process.stdout.write(
		cloud
			? 'Built-in-node Cloud starter executed successfully in n8n 2.43.8 against the local API fixture; no custom node loaded.\n'
			: `n8n 2.43.8 executed all ${operations.length} actions through its real authenticated HTTP helper (${packaged ? 'Bun-installed tarball' : 'custom directory'}, ${forms ? 'version 2 forms' : 'version 1 JSON'}). No live inference.\n`,
	);
} finally {
	server.stop(true);
}
