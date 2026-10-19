import type { IDataObject, INodeProperties, INodeParameters } from 'n8n-workflow';
import { operations, presetFor, type Operation } from './operations';

const text = (
	name: string,
	displayName: string,
	value = '',
	description = '',
	rows = 1,
): INodeProperties => ({
	name,
	displayName,
	type: 'string',
	default: value,
	description,
	...(rows > 1 ? { typeOptions: { rows } } : {}),
});
const number = (name: string, displayName: string, value = 0): INodeProperties => ({
	name,
	displayName,
	type: 'number',
	default: value,
});
const flag = (name: string, displayName: string, description = ''): INodeProperties => ({
	displayName,
	name,
	type: 'boolean',
	default: false,
	description,
});
const select = (
	name: string,
	displayName: string,
	values: string[],
	value = values[0],
): INodeProperties => ({
	name,
	displayName,
	type: 'options',
	options: values.map((item) => ({ name: item, value: item })),
	default: value,
});

export function rows(
	name: string,
	displayName: string,
	fields: INodeProperties[],
	button: string,
	entries: object[] = [],
): INodeProperties {
	const defaults = (entries.length ? { entries } : {}) as INodeParameters;
	return {
		displayName,
		name,
		type: 'fixedCollection',
		default: { ...defaults },
		typeOptions: { multipleValues: true },
		placeholder: button,
		options: [{ name: 'entries', displayName, values: fields }],
	};
}
const strings = (name: string, label: string, values: string[] = []) =>
	rows(
		name,
		label,
		[text('value', 'Value')],
		'Add Value',
		values.map((value) => ({ value })),
	);
const numbers = (name: string, label: string, values: number[] = []) =>
	rows(
		name,
		label,
		[number('value', 'Value')],
		'Add Value',
		values.map((value) => ({ value })),
	);
const outcomes = (options: Record<string, string> = {}) =>
	rows(
		'outcomeRows',
		'Outcomes',
		[
			text('name', 'Name', '', 'A semantic outcome name, such as refund'),
			text('description', 'Description', '', '', 2),
		],
		'Add Outcome',
		Object.entries(options).map(([name, description]) => ({ name, description })),
	);
const levels = (values: string[] = []) =>
	rows(
		'levelRows',
		'Rubric Levels',
		[text('description', 'Description', '', '', 2)],
		'Add Level',
		values.map((description) => ({ description })),
	);

export function questionDefaults(questions: Record<string, IDataObject>): IDataObject {
	const entries = Object.entries(questions).map(([id, question]) => {
		const {
			type,
			question: prompt,
			statement,
			options,
			levels: rubric,
			criteria,
			true_description,
			false_description,
			effort,
		} = question;
		return [
			String(type),
			{
				id,
				prompt: prompt ?? statement,
				...(options ? { outcomeRows: outcomes(options as Record<string, string>).default } : {}),
				...(rubric ? { levelRows: levels(rubric as string[]).default } : {}),
				...(criteria ? { criteria } : {}),
				...(true_description ? { trueDescription: true_description } : {}),
				...(false_description ? { falseDescription: false_description } : {}),
				...(effort ? { effort } : {}),
			},
		] as const;
	});
	return Object.fromEntries(
		['choice', 'noul', 'score']
			.map((type) => [type, entries.filter(([kind]) => kind === type).map(([, value]) => value)])
			.filter(([, value]) => (value as unknown[]).length),
	) as IDataObject;
}

function questions(
	name = 'questionBuilder',
	label = 'Questions',
	defaults: Record<string, IDataObject> = {},
	score = true,
	effort = false,
): INodeProperties {
	const identity = [
		text('id', 'Question ID', 'result'),
		text('prompt', 'Question or Statement', '', '', 3),
	];
	const effortField = effort ? [select('effort', 'Effort', ['standard', 'fast', 'careful'])] : [];
	const defaultQuestions = questionDefaults(defaults) as INodeParameters;
	return {
		displayName: label,
		name,
		type: 'fixedCollection',
		default: { ...defaultQuestions },
		typeOptions: { multipleValues: true },
		placeholder: 'Add Question',
		options: [
			{
				name: 'choice',
				displayName: 'Choice',
				values: [
					...identity,
					outcomes({ yes: 'The statement applies', no: 'The statement does not apply' }),
					...effortField,
				],
			},
			{
				name: 'noul',
				displayName: 'Statement (Noul)',
				values: [
					...identity,
					text('criteria', 'Criteria'),
					text('trueDescription', 'True Description'),
					text('falseDescription', 'False Description'),
					...effortField,
				],
			},
			...(score
				? [
						{
							name: 'score',
							displayName: 'Score',
							values: [...identity, levels(['Low', 'High']), ...effortField],
						},
					]
				: []),
		],
	};
}

