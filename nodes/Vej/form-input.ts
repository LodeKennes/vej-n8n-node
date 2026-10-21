import type { IDataObject } from 'n8n-workflow';
import { operations } from './operations';
import { jsonValue } from './request';

type GetParameter = (name: string, fallback?: unknown) => unknown;

function object(value: unknown, label: string): IDataObject {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`${label} must be a field collection.`);
	return value as IDataObject;
}
function entries(value: unknown, label: string, min = 0, max = 6000): IDataObject[] {
	const collection = object(value ?? {}, label);
	const rows = collection.entries ?? [];
	if (!Array.isArray(rows) || rows.length < min || rows.length > max)
		throw new Error(`${label} needs ${min}–${max} rows.`);
	return rows.map((row) => object(row, label));
}
function text(value: unknown, label: string, empty = false): string {
	if (typeof value !== 'string' || (!empty && !value.trim()))
		throw new Error(`${label} is required.`);
	return value;
}
function number(value: unknown, label: string): number {
	if (typeof value !== 'number' || !Number.isFinite(value))
		throw new Error(`${label} must be a finite number.`);
	return value;
}
function boolean(value: unknown, label: string): boolean {
	if (typeof value !== 'boolean') throw new Error(`${label} must be enabled or disabled.`);
	return value;
}
function map(values: [string, unknown][], label: string): IDataObject {
	if (new Set(values.map(([key]) => key)).size !== values.length)
		throw new Error(`${label} contains duplicate names. Give each row a unique name.`);
	return Object.fromEntries(values) as IDataObject;
}
function digest(value: unknown, label: string): string {
	if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
		throw new Error(
			`${label} must contain the 64-character lowercase SHA256 from your own data or fit result.`,
		);
	return value;
}
function outcomeMap(value: unknown): IDataObject {
	return map(
		entries(value, 'Outcomes', 2, 255).map((row) => [
			text(row.name, 'Outcome name'),
			text(row.description, 'Outcome description'),
		]),
		'Outcomes',
	);
}
function levelList(value: unknown): string[] {
	const levels = entries(value, 'Rubric levels', 2, 10).map((row) =>
		text(row.description, 'Level description'),
	);
	if (new Set(levels).size !== levels.length)
		throw new Error('Rubric levels must have distinct descriptions.');
	return levels;
}

export function questionMap(
	value: unknown,
	{ optional = false, score = true, effort = false } = {},
): IDataObject {
	const groups = object(value ?? {}, 'Questions');
	const result: [string, IDataObject][] = [];
	for (const [type, rows] of Object.entries(groups)) {
		if (!['choice', 'noul', ...(score ? ['score'] : [])].includes(type) || !Array.isArray(rows))
			throw new Error('Choose a supported question type.');
		for (const item of rows) {
			const row = object(item, 'Question');
			const id = text(row.id, 'Question ID');
			const prompt = text(row.prompt, 'Question or statement');
			const question: IDataObject =
				type === 'choice'
					? { type, question: prompt, options: outcomeMap(row.outcomeRows) }
					: type === 'score'
						? { type, question: prompt, levels: levelList(row.levelRows) }
						: { type, statement: prompt };
			if (type === 'noul') {
				for (const [field, name] of [
					['criteria', 'criteria'],
					['true_description', 'trueDescription'],
					['false_description', 'falseDescription'],
				]) {
					if (row[name] !== undefined && row[name] !== '') question[field] = text(row[name], name);
				}
			}
			if (effort) {
				const requested = row.effort ?? 'standard';
				if (!['standard', 'fast', 'careful'].includes(String(requested)))
					throw new Error('Choose standard, fast, or careful effort.');
				question.effort = requested;
			}
			result.push([id, question]);
		}
	}
	if (result.length < (optional ? 0 : 1) || result.length > 128)
		throw new Error('Add 1–128 questions, each with a unique ID.');
	return map(result, 'Questions');
}
function singleQuestion(value: unknown, label: string): IDataObject {
	const questions = Object.values(questionMap(value, { score: false }));
	if (questions.length !== 1)
		throw new Error(`${label} must contain exactly one Choice or Noul question.`);
	return questions[0] as IDataObject;
}

