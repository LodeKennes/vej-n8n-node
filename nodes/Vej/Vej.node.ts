import { NodeConnectionTypes } from 'n8n-workflow';
import type { INodeProperties, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { operations, presetFor, resources, retentionApis } from './operations';
import { formProperties } from './forms';
import { prepareRequest, receiveResponse } from './routing';

const primitiveDisplay = { resource: ['decision'], operation: ['choice', 'noul', 'score'] };
const json = (value: object) => JSON.stringify(value, null, 2);
const largeResponses = {
	resource: ['workflow', 'calibration', 'feedback'],
	operation: ['risk', 'given', 'fit', 'get', 'readToken'],
	'@version': [2],
};

const properties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: resources.map(({ name, value }) => ({ name, value })),
		routing: { send: { preSend: [prepareRequest] }, output: { postReceive: [receiveResponse] } },
		default: 'decision',
	},
	...resources.map(
		({ value, defaultOperation }): INodeProperties => ({
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: { show: { resource: [value] } },
			options: operations
				.filter((operation) => operation.resource === value)
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((operation) => ({
					name: operation.name,
					value: operation.value,
					description: operation.description,
					action: operation.action,
				})),
			default: defaultOperation,
		}),
	),
	{
		displayName:
			'Beta APIs require early access. Availability is deployment-specific. Results retain all API statuses, metadata, and usage. <a href="https://itsvej.com/use-cases/">Read use cases and limitations</a>.',
		name: 'betaNotice',
		type: 'notice',
		default: '',
		displayOptions: { hide: { resource: ['decision', 'account', 'batch'] } },
	},
	{
		displayName:
			'Standard effort executes. Fast and careful are deferred; HTTP 200 can include unavailable questions. Check each result status.',
		name: 'effortNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['workflow'], operation: ['effort'] } },
	},
	{
		displayName:
			'Rankings remain Beta: the quality gate failed. The API may return ranking_unavailable when no qualified sidecar is configured.',
		name: 'rankingNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['workflow'], operation: ['rankings'] } },
	},
	{
		displayName:
			'Conversation history requires explicit organization retention consent. Create starts at sequence 1; append and query advance it. Use the returned sequence, and do not automatically retry writes.',
		name: 'stateNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['conversation'] } },
	},
	{
		displayName:
			'These defaults illustrate the input shape. Replace digests, labels, scores, and tokens with your own data. Risk fitting needs at least 500 independent risk-fit groups; this small example cannot qualify a threshold.',
		name: 'calibrationNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['calibration', 'feedback'] } },
	},
	{
		displayName:
			'Hosted batch execution requires approved EU storage hosts and is currently not open. URLs must be pre-signed by your storage provider.',
		name: 'batchNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['batch'] } },
	},
	{
		displayName: 'State Format',
		name: 'stateFormat',
		type: 'options',
		default: 'text',
		options: [
			{ name: 'Text', value: 'text' },
			{ name: 'JSON', value: 'json' },
		],
		displayOptions: { show: primitiveDisplay },
	},
	{
		displayName: 'State',
		name: 'state',
		type: 'string',
		typeOptions: { rows: 5 },
		default: '',
		placeholder: 'The situation, message, or document to assess',
		description: 'Text to assess. Use an expression to map an incoming field.',
		displayOptions: { show: { ...primitiveDisplay, stateFormat: ['text'] } },
	},
	{
		displayName: 'State (JSON)',
		name: 'stateJson',
		type: 'json',
		default: '{}',
		description:
			'A JSON object, array, or quoted string. Expressions can return an object directly.',
		displayOptions: { show: { ...primitiveDisplay, stateFormat: ['json'] } },
	},
	{
		displayName: 'Question ID',
		name: 'questionId',
		type: 'string',
		default: 'result',
		required: true,
		description: 'Key used in the answers object, for example answers.result',
		displayOptions: { show: primitiveDisplay },
	},
	{
		displayName: 'Question or Statement',
		name: 'question',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		required: true,
		description: 'For Noul, enter the statement whose truth should be assessed',
		displayOptions: { show: primitiveDisplay },
	},
	{
		displayName: 'Outcomes (JSON)',
		name: 'choices',
		type: 'json',
		required: true,
		default: json({
			route: 'Route to the appropriate team',
			review: 'Ask a person to review',
			other: 'None of the offered outcomes applies',
		}),
		description:
			'Map 2–255 semantic outcome names to descriptions. Both names and descriptions affect assessment.',
		displayOptions: { show: { resource: ['decision'], operation: ['choice'] } },
	},
	{
		displayName: 'Rubric Levels (JSON)',
		name: 'levels',
		type: 'json',
		required: true,
		default: json(['Missing essential details', 'Needs follow-up', 'Complete enough for review']),
		description:
			'2–10 distinct descriptions in order. Expected scores use indices starting at zero.',
		displayOptions: { show: { resource: ['decision'], operation: ['score'] } },
	},
	...[
		['Criteria', 'criteria', 'Optional assessment criteria'],
		['True Description', 'trueDescription', 'Optional semantic description of the true outcome'],
		['False Description', 'falseDescription', 'Optional semantic description of the false outcome'],
	].map(
		([displayName, name, description]): INodeProperties => ({
			displayName,
			name,
			description,
			type: 'string',
			default: '',
			displayOptions: { show: { resource: ['decision'], operation: ['noul'] } },
		}),
	),
	...operations
		.filter((operation) => operation.preset)
		.map(
			(operation): INodeProperties => ({
				displayName: operation.mode ? 'Input (JSON)' : 'Request (JSON)',
				name: 'input',
				type: 'json',
				required: true,
				default: json(presetFor(operation)),
				description: operation.mode
					? `The ${operation.mode} input object only. The node adds mode and input automatically. Use an expression to pass an incoming object.`
					: 'The complete API request body. Use an expression to pass an incoming object.',
				displayOptions: { show: { resource: [operation.resource], operation: [operation.value] } },
			}),
		),
	...resources
		.filter((resource) =>
			operations.some(
				(operation) => operation.resource === resource.value && operation.path.includes('{id}'),
			),
		)
		.map(
			(resource): INodeProperties => ({
				displayName: 'ID',
				name: 'recordId',
				type: 'string',
				default: '',
				required: true,
				description:
					'Resource ID returned by Vej. Map it from a previous node using an expression.',
				displayOptions: {
					show: {
						resource: [resource.value],
						operation: operations
							.filter(
								(operation) =>
									operation.resource === resource.value && operation.path.includes('{id}'),
							)
							.map((operation) => operation.value),
					},
				},
			}),
		),
	{
		displayName: 'Expected Sequence',
		name: 'expectedSeq',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 2147483647, numberPrecision: 0 },
		default: 1,
		required: true,
		description:
			'The latest sequence returned by Vej. Stale sequences fail without deleting another version.',
		displayOptions: { show: { resource: ['conversation'], operation: ['delete'] } },
	},
	{
		displayName: 'API',
		name: 'retentionApi',
		type: 'options',
		options: retentionApis.map((api) => ({ name: api, value: api })),
		default: 'states',
		displayOptions: { show: { resource: ['retention'] } },
	},
	{
		displayName: 'Retention Enabled',
		name: 'retentionEnabled',
		type: 'boolean',
		default: false,
		description:
			'Whether your organization consents to retaining data for this API. Revocation schedules erasure and may invalidate fits. Requires an organization administrator.',
		displayOptions: { show: { resource: ['retention'], operation: ['set'] } },
	},
	{
		displayName: 'Period',
		name: 'period',
		type: 'options',
		default: '30d',
		options: [
			{ name: '7 Days', value: '7d' },
			{ name: '30 Days', value: '30d' },
			{ name: '90 Days', value: '90d' },
		],
		displayOptions: { show: { resource: ['account'], operation: ['usage'] } },
	},
	{
		displayName: 'Model',
		name: 'usageModel',
		type: 'options',
		default: '',
		options: [
			{ name: 'All Models', value: '' },
			{ name: 'Pea', value: 'pea' },
			{ name: 'Pepper', value: 'pepper' },
			{ name: 'Pumpkin', value: 'pumpkin' },
		],
		description:
			'Usage filter only; does not select an inference model or imply model availability',
		displayOptions: { show: { resource: ['account'], operation: ['usage'] } },
	},
	{
		displayName: 'Timeout (Milliseconds)',
		name: 'timeout',
		type: 'number',
		typeOptions: { minValue: 1000, maxValue: 600000, numberPrecision: 0 },
		default: 60000,
		description:
			'Request timeout. A timeout does not prove a write failed; inspect state before retrying.',
	},
];

