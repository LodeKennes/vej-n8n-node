import type { IDataObject, IHttpRequestOptions } from 'n8n-workflow';
import { operations, retentionApis } from './operations';

type GetParameter = (name: string, fallback?: unknown) => unknown;

export function jsonValue(value: unknown, name: string): unknown {
	let parsed: unknown;
	try {
		parsed = typeof value === 'string' ? JSON.parse(value) : value;
		JSON.stringify(parsed, (_key, item: unknown) => {
			if (typeof item === 'number' && !Number.isFinite(item)) throw new Error();
			if (item === undefined || typeof item === 'function' || typeof item === 'bigint')
				throw new Error();
			return item;
		});
	} catch {
		// Pure validation: execute() wraps this with the node and item index.
		// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
		throw new Error(`${name} must contain valid JSON with finite numbers.`);
	}
	return parsed;
}

function objectValue(value: unknown, name: string): IDataObject {
	const parsed = jsonValue(value, name);
	if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error(`${name} must be a JSON object.`);
	}
	return parsed as IDataObject;
}

export function serviceUrl(value: unknown): string {
	if (typeof value !== 'string') throw new Error('Set the API URL in your Vej credentials.');
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		// Pure validation: execute() adds the n8n execution context.
		// eslint-disable-next-line @n8n/community-nodes/require-node-api-error
		throw new Error('API URL must be an absolute HTTP or HTTPS service root.');
	}
	if (
		!['http:', 'https:'].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw new Error(
			'API URL must use HTTP or HTTPS without embedded credentials, query, or fragment.',
		);
	}
	if (/\/v1(?:beta)?\/?$/.test(url.pathname)) {
		throw new Error('Use the service root in API URL, without /v1 or /v1beta.');
	}
	return url.toString().replace(/\/+$/, '');
}

export function buildRequest(
	resource: string,
	operation: string,
	get: GetParameter,
): Omit<IHttpRequestOptions, 'url'> & { path: string } {
	const spec = operations.find((item) => item.resource === resource && item.value === operation);
	if (!spec) throw new Error('Select a supported Vej resource and operation.');
	let path = spec.path;
	let body: IDataObject | undefined;
	let qs: IDataObject | undefined;
	if (path.includes('{id}')) {
		const id = get('recordId');
		if (typeof id !== 'string' || !id.trim() || ['.', '..'].includes(id)) {
			throw new Error('ID must be a nonempty resource identifier.');
		}
		path = path.replace('{id}', encodeURIComponent(id));
	}
	if (resource === 'decision' && operation !== 'predict') {
		const format = get('stateFormat', 'text');
		const state = format === 'json' ? jsonValue(get('stateJson'), 'State') : get('state');
		if (state === null || !['string', 'object'].includes(typeof state)) {
			throw new Error('State must be text, a JSON object, or an array.');
		}
		const id = get('questionId', 'result');
		if (typeof id !== 'string' || !id.trim()) throw new Error('Question ID is required.');
		const prompt = get('question');
		if (typeof prompt !== 'string' || !prompt.trim())
			throw new Error('Question or statement is required.');
		let question: IDataObject;
		if (operation === 'choice') {
			const options = objectValue(get('choices'), 'Outcomes');
			if (
				Object.keys(options).length < 2 ||
				Object.keys(options).length > 255 ||
				Object.entries(options).some(
					([key, value]) => !key.trim() || typeof value !== 'string' || !value.trim(),
				)
			) {
				throw new Error(
					'Outcomes must contain 2–255 nonempty names mapped to nonempty descriptions.',
				);
			}
			question = { type: 'choice', question: prompt, options };
		} else if (operation === 'score') {
			const levels = jsonValue(get('levels'), 'Rubric levels');
			if (
				!Array.isArray(levels) ||
				levels.length < 2 ||
				levels.length > 10 ||
				levels.some((level) => typeof level !== 'string' || !level.trim()) ||
				new Set(levels).size !== levels.length
			) {
				throw new Error(
					'Rubric levels must be 2–10 distinct nonempty descriptions in caller order.',
				);
			}
			question = { type: 'score', question: prompt, levels };
		} else {
			question = { type: 'noul', statement: prompt };
			for (const [field, parameter] of [
				['criteria', 'criteria'],
				['true_description', 'trueDescription'],
				['false_description', 'falseDescription'],
			]) {
				const value = get(parameter, '');
				if (typeof value === 'string' && value) question[field] = value;
			}
		}
		body = { state, questions: { [id]: question } };
	} else if (spec.preset) {
		const input = objectValue(get('input'), 'Input');
		if (spec.mode === 'states') {
			const expected = operation === 'create' ? 'create' : 'event';
			if (input.operation !== expected)
				throw new Error(`Input operation must be "${expected}" for this conversation action.`);
			if (operation === 'query' && input.event != null)
				throw new Error(
					'Query a Conversation must omit event. Use Append a Message to append history.',
				);
			if (operation === 'append' && (typeof input.event !== 'string' || !input.event.length))
				throw new Error('Append a Message requires a nonempty event.');
			const seq = input.expected_seq;
			if (
				typeof seq !== 'number' ||
				!Number.isInteger(seq) ||
				seq < (expected === 'create' ? 0 : 1) ||
				seq > 2147483646 ||
				(expected === 'create' && seq !== 0)
			)
				throw new Error(
					'Use expected_seq 0 to create, or the returned sequence (1–2147483646) for events.',
				);
		}
		if (operation === 'readToken' || operation === 'deleteToken') {
			input.action = operation === 'readToken' ? 'read' : 'delete';
		}
		body = spec.mode ? { mode: spec.mode, input } : input;
	} else if (resource === 'retention') {
		const api = get('retentionApi', 'states');
		if (typeof api !== 'string' || !retentionApis.includes(api))
			throw new Error('Select a supported retention API.');
		path = path.replace('{api}', api);
		if (operation === 'set') {
			const enabled = get('retentionEnabled', false);
			if (typeof enabled !== 'boolean') throw new Error('Retention enabled must be a boolean.');
			body = { enabled };
		}
	} else if (resource === 'account' && operation === 'usage') {
		const period = get('period', '30d');
		const model = get('usageModel', '');
		if (
			!['7d', '30d', '90d'].includes(String(period)) ||
			!['', 'pea', 'pepper', 'pumpkin'].includes(String(model))
		)
			throw new Error('Select a supported usage period and model.');
		qs = { period: String(period), ...(model ? { model: String(model) } : {}) };
	}
	if (resource === 'conversation' && operation === 'delete') {
		const seq = get('expectedSeq');
		if (typeof seq !== 'number' || !Number.isInteger(seq) || seq < 1 || seq > 2147483647)
			throw new Error('Expected sequence must be an integer from 1 to 2147483647.');
		qs = { expected_seq: seq };
	}
	const timeout = get('timeout', 60000);
	if (
		typeof timeout !== 'number' ||
		!Number.isInteger(timeout) ||
		timeout < 1000 ||
		timeout > 600000
	)
		throw new Error('Timeout must be 1000–600000 milliseconds.');
	return {
		method: spec.method,
		path,
		...(body ? { body } : {}),
		...(qs ? { qs } : {}),
		json: true,
		timeout,
		disableFollowRedirect: true,
	};
}
