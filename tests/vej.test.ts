/* eslint-disable @n8n/community-nodes/no-restricted-imports -- Bun test tooling is not shipped or executed inside n8n. */
import { describe, expect, test } from 'bun:test';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type {
	IDataObject,
	IExecuteSingleFunctions,
	INode,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { NodeApiError, NodeHelpers, NodeOperationError } from 'n8n-workflow';
import { Vej } from '../nodes/Vej/Vej.node';
import { VejApi } from '../credentials/VejApi.credentials';
import { operations, presetFor, resources } from '../nodes/Vej/operations';
import { buildRequest, jsonValue, serviceUrl } from '../nodes/Vej/request';
import { formDefaults, fieldsFor } from '../nodes/Vej/forms';
import { formValues } from '../nodes/Vej/form-input';
import { prepareRequest, receiveResponse } from '../nodes/Vej/routing';
import ga from './contracts/ga.json';
import beta from './contracts/beta.json';
import extract from './contracts/extract.json';

const node: INode = {
	id: 'vej-test',
	name: 'Vej',
	type: 'n8n-nodes-vej.vej',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema(ga, 'ga');
ajv.addSchema(beta, 'beta');
ajv.addSchema(extract, 'extract');

function valid(document: 'ga' | 'beta' | 'extract', name: string, value: unknown) {
	const validate = ajv.compile({ $ref: `${document}#/components/schemas/${name}` });
	expect(validate(value), JSON.stringify(validate.errors)).toBe(true);
}

function params(overrides: Record<string, unknown> = {}) {
	const values: Record<string, unknown> = {
		state: 'A request to review.',
		stateFormat: 'text',
		question: 'Is a review needed?',
		questionId: 'result',
		choices: { review: 'Ask a person', proceed: 'Continue the workflow' },
		levels: ['Missing information', 'Complete information'],
		recordId: '6d699805-8bd0-44f6-85aa-e60aa9e04744',
		expectedSeq: 2,
		timeout: 60000,
		...overrides,
	};
	return (name: string, fallback?: unknown) => (name in values ? values[name] : fallback);
}

const schemaFor: Record<string, string> = {
	risk: 'RiskRiskInput',
	alignments: 'RiskAlignmentInput',
	annotate: 'RiskAnnotateInput',
	estimate: 'RiskEstimateInput',
	given: 'RiskGivenInput',
	bind: 'RiskBindInput',
	flows: 'RiskFlowInput',
	rankings: 'RiskRankingInput',
	effort: 'RiskEffortInput',
	calibrations: 'RiskCalibrationInput',
	feedback: 'RiskFeedbackInput',
	createState: 'RiskStateInput',
	stateEvent: 'RiskStateInput',
	queryState: 'RiskStateInput',
	calibrationToken: 'RiskCalibrationReference',
};

describe('all published use cases and lifecycle operations', () => {
	for (const operation of operations) {
		test(`${operation.resource}/${operation.value} routes to the documented API`, () => {
			const request = buildRequest(
				operation.resource,
				operation.value,
				params({ input: presetFor(operation) }),
			);
			expect(request.method).toBe(operation.method);
			expect(request.path).toBe(
				operation.path
					.replace('{id}', '6d699805-8bd0-44f6-85aa-e60aa9e04744')
					.replace('{api}', 'states'),
			);
			expect(request.disableFollowRedirect).toBe(true);
			if (operation.preset) {
				if (operation.mode) {
					const body = request.body as { mode: string; input: unknown };
					expect(body.mode).toBe(operation.mode);
					valid('beta', schemaFor[operation.preset], body.input);
				} else if (operation.value === 'extract') {
					valid('extract', 'ExtractRequest', request.body);
				} else {
					valid(
						'ga',
						operation.preset === 'batch' ? 'BatchRequest' : 'NativeRequest',
						request.body,
					);
				}
			} else if (operation.resource === 'decision') valid('ga', 'NativeRequest', request.body);
			else if (operation.resource === 'retention' && operation.value === 'set')
				valid('beta', 'RetentionUpdate', request.body);
			else expect(request.body).toBeUndefined();
		});
	}
	test('all 11 use cases have distinct actions', () => {
		const modes = new Set(operations.map((operation) => operation.mode));
		for (const mode of [
			'risk',
			'alignments',
			'estimate',
			'annotate',
			'states',
			'feedback',
			'given',
			'bind',
			'flows',
			'rankings',
			'effort',
		])
			expect(modes.has(mode)).toBe(true);
	});
	test('all resource defaults and JSON fields are visible and have usable defaults', () => {
		const properties = new Vej().description.properties;
		for (const resource of resources) {
			const field = properties.find(
				(property) =>
					property.name === 'operation' &&
					property.displayOptions?.show?.resource?.includes(resource.value),
			);
			expect(
				operations.some(
					(operation) =>
						operation.resource === resource.value && operation.value === field?.default,
				),
			).toBe(true);
		}
		for (const operation of operations.filter((item) => item.preset)) {
			const field = properties.find(
				(property) =>
					property.name === 'input' &&
					property.displayOptions?.show?.resource?.includes(operation.resource) &&
					property.displayOptions?.show?.operation?.includes(operation.value),
			);
			expect(JSON.parse(field!.default as string)).toEqual(presetFor(operation));
		}
	});
});

describe('version 2 form builders', () => {
	for (const operation of operations.filter((item) => item.preset)) {
		test(`${operation.resource}/${operation.value} form defaults satisfy the pinned API schema`, () => {
			expect(fieldsFor(operation).length).toBeGreaterThan(0);
			const get = params({ ...formDefaults(operation), inputMode: 'form' });
			const fields = formValues(operation.resource, operation.value, get);
			const request = buildRequest(operation.resource, operation.value, (key, fallback) =>
				key in fields ? fields[key] : get(key, fallback),
			);
			if (operation.mode)
				valid('beta', schemaFor[operation.preset!], (request.body as { input: unknown }).input);
			else if (operation.value === 'extract') valid('extract', 'ExtractRequest', request.body);
			else
				valid(
					'ga',
					operation.resource === 'batch' ? 'BatchRequest' : 'NativeRequest',
					request.body,
				);
		});
	}
	test('outcome and rubric rows become ordered native candidate inputs', () => {
		const options = formValues(
			'decision',
			'choice',
			params({
				outcomeRows: {
					entries: [
						{ name: 'refund', description: 'Return the payment' },
						{ name: 'other', description: 'Ask for more information' },
					],
				},
			}),
		);
		expect(options).toEqual({
			choices: { refund: 'Return the payment', other: 'Ask for more information' },
		});
		expect(
			formValues(
				'decision',
				'score',
				params({ levelRows: { entries: [{ description: 'Low' }, { description: 'High' }] } }),
			),
		).toEqual({ levels: ['Low', 'High'] });
		expect(() =>
			formValues(
				'decision',
				'choice',
				params({
					outcomeRows: {
						entries: [
							{ name: 'same', description: 'First' },
							{ name: 'same', description: 'Second' },
						],
					},
				}),
			),
		).toThrow('duplicate');
	});
	test('record field controls preserve false, null, zero and empty strings', () => {
		const spec = operations.find((item) => item.value === 'bind')!;
		const defaults = formDefaults(spec);
		const fields = formValues(
			'workflow',
			'bind',
			params({
				...defaults,
				records: {
					entries: [
						{
							id: 'r1',
							name: 'record',
							description: 'A supplied record',
							fields: {
								entries: [
									{ key: 'enabled', valueType: 'boolean', booleanValue: false },
									{ key: 'owner', valueType: 'null' },
									{ key: 'count', valueType: 'number', numberValue: 0 },
									{ key: 'note', valueType: 'text', textValue: '' },
								],
							},
						},
					],
				},
			}),
		);
		expect(((fields.input as IDataObject).records as IDataObject[])[0].fields).toEqual({
			enabled: false,
			owner: null,
			count: 0,
			note: '',
		});
	});
	test('conditional boolean false remains a boolean', () => {
		const spec = operations.find((item) => item.value === 'given')!;
		const fields = formValues(
			'workflow',
			'given',
			params({ ...formDefaults(spec), conditionType: 'false' }),
		);
		expect((fields.input as IDataObject).condition).toBe(false);
	});
	test('duplicate question IDs fail across question types', () => {
		const spec = operations.find((item) => item.value === 'effort')!;
		expect(() =>
			formValues(
				'workflow',
				'effort',
				params({
					...formDefaults(spec),
					questionBuilder: {
						noul: [
							{ id: 'same', prompt: 'First' },
							{ id: 'same', prompt: 'Second' },
						],
					},
				}),
			),
		).toThrow('duplicate');
	});
	test('custom document spans count Unicode code points and reject out-of-range offsets', () => {
		const spec = operations.find((item) => item.value === 'annotate')!;
		const defaults = { ...formDefaults(spec), document: '😀Hi', segmentation: 'custom' };
		const fields = formValues(
			'workflow',
			'annotate',
			params({ ...defaults, segments: { entries: [{ id: 'one', start: 0, end: 3 }] } }),
		);
		expect((fields.input as IDataObject).segments).toEqual([{ id: 'one', start: 0, end: 3 }]);
		expect(() =>
			formValues(
				'workflow',
				'annotate',
				params({ ...defaults, segments: { entries: [{ id: 'one', start: 0, end: 4 }] } }),
			),
		).toThrow('code-point');
	});
	test('numeric estimate bins reject duplicates and descending values', () => {
		const spec = operations.find((item) => item.value === 'estimate')!;
		expect(() =>
			formValues(
				'workflow',
				'estimate',
				params({
					...formDefaults(spec),
					estimates: {
						entries: [
							{
								id: 'hours',
								question: 'How long?',
								unit: 'hours',
								values: { entries: [{ value: 2 }, { value: 1 }] },
							},
						],
					},
				}),
			),
		).toThrow('increasing');
	});
	test('advanced JSON passes through without evaluating hidden form controls', () => {
		expect(formValues('workflow', 'bind', params({ inputMode: 'json' }))).toEqual({});
	});
	test('calibration labels follow outcome identity when numeric names reorder in JSON objects', () => {
		const spec = operations.find(
			(item) => item.resource === 'calibration' && item.value === 'fit',
		)!;
		const labeled = {
			group: '1'.repeat(64),
			state: 'Choose the ten outcome.',
			targetOutcome: '10',
			questions: {
				choice: [
					{
						id: 'choice',
						prompt: 'Which outcome applies?',
						outcomeRows: {
							entries: [
								{ name: '10', description: 'Ten items' },
								{ name: '2', description: 'Two items' },
							],
						},
					},
				],
			},
		};
		const fields = formValues(
			'calibration',
			'fit',
			params({ ...formDefaults(spec), temperatureFit: { entries: [labeled] } }),
		);
		const fit = ((fields.input as IDataObject).temperature_fit as IDataObject[])[0];
		const question = Object.values(
			(fit.request as IDataObject).questions as IDataObject,
		)[0] as IDataObject;
		expect(Object.keys(question.options as IDataObject)).toEqual(['2', '10']);
		expect(fit.target).toBe(1);
		valid('beta', 'RiskCalibrationInput', fields.input);
	});
	test('new nodes default to version 2 while version 1 remains available', () => {
		expect(new Vej().description.version).toEqual([1, 2]);
		expect(new Vej().description.defaultVersion).toBe(2);
	});
	test('version 2 execution builds requests from per-item form rows', async () => {
		const fixture = execution(
			[
				{
					resource: 'decision',
					operation: 'choice',
					outcomeRows: {
						entries: [
							{ name: 'yes', description: 'Proceed' },
							{ name: 'no', description: 'Review' },
						],
					},
				},
			],
			async (request) => ({ received: request.body }),
			false,
			2,
		);
		const [items] = await fixture.run();
		expect(
			(items[0].json.received as { questions: { result: { options: object } } }).questions.result
				.options,
		).toEqual({ yes: 'Proceed', no: 'Review' });
	});
});

describe('typed extraction', () => {
	const spec = operations.find((operation) => operation.value === 'extract')!;
	const defaults = formDefaults(spec);
	const request = (overrides: Record<string, unknown> = {}) => {
		const get = params({ ...defaults, ...overrides });
		const fields = formValues('workflow', 'extract', get);
		return buildRequest('workflow', 'extract', (name, fallback) =>
			name in fields ? fields[name] : get(name, fallback),
		);
	};
	test('n8n defaults to visible form rows and only shows numeric options for numeric types', () => {
		const description = new Vej().description;
		const normalized = NodeHelpers.getNodeParameters(
			description.properties,
			{
				resource: 'workflow',
				operation: 'extract',
				extractFields: {
					entries: [
						{ name: 'amount', type: 'number', numberOptions: { integer: false, decimals: 0 } },
						{ name: 'label', type: 'text', numberOptions: { unit: 'USD' } },
					],
				},
			},
			true,
			false,
			{ typeVersion: 2 },
			description,
		)!;
		expect(normalized.inputMode).toBe('form');
		expect(normalized).not.toHaveProperty('input');
		const rows = (normalized.extractFields as { entries: IDataObject[] }).entries;
		expect(rows[0].numberOptions).toEqual({ integer: false, decimals: 0 });
		expect(rows[1]).not.toHaveProperty('numberOptions');
		expect(rows[1].nullThreshold).toBe(0.5);
		valid('extract', 'ExtractRequest', request(normalized).body);
	});
	test('all seven types emit a direct request, preserving false and zero options', () => {
		const types = ['text', 'number', 'date', 'time', 'datetime', 'duration', 'list'];
		const body = request({
			referenceDate: '2026-10-21',
			extractFields: {
				entries: types.map((type) => ({
					name: type,
					type,
					numberOptions: { integer: false, decimals: 0 },
				})),
			},
		}).body as IDataObject;
		valid('extract', 'ExtractRequest', body);
		expect(body).not.toHaveProperty('mode');
		expect(body).not.toHaveProperty('input');
		expect(body.reference_date).toBe('2026-10-21');
		expect((body.fields as IDataObject).list).toEqual({
			type: 'list',
			items: 'text',
			null_threshold: 0.5,
		});
		expect((body.fields as IDataObject).number).toMatchObject({ integer: false, decimals: 0 });
		expect((body.fields as IDataObject).text).not.toHaveProperty('integer');
	});
	test('invalid form values fail before transport', () => {
		for (const overrides of [
			{ context: ' ' },
			{ context: 'x'.repeat(65537) },
			{ referenceDate: '2026-02-30' },
			{ referenceDate: 'tomorrow' },
			{ extractFields: { entries: [] } },
			...[
				{ name: '9bad', type: 'text' },
				{ name: 'ok', type: 'estimate' },
				{ name: 'ok', type: 'text', nullThreshold: 0 },
				{ name: 'ok', type: 'text', instructions: 'x'.repeat(1001) },
				{ name: 'ok', type: 'number', numberOptions: { decimals: 7 } },
				{ name: 'ok', type: 'duration', numberOptions: { unit: 'USD' } },
			].map((row) => ({ extractFields: { entries: [row] } })),
			{
				extractFields: {
					entries: [
						{ name: 'same', type: 'text' },
						{ name: 'same', type: 'text' },
					],
				},
			},
			{
				extractFields: {
					entries: Array.from({ length: 65 }, (_, i) => ({ name: `f${i}`, type: 'text' })),
				},
			},
		])
			expect(() => request(overrides)).toThrow();
	});
	test('Advanced JSON keeps the complete native body and skips hidden form controls', () => {
		const input = {
			model: 'pea-pod-1',
			state: 'No items.',
			fields: { missing: { type: 'text' } },
			options: { include_quantiles: false },
		};
		expect(request({ inputMode: 'json', input }).body).toEqual(input);
	});
	test('routing preserves evidence, nulls, lists, zero, usage and metadata', async () => {
		const response = {
			model: 'pea-pod-1',
			truncated: false,
			answers: {
				missing: { type: 'text', value: null, guess: null, p_null: 1, confidence: 0 },
				count: { type: 'number', value: 0, guess: 0, p_null: 0.1, confidence: 0.8, span: [0, 1] },
				names: {
					type: 'list',
					value: ['A'],
					guess: ['A'],
					p_null: 0.1,
					confidence: 0.8,
					spans: [[2, 3]],
				},
			},
			usage: {
				state_tokens: 3,
				image_tokens: 0,
				schema_tokens: 3,
				input_tokens: 12,
				output_tokens: 0,
				passes: 3,
			},
			metadata: {
				base_checkpoint_sha256: '1'.repeat(64),
				parts: [{ name: 'pea-pod-1', sha256: '2'.repeat(64) }],
				render_version: 'extract_v1',
				calibrated: false,
				offsets: 'code_points',
			},
		};
		valid('extract', 'ExtractResponse', response);
		const fixture = execution(
			[{ resource: 'workflow', operation: 'extract', ...defaults }],
			async () => response,
			false,
			2,
		);
		expect((await fixture.run())[0][0]).toEqual({ json: response, pairedItem: { item: 0 } });
		expect(fixture.requests[0].url).toBe('https://api.itsvej.com/v1beta/extract');
		expect(fixture.requests[0].body).not.toHaveProperty('mode');
	});
	test('unavailable extraction remains an HTTP 503 error without retry or fallback', async () => {
		const fixture = execution(
			[{ resource: 'workflow', operation: 'extract', ...defaults }],
			async () => ({ statusCode: 503, body: { error: 'extract_unavailable' } }),
			false,
			2,
		);
		await expect(fixture.run()).rejects.toMatchObject({
			httpCode: '503',
			description: 'extract_unavailable',
		});
		expect(fixture.requests).toHaveLength(1);
	});
});

describe('request boundaries', () => {
	test('preserves false, null, zero, arrays and semantic option names', () => {
		const state = { allowed: false, owner: null, count: 0, rows: ['a', 'b'] };
		const body = buildRequest(
			'decision',
			'choice',
			params({
				stateFormat: 'json',
				stateJson: state,
				choices: { '0': 'Zero items', false: 'A false value' },
			}),
		).body;
		expect(body).toEqual({
			state,
			questions: {
				result: {
					type: 'choice',
					question: 'Is a review needed?',
					options: { '0': 'Zero items', false: 'A false value' },
				},
			},
		});
	});
	test('keeps Noul criteria and localized outcome descriptions', () => {
		const request = buildRequest(
			'decision',
			'noul',
			params({
				criteria: 'Use the policy.',
				trueDescription: 'Supported by the policy',
				falseDescription: 'Not supported by the policy',
			}),
		);
		expect((request.body as { questions: { result: object } }).questions.result).toMatchObject({
			criteria: 'Use the policy.',
			true_description: 'Supported by the policy',
			false_description: 'Not supported by the policy',
		});
	});
	test('encodes identifiers without allowing URL or query injection', () => {
		expect(
			buildRequest('feedback', 'delete', params({ recordId: 'entry/one?enabled=true#x' })).path,
		).toBe('/v1beta/feedback/entry%2Fone%3Fenabled%3Dtrue%23x');
		for (const recordId of ['', '.', '..'])
			expect(() => buildRequest('feedback', 'delete', params({ recordId }))).toThrow();
	});
	test('retention is an explicit boolean and never implicit in inference', () => {
		expect(
			buildRequest('retention', 'set', params({ retentionApi: 'states', retentionEnabled: false }))
				.body,
		).toEqual({ enabled: false });
		expect(() => buildRequest('retention', 'set', params({ retentionEnabled: 'false' }))).toThrow();
	});
	test('deletes only the expected conversation sequence', () => {
		expect(buildRequest('conversation', 'delete', params()).qs).toEqual({ expected_seq: 2 });
		for (const expectedSeq of [0, 1.2, '2', 2147483648])
			expect(() => buildRequest('conversation', 'delete', params({ expectedSeq }))).toThrow();
	});
	test('rejects malformed JSON, nonfinite numbers, invalid states and rubrics', () => {
		for (const value of ['{', undefined, { value: Infinity }, { value: NaN }])
			expect(() => jsonValue(value, 'Input')).toThrow();
		for (const stateJson of ['null', 'false', '42'])
			expect(() =>
				buildRequest('decision', 'noul', params({ stateFormat: 'json', stateJson })),
			).toThrow();
		for (const levels of [[], ['one'], ['same', 'same'], [false, true], ['a', ' ']])
			expect(() => buildRequest('decision', 'score', params({ levels }))).toThrow();
		expect(() =>
			buildRequest('decision', 'choice', params({ choices: { one: 'Only one' } })),
		).toThrow();
		expect(() => buildRequest('workflow', 'given', params({ input: '[]' }))).toThrow();
	});
	test('validates root URLs without altering custom deployment prefixes', () => {
		expect(serviceUrl('https://api.itsvej.com/')).toBe('https://api.itsvej.com');
		expect(serviceUrl('http://localhost:8080/proxy/')).toBe('http://localhost:8080/proxy');
		for (const url of [
			'no-url',
			'file:///tmp/x',
			'https://user:password@example.com',
			'https://api.itsvej.com/v1',
			'https://api.itsvej.com/v1beta/',
			'https://api.itsvej.com/?token=x',
			'https://api.itsvej.com/#x',
		])
			expect(() => serviceUrl(url)).toThrow();
	});
	test('checks conversation intent and sequence before sending', () => {
		expect(() =>
			buildRequest(
				'conversation',
				'query',
				params({ input: { operation: 'event', event: 'unexpected', expected_seq: 1 } }),
			),
		).toThrow();
		expect(() =>
			buildRequest(
				'conversation',
				'append',
				params({ input: { operation: 'event', expected_seq: 1 } }),
			),
		).toThrow();
		expect(() =>
			buildRequest(
				'conversation',
				'create',
				params({ input: { operation: 'create', history: '', expected_seq: 1 } }),
			),
		).toThrow();
	});
});

function execution(
	rows: Record<string, unknown>[],
	reply: (request: IHttpRequestOptions) => Promise<unknown>,
	continueOnFail = false,
	version = 1,
	tool = false,
) {
	const requests: IHttpRequestOptions[] = [];
	let index = 0;
	const context = {
		getItemIndex: () => index,
		getNodeParameter: (name: string, fallback?: unknown) => params(rows[index])(name, fallback),
		getNode: () => ({
			...node,
			typeVersion: version,
			type: tool ? 'n8n-nodes-vej.vejTool' : node.type,
		}),
		getCredentials: async () => ({
			baseUrl: 'https://api.itsvej.com/',
			apiKey: 'fake-unit-test-key',
		}),
	} as unknown as IExecuteSingleFunctions;
	// Exercise the hooks in isolation. Real routing, authentication, and error
	// continuation are covered by the Docker n8n integration fixture.
	return {
		requests,
		async run() {
			const output = [];
			for (index = 0; index < rows.length; index++) {
				try {
					const request = await prepareRequest.call(context, { url: '/' });
					requests.push(request);
					const value = await reply(request);
					const response =
						value && typeof value === 'object' && 'statusCode' in value
							? (value as { statusCode: number; body: IDataObject })
							: { statusCode: 200, body: value as IDataObject };
					output.push(...(await receiveResponse.call(context, [], { ...response, headers: {} })));
				} catch (error) {
					// Test harness must preserve the hook's original error for assertions.
					// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
					if (!continueOnFail) throw error;
					output.push({ json: { error: (error as Error).message }, pairedItem: { item: index } });
				}
			}
			return [output];
		},
	};
}

describe('declarative routing hooks', () => {
	test('each item evaluates its own fields and retains pairing and the full API response', async () => {
		const fixture = execution(
			[
				{ resource: 'decision', operation: 'noul', state: 'First' },
				{ resource: 'decision', operation: 'noul', state: 'Second' },
			],
			async (request) => ({
				answers: { result: { noul: 0.6 } },
				metadata: { calibration_status: 'unverified' },
				usage: { processed_tokens: 17 },
				observed_state: (request.body as { state: unknown }).state,
			}),
		);
		const [items] = await fixture.run();
		expect(items.map((item) => item.json.observed_state)).toEqual(['First', 'Second']);
		expect(items.map((item) => item.pairedItem)).toEqual([{ item: 0 }, { item: 1 }]);
		expect(items[0].json).toMatchObject({
			metadata: { calibration_status: 'unverified' },
			usage: { processed_tokens: 17 },
		});
	});
	test('does not convert an HTTP 200 unavailable effort result into success or fallback', async () => {
		const response = {
			results: { security: { status: 'unavailable', effort_used: null, reason: 'deferred' } },
			usage: { processed_tokens: 0 },
		};
		const fixture = execution(
			[
				{
					resource: 'workflow',
					operation: 'effort',
					input: {
						state: 'A change',
						questions: { security: { type: 'noul', statement: 'Needs review', effort: 'careful' } },
					},
				},
			],
			async () => response,
		);
		expect((await fixture.run())[0][0].json).toEqual(response);
		expect(fixture.requests).toHaveLength(1);
	});
	test('keeps API error status without retaining raw response details', async () => {
		const fixture = execution([{ resource: 'account', operation: 'me' }], async () => {
			return {
				statusCode: 429,
				body: { detail: 'Rate limit reached' },
				request: { headers: { Authorization: 'Bearer fake-unit-test-key' } },
			};
		});
		try {
			await fixture.run();
			throw new Error('Expected API failure');
		} catch (error) {
			expect(error).toBeInstanceOf(NodeApiError);
			expect((error as NodeApiError).httpCode).toBe('429');
			expect(JSON.stringify(error)).not.toContain('fake-unit-test-key');
		}
		expect(fixture.requests).toHaveLength(1);
	});
	test('invalid parameters fail before network access and continue-on-fail preserves pairing', async () => {
		const fixture = execution(
			[
				{ resource: 'decision', operation: 'score', levels: ['one'] },
				{ resource: 'account', operation: 'me' },
			],
			async () => ({ id: 'account' }),
			true,
		);
		const [items] = await fixture.run();
		expect(items[0].json.error).toContain('Rubric');
		expect(items[1]).toEqual({ json: { id: 'account' }, pairedItem: { item: 1 } });
		expect(fixture.requests).toHaveLength(1);
		const failing = execution(
			[{ resource: 'decision', operation: 'score', levels: ['one'] }],
			async () => ({}),
		);
		await expect(failing.run()).rejects.toBeInstanceOf(NodeOperationError);
	});
	test('preserves HTTP conflict detail while redacting an echoed credential', async () => {
		const fixture = execution([{ resource: 'account', operation: 'me' }], async () => {
			return {
				statusCode: 409,
				body: { detail: 'Expected sequence is stale; echoed fake-unit-test-key' },
			};
		});
		try {
			await fixture.run();
			throw new Error('Expected API failure');
		} catch (error) {
			expect(error).toBeInstanceOf(NodeApiError);
			expect((error as NodeApiError).httpCode).toBe('409');
			expect((error as NodeApiError).description).toContain('Expected sequence is stale');
			expect(JSON.stringify(error)).not.toContain('fake-unit-test-key');
		}
		expect(fixture.requests).toHaveLength(1);
	});
	test('uses declarative routing without a custom execute method', () => {
		const vej = new Vej();
		expect('execute' in vej).toBe(false);
		const routing = vej.description.properties.find(
			(property) => property.name === 'resource',
		)!.routing;
		expect(routing?.send?.preSend).toContain(prepareRequest);
		expect(routing?.output?.postReceive).toContain(receiveResponse);
	});
	test('simplified calibration outputs keep identifiers, status and binding within ten fields', async () => {
		const body = {
			model: 'pea',
			status: 'unverified',
			calibration: 'token',
			calibration_id: 'id',
			calibration_identity: 'identity',
			binding: { revision: 'one' },
			temperature: 1,
			threshold: null,
			metadata: { status: 'fixture' },
			usage: {},
			sample_size: 500,
			grid_reports: [],
		};
		const fixture = execution(
			[{ resource: 'calibration', operation: 'get', simplify: true }],
			async () => body,
			false,
			2,
		);
		const result = (await fixture.run())[0][0].json;
		expect(Object.keys(result)).toHaveLength(10);
		expect(result).toMatchObject({
			calibration_id: 'id',
			status: 'unverified',
			threshold: null,
			binding: body.binding,
		});
		expect(result).not.toHaveProperty('grid_reports');
	});
	test('tool selected output retains resource identifiers and preserves false and zero', async () => {
		const fixture = execution(
			[
				{
					resource: 'calibration',
					operation: 'get',
					output: 'selected',
					outputFields: ['threshold', 'status'],
				},
			],
			async () => ({
				calibration_id: 'id',
				calibration_identity: 'identity',
				threshold: 0,
				status: false,
				large_unused: 'omit',
			}),
			false,
			2,
			true,
		);
		expect((await fixture.run())[0][0].json).toEqual({
			calibration_id: 'id',
			calibration_identity: 'identity',
			threshold: 0,
			status: false,
		});
	});
	test('simplified risk preserves outcome identity, probability ordering, and drift warning', async () => {
		const body = {
			model: 'pea',
			candidate_keys: ['refund', 'replacement'],
			candidate_index: 1,
			decision: 'accept',
			probabilities: [0.1, 0.9],
			calibration_identity: 'id',
			target_error_rate: 0.1,
			upper_bound: 0.09,
			drift_warning: false,
			metadata: {},
			usage: {},
			sample_size: 500,
		};
		const fixture = execution(
			[
				{
					resource: 'workflow',
					operation: 'risk',
					simplify: true,
					...formDefaults(operations.find((op) => op.value === 'risk')!),
				},
			],
			async () => body,
			false,
			2,
		);
		const result = (await fixture.run())[0][0].json;
		expect(Object.keys(result)).toHaveLength(10);
		expect(result).toMatchObject({
			candidate_keys: body.candidate_keys,
			candidate_index: 1,
			probabilities: body.probabilities,
			drift_warning: false,
		});
	});
	test('feedback cleanup IDs survive simplified and selected tool outputs', async () => {
		const body = {
			model: 'pea',
			feedback_ids: ['event-1'],
			calibration_id: 'cal-1',
			calibration_identity: 'identity',
			status: 'unverified',
			binding: {},
			temperature: 1,
			threshold: null,
			metadata: {},
			usage: {},
			calibration: 'token',
			check_report: {},
		};
		for (const tool of [false, true]) {
			const fixture = execution(
				[
					{
						resource: 'calibration',
						operation: 'get',
						simplify: true,
						output: 'selected',
						outputFields: ['status'],
					},
				],
				async () => body,
				false,
				2,
				tool,
			);
			const result = (await fixture.run())[0][0].json;
			expect(result.feedback_ids).toEqual(['event-1']);
			expect(result.calibration_id).toBe('cal-1');
			if (!tool) expect(Object.keys(result)).toHaveLength(10);
		}
	});
	test('n8n shows Simplify for normal nodes and Output controls for tools, only on version 2', () => {
		const description = new Vej().description;
		const values = { resource: 'calibration', operation: 'get' };
		for (const tool of [false, true]) {
			const context = { ...description, name: tool ? 'vejTool' : 'vej' };
			for (const name of ['simplify', 'output']) {
				const property = description.properties.find((item) => item.name === name)!;
				expect(NodeHelpers.displayParameter(values, property, { typeVersion: 2 }, context)).toBe(
					name === (tool ? 'output' : 'simplify'),
				);
				expect(NodeHelpers.displayParameter(values, property, { typeVersion: 1 }, context)).toBe(
					false,
				);
			}
		}
	});
	test('version 2 confirms deletion while version 1 keeps its empty response', async () => {
		for (const version of [1, 2]) {
			const fixture = execution(
				[{ resource: 'conversation', operation: 'delete' }],
				async () => ({ statusCode: 204, body: '' }),
				false,
				version,
			);
			expect((await fixture.run())[0][0].json).toEqual(version === 2 ? { deleted: true } : {});
		}
	});
	test('credential URL failures have the item context and send no request', async () => {
		const context = {
			getNode: () => node,
			getItemIndex: () => 3,
			getCredentials: async () => ({ baseUrl: 'https://example.com/v1' }),
		} as unknown as IExecuteSingleFunctions;
		await expect(prepareRequest.call(context, { url: '/' })).rejects.toBeInstanceOf(
			NodeOperationError,
		);
	});
	test('credentials use encrypted n8n storage and Bearer authentication', () => {
		const credential = new VejApi();
		expect(
			credential.properties.find((property) => property.name === 'apiKey')?.typeOptions?.password,
		).toBe(true);
		expect(credential.authenticate.type).toBe('generic');
		expect(credential.authenticate.properties.headers?.Authorization).toContain('Bearer ');
	});
});