export class Vej implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Vej',
		name: 'vej',
		icon: { light: 'file:vej.svg', dark: 'file:vej.dark.svg' },
		group: ['transform'],
		version: [1, 2],
		defaultVersion: 2,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'Native decisions, typed extraction, and Vej Beta workflows with probabilities.',
		defaults: { name: 'Vej' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'vejApi', required: true }],
		requestDefaults: {
			baseURL: '={{ $credentials.baseUrl }}',
			url: '/',
			json: true,
			disableFollowRedirect: true,
		},
		properties: [
			...properties
				.filter((property) => property.name !== 'timeout')
				.flatMap((property): INodeProperties[] => {
					if (['choices', 'levels'].includes(property.name))
						return [
							{
								...property,
								displayOptions: {
									...property.displayOptions,
									show: { ...property.displayOptions?.show, '@version': [1] },
								},
							},
						];
					if (property.name === 'input')
						return [
							{
								...property,
								displayOptions: {
									...property.displayOptions,
									show: { ...property.displayOptions?.show, '@version': [1] },
								},
							},
							{
								...property,
								displayOptions: {
									...property.displayOptions,
									show: { ...property.displayOptions?.show, '@version': [2], inputMode: ['json'] },
								},
							},
						];
					return [property];
				}),
			...formProperties,
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: false,
				description:
					'Whether to return a simplified version of the response instead of the raw data',
				displayOptions: { show: { ...largeResponses, '@tool': [false] } },
			},
			{
				displayName: 'Output',
				name: 'output',
				type: 'options',
				default: 'raw',
				options: [
					{ name: 'Raw', value: 'raw', description: 'Return every API response field' },
					{
						name: 'Selected Fields',
						value: 'selected',
						description: 'Return chosen fields and available resource identifiers',
					},
					{
						name: 'Simplified',
						value: 'simplified',
						description: 'Return up to ten commonly used response fields',
					},
				],
				displayOptions: { show: { ...largeResponses, '@tool': [true] } },
			},
			{
				displayName: 'Fields to Include',
				name: 'outputFields',
				type: 'multiOptions',
				default: ['probabilities', 'decision', 'status', 'metadata', 'usage'],
				options: [
					'binding',
					'bound',
					'calibration',
					'calibration_id',
					'calibration_identity',
					'calls',
					'candidate_index',
					'candidate_keys',
					'check_report',
					'check_sha256',
					'condition',
					'conditional',
					'confidence',
					'decision',
					'drift_warning',
					'events_used',
					'expected_answer_rate',
					'feedback_ids',
					'feedback_sha256',
					'first_outcome',
					'grid_reports',
					'live_answers',
					'live_sample_size',
					'marginal',
					'metadata',
					'mode',
					'model',
					'population_assumption',
					'probabilities',
					'product',
					'sample_size',
					'semantics',
					'status',
					'target_error_rate',
					'temperature',
					'threshold',
					'upper_bound',
					'usage',
				].map((value) => ({
					name: value
						.split('_')
						.map((word) => word[0].toUpperCase() + word.slice(1))
						.join(' '),
					value,
				})),
				displayOptions: { show: { ...largeResponses, '@tool': [true], output: ['selected'] } },
			},
			properties.find((property) => property.name === 'timeout')!,
		],
	};
}