function typedFields(
	name: string,
	label: string,
	defaults: Record<string, unknown> = {},
): INodeProperties {
	return rows(
		name,
		label,
		[
			text('key', 'Name'),
			select('valueType', 'Value Type', ['text', 'number', 'boolean', 'null', 'mapped']),
			{
				...text('textValue', 'Text', '', '', 3),
				displayOptions: { show: { valueType: ['text'] } },
			},
			{ ...number('numberValue', 'Number'), displayOptions: { show: { valueType: ['number'] } } },
			{ ...flag('booleanValue', 'Boolean'), displayOptions: { show: { valueType: ['boolean'] } } },
			{
				displayName: 'Mapped Value',
				name: 'mappedValue',
				type: 'json',
				default: '{}',
				description: 'Optional: map an object or array from an earlier node using an expression',
				displayOptions: { show: { valueType: ['mapped'] } },
			},
		],
		'Add Field',
		Object.entries(defaults).map(([key, value]) => ({
			key,
			valueType:
				value === null
					? 'null'
					: typeof value === 'string'
						? 'text'
						: typeof value === 'number'
							? 'number'
							: typeof value === 'boolean'
								? 'boolean'
								: 'mapped',
			...(value === null
				? {}
				: {
						[typeof value === 'string'
							? 'textValue'
							: typeof value === 'number'
								? 'numberValue'
								: typeof value === 'boolean'
									? 'booleanValue'
									: 'mappedValue']: value,
					}),
		})),
	);
}

function binding(value: IDataObject): INodeProperties {
	const parts = (value.parts ?? {}) as IDataObject;
	return {
		displayName: 'Calibration Binding',
		name: 'binding',
		type: 'collection',
		placeholder: 'Add Binding Field',
		default: {
			checkpoint: String(value.base_checkpoint_sha256 ?? ''),
			population: String(value.population_sha256 ?? ''),
			runtime: String(value.runtime_sha256 ?? ''),
			rankingHead: String(parts.ranking_head ?? ''),
			rankingTemperature: String(parts.ranking_temperature ?? ''),
		},
		options: [
			text('checkpoint', 'Checkpoint SHA256'),
			text('population', 'Population SHA256'),
			text('runtime', 'Runtime SHA256'),
			text('rankingHead', 'Ranking Head SHA256'),
			text('rankingTemperature', 'Ranking Temperature SHA256'),
		],
	};
}

function cohort(name: string, label: string, defaults: IDataObject[]): INodeProperties {
	return rows(
		name,
		label,
		[
			text('group', 'Independent Group SHA256'),
			text(
				'targetOutcome',
				'Reviewed Outcome Key',
				'',
				'A Choice outcome name, or true / false for Noul',
			),
			text('state', 'State', '', '', 4),
			questions('questions', 'Question', {}, false),
		],
		'Add Labeled Request',
		defaults.map((item) => ({
			group: item.group_sha256,
			targetOutcome: (() => {
				const question = Object.values(
					(item.request as IDataObject).questions as IDataObject,
				)[0] as IDataObject;
				const keys =
					question.type === 'choice'
						? Object.keys(question.options as IDataObject)
						: ['true', 'false'];
				return keys[item.target as number];
			})(),
			state: (item.request as IDataObject).state,
			questions: questionDefaults(
				(item.request as IDataObject).questions as Record<string, IDataObject>,
			),
		})),
	);
}

