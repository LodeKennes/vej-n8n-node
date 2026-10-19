/* eslint-disable @n8n/community-nodes/no-restricted-imports -- Bun test tooling is not shipped or executed inside n8n. */
import { describe, expect, test } from 'bun:test';
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { IExecuteFunctions, INode, IHttpRequestOptions } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { Vej } from '../nodes/Vej/Vej.node';
import { VejApi } from '../credentials/VejApi.credentials';
import { operations, presetFor, resources } from '../nodes/Vej/operations';
import { buildRequest, jsonValue, serviceUrl } from '../nodes/Vej/request';
import ga from './contracts/ga.json';
import beta from './contracts/beta.json';

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

function valid(document: 'ga' | 'beta', name: string, value: unknown) {
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
) {
	const requests: IHttpRequestOptions[] = [];
	const context = {
		getInputData: () => rows.map(() => ({ json: {} })),
		getNodeParameter: (name: string, index: number, fallback?: unknown) =>
			params(rows[index])(name, fallback),
		getNode: () => node,
		getCredentials: async () => ({
			baseUrl: 'https://api.itsvej.com/',
			apiKey: 'fake-unit-test-key',
		}),
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequestWithAuthentication: async (credential: string, request: IHttpRequestOptions) => {
				expect(credential).toBe('vejApi');
				requests.push(request);
				return await reply(request);
			},
		},
	} as unknown as IExecuteFunctions;
	return { run: () => new Vej().execute.call(context), requests };
}

describe('n8n execution contract', () => {
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
	test('keeps API error status, does not retry, and does not leak transport headers', async () => {
		const fixture = execution([{ resource: 'account', operation: 'me' }], async () => {
			throw {
				statusCode: 429,
				response: { body: { detail: 'Rate limit reached' } },
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
	test('preserves real n8n helper errors while discarding their causes and redacting the key', async () => {
		const fixture = execution([{ resource: 'account', operation: 'me' }], async () => {
			throw new NodeApiError(
				node,
				{ request: { headers: { Authorization: 'Bearer fake-unit-test-key' } } },
				{ httpCode: '409', description: 'Expected sequence is stale; echoed fake-unit-test-key' },
			);
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
	test('credentials use encrypted n8n storage and Bearer authentication', () => {
		const credential = new VejApi();
		expect(
			credential.properties.find((property) => property.name === 'apiKey')?.typeOptions?.password,
		).toBe(true);
		expect(credential.authenticate.type).toBe('generic');
		expect(credential.authenticate.properties.headers?.Authorization).toContain('Bearer ');
	});
});