function typedMap(value: unknown, label: string): IDataObject {
	return map(
		entries(value, label, 0, 128).map((row) => {
			const key = text(row.key, `${label} name`);
			let value: unknown;
			switch (row.valueType) {
				case 'text':
					value = text(row.textValue, key, true);
					break;
				case 'number':
					value = number(row.numberValue, key);
					break;
				case 'boolean':
					value = boolean(row.booleanValue, key);
					break;
				case 'null':
					value = null;
					break;
				case 'mapped':
					value = jsonValue(row.mappedValue, key);
					break;
				default:
					throw new Error(`Choose a value type for ${key}.`);
			}
			return [key, value];
		}),
		label,
	);
}
function binding(value: unknown): IDataObject {
	const row = object(value, 'Calibration binding');
	const parts = Object.fromEntries(
		[
			['ranking_head', row.rankingHead],
			['ranking_temperature', row.rankingTemperature],
		]
			.filter(([, value]) => value !== undefined && value !== '')
			.map(([key, value]) => [key, digest(value, String(key))]),
	);
	return {
		base_checkpoint_sha256: digest(row.checkpoint, 'Checkpoint SHA256'),
		population_sha256: digest(row.population, 'Population SHA256'),
		runtime_sha256: digest(row.runtime, 'Runtime SHA256'),
		parts,
	};
}
function cohort(value: unknown, label: string): IDataObject[] {
	return entries(value, label, 1, 2000).map((row) => {
		const questions = questionMap(row.questions, { score: false });
		if (Object.keys(questions).length !== 1)
			throw new Error(`${label}: each labeled request requires exactly one question.`);
		const question = Object.values(questions)[0] as IDataObject;
		const keys =
			question.type === 'choice' ? Object.keys(question.options as IDataObject) : ['true', 'false'];
		const target = keys.indexOf(text(row.targetOutcome, 'Reviewed outcome key'));
		if (target < 0)
			throw new Error(`${label}: reviewed outcome key must identify an offered outcome.`);
		return {
			group_sha256: digest(row.group, 'Independent group SHA256'),
			target,
			request: { state: text(row.state, 'Labeled request state'), questions },
		};
	});
}
const stringList = (value: unknown, label: string) =>
	entries(value, label, 0, 32).map((row) => text(row.value, label));