export function fieldsFor(spec: Operation): INodeProperties[] {
	const input = presetFor(spec) as IDataObject;
	const state = () =>
		text(
			'context',
			'State',
			typeof input.state === 'string'
				? input.state
				: input.state
					? JSON.stringify(input.state)
					: '',
			'The situation or document to assess. Structured state can be mapped using Advanced JSON.',
			5,
		);
	const question = () => text('formQuestion', 'Question', String(input.question ?? ''), '', 3);
	const request = input.request as IDataObject | undefined;
	if (spec.resource === 'decision' && spec.value === 'predict')
		return [
			state(),
			questions('questionBuilder', 'Questions', input.questions as Record<string, IDataObject>),
		];
	if (spec.value === 'risk')
		return [
			text('context', 'State', String(request?.state ?? ''), '', 5),
			questions(
				'questionBuilder',
				'Question',
				request?.questions as Record<string, IDataObject>,
				false,
			),
			select('calibrationSource', 'Calibration Source', ['token', 'stored']),
			{
				...text('calibrationToken', 'Calibration Token', String(input.calibration ?? '')),
				displayOptions: { show: { calibrationSource: ['token'] } },
			},
			{
				...text('calibrationId', 'Calibration ID'),
				displayOptions: { show: { calibrationSource: ['stored'] } },
			},
			binding(input.binding as IDataObject),
		];
	if (spec.value === 'alignments')
		return [
			text('claim', 'Claim to Check', String(input.question), '', 3),
			rows(
				'sources',
				'Sources',
				[text('id', 'Source ID'), text('text', 'Source Text', '', '', 5)],
				'Add Source',
				input.sources as object[],
			),
		];
	if (spec.value === 'estimate')
		return [
			state(),
			rows(
				'estimates',
				'Estimates',
				[
					text('id', 'Question ID', 'estimate'),
					text('question', 'Question', '', '', 3),
					text('unit', 'Unit', 'hours'),
					numbers('values', 'Value Bins', [0, 1, 2]),
				],
				'Add Estimate',
				Object.entries(input.questions as IDataObject).map(([id, value]) => ({
					id,
					...(value as object),
					values: {
						entries: ((value as IDataObject).values as number[]).map((value) => ({ value })),
					},
				})),
			),
		];
	if (spec.value === 'annotate')
		return [
			text('document', 'Document', String(input.document), '', 6),
			select('segmentation', 'Split Document By', ['line', 'paragraph', 'word', 'custom']),
			{
				...rows(
					'segments',
					'Segments',
					[
						text('id', 'Segment ID'),
						text('label', 'Label'),
						number('start', 'Start Offset'),
						number('end', 'End Offset', 1),
					],
					'Add Segment',
				),
				displayOptions: { show: { segmentation: ['custom'] } },
			},
			questions(
				'questionBuilder',
				'Questions per Segment',
				input.questions as Record<string, IDataObject>,
			),
		];
	if (spec.value === 'given')
		return [
			state(),
			questions('firstQuestion', 'First Question', { first: input.first as IDataObject }, false),
			text('firstOutcome', 'First Outcome', String(input.first_outcome)),
			select('conditionType', 'Assumed Outcome Type', ['choice', 'true', 'false']),
			{
				...text('condition', 'Assumed Choice', String(input.condition)),
				displayOptions: { show: { conditionType: ['choice'] } },
			},
			questions(
				'conditionalQuestion',
				'Conditional Question',
				{ conditional: input.conditional as IDataObject },
				false,
			),
		];
	if (spec.value === 'bind')
		return [
			state(),
			question(),
			rows(
				'records',
				'Records',
				[
					text('id', 'Record ID'),
					text('name', 'Name'),
					text('description', 'Description', '', '', 3),
					typedFields('fields', 'Record Fields'),
				],
				'Add Record',
				(input.records as IDataObject[]).map((record) => ({
					...record,
					fields: typedFields('fields', 'Fields', (record.fields as Record<string, unknown>) ?? {})
						.default,
				})),
			),
		];
	if (spec.value === 'rankings')
		return [
			state(),
			question(),
			number('topK', 'Top Group Size', Number(input.top_k)),
			rows(
				'candidates',
				'Candidates',
				[
					text('id', 'Candidate ID'),
					text('name', 'Name'),
					text('description', 'Description', '', '', 3),
				],
				'Add Candidate',
				input.candidates as object[],
			),
		];
	if (spec.value === 'effort')
		return [
			state(),
			questions(
				'questionBuilder',
				'Questions',
				input.questions as Record<string, IDataObject>,
				true,
				true,
			),
		];
	if (spec.resource === 'conversation' && spec.preset)
		return [
			...(spec.value === 'create'
				? [text('history', 'Initial History', String(input.history ?? ''), '', 5)]
				: spec.value === 'append'
					? [text('event', 'New Message', String(input.event ?? ''), '', 4)]
					: []),
			...(spec.value === 'create'
				? []
				: [number('eventSequence', 'Expected Sequence', Number(input.expected_seq))]),
			questions(
				'questionBuilder',
				'Questions',
				(input.questions as Record<string, IDataObject>) ?? {},
			),
		];
	if (spec.resource === 'calibration' && spec.value === 'fit')
		return [
			text(
				'population',
				'Population SHA256',
				String((input.binding as IDataObject).population_sha256),
			),
			number('targetError', 'Target Error Rate', Number(input.target_error_rate)),
			flag('persist', 'Persist Calibration', 'Requires explicit calibrations retention consent'),
			cohort('temperatureFit', 'Temperature-Fit Requests', input.temperature_fit as IDataObject[]),
			cohort('riskFit', 'Risk-Fit Requests', input.risk_fit as IDataObject[]),
		];
	if (spec.resource === 'calibration' && spec.preset)
		return [
			text('calibrationToken', 'Calibration Token', String(input.calibration)),
			binding(input.binding as IDataObject),
		];
	if (spec.resource === 'feedback' && spec.value === 'fit')
		return [
			binding(input.binding as IDataObject),
			number('targetError', 'Target Error Rate', Number(input.target_error_rate)),
			flag('persist', 'Persist Feedback', 'Requires explicit feedback retention consent'),
			rows(
				'feedbackEvents',
				'Reviewed Events',
				[
					text('eventId', 'Event ID'),
					text('group', 'Independent Group SHA256'),
					select('role', 'Split Role', ['temperature-fit', 'risk-fit', 'check']),
					text('outcomeKey', 'Reviewed Outcome Key'),
					rows(
						'outcomes',
						'Outcome Identities',
						[text('key', 'Outcome Key'), text('digest', 'Candidate SHA256')],
						'Add Outcome',
					),
					numbers('logits', 'Original Native Logits'),
				],
				'Add Reviewed Event',
				(input.events as IDataObject[]).map((event) => ({
					eventId: event.event_id,
					group: event.group_sha256,
					role: event.role,
					outcomeKey: event.outcome_key,
					outcomes: {
						entries: (event.outcomes as IDataObject[]).map((outcome) => ({
							key: outcome.key,
							digest: outcome.candidate_sha256,
						})),
					},
					logits: { entries: (event.logits as number[]).map((value) => ({ value })) },
				})),
			),
		];
	if (spec.value === 'flows')
		return [
			state(),
			rows(
				'steps',
				'Checks',
				[
					text('id', 'Step ID'),
					questions('questions', 'Question', {}, false),
					strings('dependsOn', 'Depends on Steps'),
					strings('requires', 'Required Inputs'),
					text(
						'whenStep',
						'Condition Step',
						'',
						'Optional: run only when this earlier step matches the condition outcome',
					),
					text('whenOutcome', 'Condition Outcome'),
				],
				'Add Check',
				(input.steps as IDataObject[]).map((step) => ({
					id: step.id,
					questions: questionDefaults({ question: step.question as IDataObject }),
					dependsOn: { entries: ((step.depends_on ?? []) as string[]).map((value) => ({ value })) },
					requires: { entries: ((step.requires ?? []) as string[]).map((value) => ({ value })) },
					whenStep: (step.when as IDataObject)?.step ?? '',
					whenOutcome: (step.when as IDataObject)?.outcome ?? '',
				})),
			),
			typedFields('flowInputs', 'Supplied Inputs'),
			flag('recompute', 'Recompute Previous Results'),
			rows(
				'previousResults',
				'Previous Results',
				[
					text('stepId', 'Step ID'),
					text('flowDigest', 'Flow SHA256'),
					text('contentDigest', 'Content SHA256'),
					text('outcome', 'Outcome'),
					select('provenance', 'Provenance', ['caller_assertion', 'executed']),
					rows(
						'probabilities',
						'Outcome Probabilities',
						[text('key', 'Outcome Name'), number('probability', 'Probability')],
						'Add Probability',
					),
				],
				'Add Previous Result',
			),
		];
	if (spec.resource === 'batch' && spec.value === 'create')
		return [
			select('batchEndpoint', 'Endpoint', [
				'/v1/predict',
				'/v1/systemone',
				'/client/v4/accounts/batch/ai/run/@cf/cloudflare/clef',
				'/client/v4/accounts/batch/ai/run/@cf/cloudflare/clef-flash',
			]),
			rows(
				'shards',
				'Storage Shards',
				[text('input_url', 'Pre-Signed Input URL'), text('output_url', 'Pre-Signed Output URL')],
				'Add Shard',
				input.shards as object[],
			),
		];
	return [];
}

