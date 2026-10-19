import { operations, presetFor } from '../nodes/Vej/operations';

const custom = Bun.argv.includes('--custom');
const directory = custom ? 'artifacts/custom-examples' : 'examples';
const nodeType = custom ? 'CUSTOM.vej' : 'n8n-nodes-vej.vej';
const examples = [
	['01-choice', 'decision', 'choice'],
	['02-noul', 'decision', 'noul'],
	['03-score', 'decision', 'score'],
	['04-mixed-questions', 'decision', 'predict'],
	['05-target-error-rate', 'workflow', 'risk'],
	['06-show-the-evidence', 'workflow', 'alignments'],
	['07-number-with-a-range', 'workflow', 'estimate'],
	['08-label-a-document', 'workflow', 'annotate'],
	['09-watch-a-conversation', 'conversation', 'create'],
	['10-use-your-corrections', 'feedback', 'fit'],
	['11-if-so-then', 'workflow', 'given'],
	['12-pick-the-correct-record', 'workflow', 'bind'],
	['13-step-by-step-checks', 'workflow', 'flows'],
	['14-rank-with-probabilities', 'workflow', 'rankings'],
	['15-select-effort', 'workflow', 'effort'],
	['16-fit-a-calibration', 'calibration', 'fit'],
];
for (const [filename, resource, value] of examples) {
	const operation = operations.find((item) => item.resource === resource && item.value === value)!;
	const note = [
		'Choose your Vej API credential before running. This example is inactive and runs no external actions.',
		operation.mode
			? 'Beta: model access and deployment support are required. Read https://itsvej.com/use-cases/ for current limitations.'
			: '',
		resource === 'conversation'
			? 'Explicit states retention consent is required. Append and query use the returned sequence; do not enable Retry On Fail.'
			: '',
		['risk', 'fit'].includes(value)
			? 'Shape example only: replace placeholder digests, tokens, scores, and labels with your own data. Small calibration fixtures cannot qualify a risk target.'
			: '',
		value === 'rankings'
			? 'Rankings quality gate failed. This example demonstrates the request contract, not validated quality.'
			: '',
		value === 'effort'
			? 'Standard executes. Fast and careful are deferred; inspect every question status.'
			: '',
	]
		.filter(Boolean)
		.join('\n\n');
	const parameters = operation.preset
		? {
				resource,
				operation: value,
				input: JSON.stringify(presetFor(operation), null, 2),
				timeout: 60000,
			}
		: {
				resource,
				operation: value,
				stateFormat: 'text',
				state: 'The customer received a damaged desk lamp and asks for a replacement.',
				questionId: 'result',
				question:
					value === 'noul'
						? 'The customer requests a replacement.'
						: value === 'score'
							? 'How complete is the request for review?'
							: 'Which queue should receive this request?',
				choices: JSON.stringify(
					{
						replacement: 'Review a replacement request',
						refund: 'Review a refund request',
						other: 'Ask a person for more information',
					},
					null,
					2,
				),
				levels: JSON.stringify(
					[
						'Missing the issue and item',
						'Has the issue but needs order details',
						'Contains all details needed for review',
					],
					null,
					2,
				),
				timeout: 60000,
			};
	const workflow = {
		name: `Vej · ${operation.name}`,
		active: false,
		nodes: [
			{
				id: 'manual',
				name: 'Run example',
				type: 'n8n-nodes-base.manualTrigger',
				typeVersion: 1,
				position: [260, 300],
				parameters: {},
			},
			{
				id: 'vej',
				name: operation.name,
				type: nodeType,
				typeVersion: 1,
				position: [520, 300],
				parameters,
				notes: note,
				notesInFlow: true,
				retryOnFail: false,
			},
		],
		connections: { 'Run example': { main: [[{ node: operation.name, type: 'main', index: 0 }]] } },
		settings: { executionOrder: 'v1' },
		pinData: {},
	};
	await Bun.write(`${directory}/${filename}.json`, JSON.stringify(workflow, null, 2) + '\n');
}
// A useful state example exercises expression-based IDs, sequences, and object inputs.
const conversation = await Bun.file(`${directory}/09-watch-a-conversation.json`).json();
conversation.nodes.push({
	id: 'append',
	name: 'Append a message',
	type: nodeType,
	typeVersion: 1,
	position: [820, 300],
	retryOnFail: false,
	parameters: {
		resource: 'conversation',
		operation: 'append',
		recordId: '={{ $json.id }}',
		timeout: 60000,
		input:
			'={{ { operation: "event", expected_seq: $json.seq, event: "Customer: The lamp arrived broken. Please send a replacement.", questions: { replacement: { type: "noul", statement: "The customer requests a replacement." } } } }}',
	},
	notes:
		'Select your Vej credential. Uses the create result ID and sequence; this action advances the sequence.',
	notesInFlow: true,
});
conversation.connections['Create a Conversation'] = {
	main: [[{ node: 'Append a message', type: 'main', index: 0 }]],
};
await Bun.write(
	`${directory}/09-watch-a-conversation.json`,
	JSON.stringify(conversation, null, 2) + '\n',
);

process.stdout.write(
	`Wrote ${examples.length} inactive ${custom ? 'custom-directory' : 'community-package'} examples to ${directory}.\n`,
);
