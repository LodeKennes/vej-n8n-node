import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { operations, presetFor, resources, retentionApis } from './operations';
import { buildRequest, serviceUrl } from './request';

const primitiveDisplay = { resource: ['decision'], operation: ['choice', 'noul', 'score'] };
const json = (value: object) => JSON.stringify(value, null, 2);

const properties: INodeProperties[] = [
	{
		displayName: 'Resource',
		name: 'resource',
		type: 'options',
		noDataExpression: true,
		options: [...resources],
		default: 'decision',
	},
	// The default below is resolved from the operation catalog for each resource.
	/* eslint-disable n8n-nodes-base/node-param-default-missing -- Catalog-generated default is present below. */
	...resources.map(
		(resource): INodeProperties => ({
			displayName: 'Operation',
			name: 'operation',
			type: 'options',
			noDataExpression: true,
			displayOptions: { show: { resource: [resource.value] } },
			options: operations
				.filter((operation) => operation.resource === resource.value)
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((operation) => ({
					name: operation.name,
					value: operation.value,
					description: operation.description,
					action: operation.name,
				})),
			default: operations.find((operation) => operation.resource === resource.value)!.value,
		}),
	),
	/* eslint-enable n8n-nodes-base/node-param-default-missing */
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
		version: 1,
		subtitle: '={{$parameter["resource"] + ": " + $parameter["operation"]}}',
		description: 'State in, probabilities out. Native decisions and all 11 Vej Beta workflows.',
		defaults: { name: 'Vej' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'vejApi', required: true }],
		properties,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const output: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('vejApi');
		const baseUrl = serviceUrl(credentials.baseUrl);
		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let request;
				try {
					request = buildRequest(resource, operation, (name, fallback) =>
						this.getNodeParameter(name, i, fallback),
					);
				} catch (error) {
					throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
				}
				const { path, ...options } = request;
				let response: unknown;
				try {
					response = await this.helpers.httpRequestWithAuthentication.call(this, 'vejApi', {
						...options,
						url: `${baseUrl}${path}`,
					});
				} catch (error) {
					// Keep transport request objects (and their authorization headers) out of errors.
					const failure = error as {
						statusCode?: number;
						response?: { status?: number; body?: IDataObject; data?: IDataObject };
					};
					const status =
						error instanceof NodeApiError
							? error.httpCode
							: (failure.statusCode ?? failure.response?.status);
					const problem = failure.response?.body ?? failure.response?.data;
					const detail =
						error instanceof NodeApiError
							? error.description
							: (problem?.detail ?? problem?.error ?? problem?.title);
					const description =
						typeof detail === 'string'
							? detail
							: 'Vej request failed. Check service availability, credentials, access, and input.';
					const safeDescription =
						typeof credentials.apiKey === 'string' && credentials.apiKey
							? description.split(credentials.apiKey).join('[REDACTED]')
							: description;
					throw new NodeApiError(this.getNode(), { message: safeDescription } as JsonObject, {
						httpCode: status ? String(status) : undefined,
						itemIndex: i,
						description: safeDescription,
						message: status ? `Vej API returned HTTP ${status}` : 'Vej API request failed',
					});
				}
				if (response === '' || response == null) response = {};
				if (typeof response !== 'object' || Array.isArray(response))
					throw new NodeOperationError(
						this.getNode(),
						'Vej returned an unexpected response shape.',
						{ itemIndex: i },
					);
				output.push({ json: response as IDataObject, pairedItem: { item: i } });
			} catch (error) {
				// Errors inside this boundary are already normalized to n8n error types.
				// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
				if (!this.continueOnFail()) throw error;
				output.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
			}
		}
		return [output];
	}
}