export function formDefaults(spec: Operation): Record<string, unknown> {
	return Object.fromEntries(
		fieldsFor(spec).map((field) => [field.name, structuredClone(field.default)]),
	);
}

export const formProperties: INodeProperties[] = [
	{
		...outcomes({
			route: 'Route to the appropriate team',
			review: 'Ask a person to review',
			other: 'None of the offered outcomes applies',
		}),
		displayOptions: { show: { '@version': [2], resource: ['decision'], operation: ['choice'] } },
	},
	{
		...levels(['Missing essential details', 'Needs follow-up', 'Complete enough for review']),
		displayOptions: { show: { '@version': [2], resource: ['decision'], operation: ['score'] } },
	},
	...operations
		.filter((spec) => spec.preset)
		.flatMap((spec) => [
			{
				displayName: 'Input Method',
				name: 'inputMode',
				type: 'options' as const,
				options: [
					{ name: 'Form', value: 'form' },
					{ name: 'Advanced JSON', value: 'json' },
				],
				default: 'form',
				displayOptions: {
					show: { '@version': [2], resource: [spec.resource], operation: [spec.value] },
				},
			},
			...fieldsFor(spec).map((field) => ({
				...field,
				displayOptions: {
					...field.displayOptions,
					show: {
						...field.displayOptions?.show,
						'@version': [2],
						resource: [spec.resource],
						operation: [spec.value],
						inputMode: ['form'],
					},
				},
			})),
		]),
];