/** Adapt native n8n form controls to the unchanged API contract. V1 remains JSON-based. */
export function formValues(
	resource: string,
	operation: string,
	get: GetParameter,
): Record<string, unknown> {
	if (resource === 'decision' && operation === 'choice')
		return { choices: outcomeMap(get('outcomeRows')) };
	if (resource === 'decision' && operation === 'score')
		return { levels: levelList(get('levelRows')) };
	const spec = operations.find((item) => item.resource === resource && item.value === operation);
	if (!spec?.preset || get('inputMode', 'form') === 'json') return {};
	const state = () => text(get('context'), 'State');
	const questions = (optional = false, score = true, effort = false) =>
		questionMap(get('questionBuilder'), { optional, score, effort });
	let input: IDataObject;
	if (resource === 'decision') input = { state: state(), questions: questions() };
	else if (operation === 'extract') {
		const context = state();
		if (Array.from(context).length > 65536)
			throw new Error('Extraction state must contain at most 65536 code points.');
		const referenceDate = text(get('referenceDate', ''), 'Reference date', true);
		if (
			referenceDate &&
			(!/^\d{4}-\d{2}-\d{2}$/.test(referenceDate) ||
				!Number.isFinite(Date.parse(referenceDate)) ||
				new Date(referenceDate).toISOString().slice(0, 10) !== referenceDate)
		)
			throw new Error('Reference date must be a real calendar date in YYYY-MM-DD format.');
		input = {
			model: 'clairic',
			state: context,
			...(referenceDate ? { reference_date: referenceDate } : {}),
			fields: map(
				entries(get('extractFields'), 'Extraction fields', 1, 64).map((row) => {
					const name = text(row.name, 'Field name');
					if (!/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(name))
						throw new Error(
							'Field names must start with a letter or underscore and contain at most 64 letters, digits, underscores, dots, or hyphens.',
						);
					const type = text(row.type, 'Field type');
					if (!['text', 'number', 'date', 'time', 'datetime', 'duration', 'list'].includes(type))
						throw new Error('Choose a supported extraction field type.');
					const instructions = text(row.instructions ?? '', 'Instructions', true);
					if (Array.from(instructions).length > 1000)
						throw new Error('Instructions must contain at most 1000 code points.');
					const threshold = number(row.nullThreshold ?? 0.5, 'Null threshold');
					if (threshold <= 0 || threshold > 1)
						throw new Error('Null threshold must be greater than zero and at most one.');
					const field: IDataObject = {
						type,
						null_threshold: threshold,
						...(instructions ? { instructions } : {}),
						...(type === 'list' ? { items: 'text' } : {}),
					};
					if (type === 'number' || type === 'duration') {
						const options = object(row.numberOptions ?? {}, 'Number options');
						if (options.unit !== undefined) {
							const unit = text(options.unit, 'Unit');
							if (
								Array.from(unit).length > 32 ||
								(type === 'duration' &&
									!['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'].includes(
										unit,
									))
							)
								throw new Error(
									'Use a unit of at most 32 code points, or a supported duration unit.',
								);
							field.unit = unit;
						}
						if (options.integer !== undefined) field.integer = boolean(options.integer, 'Integer');
						if (options.decimals !== undefined) {
							const decimals = number(options.decimals, 'Decimals');
							if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6)
								throw new Error('Decimals must be an integer from zero to six.');
							field.decimals = decimals;
						}
					}
					return [name, field];
				}),
				'Extraction fields',
			),
			options: { return_state_text: boolean(get('returnStateText', false), 'Return state text') },
		};
	} else if (operation === 'risk') {
		const query = questions(false, false);
		if (Object.keys(query).length !== 1)
			throw new Error('Target Error Rate requires exactly one Choice or Noul question.');
		const source = get('calibrationSource', 'token');
		if (!['token', 'stored'].includes(String(source)))
			throw new Error('Choose a calibration token or stored calibration.');
		input = {
			request: { state: state(), questions: query },
			binding: binding(get('binding')),
			...(source === 'stored'
				? { calibration_id: text(get('calibrationId'), 'Calibration ID') }
				: { calibration: text(get('calibrationToken'), 'Calibration token') }),
		};
	} else if (operation === 'alignments')
		input = {
			question: text(get('claim'), 'Claim to check'),
			sources: entries(get('sources'), 'Sources', 0, 16).map((row) => ({
				id: text(row.id, 'Source ID'),
				text: text(row.text, 'Source text', true),
			})),
		};
	else if (operation === 'estimate')
		input = {
			state: state(),
			questions: map(
				entries(get('estimates'), 'Estimates', 1, 128).map((row) => {
					const values = entries(row.values, 'Value bins', 2, 10).map((value) =>
						number(value.value, 'Value bin'),
					);
					if (
						values.some((value, i) => Math.abs(value) > 1e12 || (i > 0 && value <= values[i - 1]))
					)
						throw new Error('Value bins must be strictly increasing and within ±1e12.');
					return [
						text(row.id, 'Estimate question ID'),
						{
							type: 'estimate',
							question: text(row.question, 'Estimate question'),
							unit: text(row.unit, 'Unit'),
							values,
						},
					];
				}),
				'Estimates',
			),
		};
	else if (operation === 'annotate') {
		const document = text(get('document'), 'Document');
		const mode = get('segmentation', 'line');
		if (!['line', 'paragraph', 'word', 'custom'].includes(String(mode)))
			throw new Error('Choose line, paragraph, word, or custom document segments.');
		input = {
			document,
			questions: questions(),
			...(mode === 'custom'
				? {
						segments: entries(get('segments'), 'Segments', 1, 128).map((row) => {
							const start = number(row.start, 'Start offset');
							const end = number(row.end, 'End offset');
							if (
								!Number.isInteger(start) ||
								!Number.isInteger(end) ||
								start < 0 ||
								start >= end ||
								end > Array.from(document).length
							)
								throw new Error(
									'Segment offsets must be integer Unicode code-point offsets within the document, with start before end.',
								);
							return {
								id: text(row.id, 'Segment ID'),
								start,
								end,
								...(row.label ? { label: text(row.label, 'Segment label') } : {}),
							};
						}),
					}
				: { segment: String(mode) }),
		};
	} else if (operation === 'given') {
		const kind = get('conditionType', 'choice');
		if (!['choice', 'true', 'false'].includes(String(kind)))
			throw new Error('Choose an assumed Choice outcome, true, or false.');
		input = {
			state: state(),
			first: singleQuestion(get('firstQuestion'), 'First question'),
			first_outcome: text(get('firstOutcome'), 'First outcome'),
			condition: kind === 'choice' ? text(get('condition'), 'Assumed choice') : kind === 'true',
			conditional: singleQuestion(get('conditionalQuestion'), 'Conditional question'),
		};
	} else if (operation === 'bind')
		input = {
			state: state(),
			question: text(get('formQuestion'), 'Question'),
			records: entries(get('records'), 'Records', 1, 254).map((row) => ({
				id: text(row.id, 'Record ID'),
				name: text(row.name, 'Record name'),
				description: text(row.description, 'Record description'),
				fields: typedMap(row.fields, 'Record fields'),
			})),
		};
	else if (operation === 'rankings') {
		const candidates = entries(get('candidates'), 'Candidates', 2, 32).map((row) => ({
			id: text(row.id, 'Candidate ID'),
			name: text(row.name, 'Candidate name'),
			description: text(row.description, 'Candidate description'),
		}));
		const top = number(get('topK'), 'Top group size');
		if (!Number.isInteger(top) || top < 1 || top > candidates.length)
			throw new Error('Top group size must be an integer from 1 to the candidate count.');
		if (new Set(candidates.map((row) => row.id)).size !== candidates.length)
			throw new Error('Candidate IDs must be unique.');
		input = {
			state: state(),
			question: text(get('formQuestion'), 'Question'),
			candidates,
			top_k: top,
		};
	} else if (operation === 'effort')
		input = { state: state(), questions: questions(false, true, true) };
	else if (resource === 'conversation')
		input = {
			operation: operation === 'create' ? 'create' : 'event',
			expected_seq: operation === 'create' ? 0 : number(get('eventSequence'), 'Expected sequence'),
			...(operation === 'create'
				? { history: text(get('history'), 'Initial history', true) }
				: operation === 'append'
					? { event: text(get('event'), 'New message') }
					: {}),
			questions: questions(true),
		};
	else if (resource === 'calibration' && operation === 'fit')
		input = {
			binding: { population_sha256: digest(get('population'), 'Population SHA256') },
			target_error_rate: number(get('targetError'), 'Target error rate'),
			persist: boolean(get('persist', false), 'Persist calibration'),
			temperature_fit: cohort(get('temperatureFit'), 'Temperature-fit requests'),
			risk_fit: cohort(get('riskFit'), 'Risk-fit requests'),
		};
	else if (resource === 'calibration')
		input = {
			binding: binding(get('binding')),
			calibration: text(get('calibrationToken'), 'Calibration token'),
		};
	else if (resource === 'feedback')
		input = {
			binding: binding(get('binding')),
			target_error_rate: number(get('targetError'), 'Target error rate'),
			persist: boolean(get('persist', false), 'Persist feedback'),
			events: entries(get('feedbackEvents'), 'Reviewed events', 2, 6000).map((row) => {
				const outcomes = entries(row.outcomes, 'Outcome identities', 2, 255).map((outcome) => ({
					key: text(outcome.key, 'Outcome key'),
					candidate_sha256: digest(outcome.digest, 'Candidate SHA256'),
				}));
				const logits = entries(row.logits, 'Original native logits', 2, 255).map((logit) =>
					number(logit.value, 'Logit'),
				);
				const key = text(row.outcomeKey, 'Reviewed outcome key');
				if (logits.length !== outcomes.length || !outcomes.some((outcome) => outcome.key === key))
					throw new Error(
						'Reviewed outcomes and logits must have the same count and include the reviewed outcome key.',
					);
				if (!['temperature-fit', 'risk-fit', 'check'].includes(String(row.role)))
					throw new Error('Choose a valid reviewed-event split role.');
				return {
					event_id: text(row.eventId, 'Event ID'),
					group_sha256: digest(row.group, 'Independent group SHA256'),
					role: row.role,
					outcomes,
					logits,
					outcome_key: key,
				};
			}),
		};
	else if (operation === 'flows')
		input = {
			state: state(),
			steps: entries(get('steps'), 'Checks', 1, 32).map((row) => ({
				id: text(row.id, 'Step ID'),
				question: singleQuestion(row.questions, 'Step question'),
				depends_on: stringList(row.dependsOn, 'Dependencies'),
				requires: stringList(row.requires, 'Required inputs'),
				...(row.whenStep || row.whenOutcome
					? {
							when: {
								step: text(row.whenStep, 'Condition step'),
								outcome: text(row.whenOutcome, 'Condition outcome'),
							},
						}
					: {}),
			})),
			inputs: typedMap(get('flowInputs'), 'Supplied inputs'),
			recompute: boolean(get('recompute', false), 'Recompute'),
			previous_results: entries(get('previousResults'), 'Previous results', 0, 32).map((row) => ({
				step_id: text(row.stepId, 'Previous step ID'),
				flow_sha256: digest(row.flowDigest, 'Flow SHA256'),
				content_sha256: digest(row.contentDigest, 'Content SHA256'),
				outcome: text(row.outcome, 'Previous outcome'),
				provenance: text(row.provenance, 'Provenance'),
				probabilities: map(
					entries(row.probabilities, 'Probabilities', 1, 255).map((item) => {
						const value = number(item.probability, 'Probability');
						if (value < 0 || value > 1) throw new Error('Probabilities must be within 0–1.');
						return [text(item.key, 'Outcome name'), value];
					}),
					'Probabilities',
				),
			})),
		};
	else if (resource === 'batch')
		input = {
			endpoint: text(get('batchEndpoint'), 'Batch endpoint'),
			shards: entries(get('shards'), 'Storage shards', 1, 1000).map((row) => ({
				input_url: text(row.input_url, 'Pre-signed input URL'),
				output_url: text(row.output_url, 'Pre-signed output URL'),
			})),
		};
	else throw new Error('No form is available for this operation.');
	if (
		input.target_error_rate !== undefined &&
		(Number(input.target_error_rate) <= 0 || Number(input.target_error_rate) >= 1)
	)
		throw new Error('Target error rate must be greater than zero and less than one.');
	return { input };
}
