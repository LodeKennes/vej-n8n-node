import { NodeApiError, NodeHelpers, NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	JsonObject,
} from 'n8n-workflow';
import { formValues } from './form-input';
import { buildRequest, serviceUrl } from './request';

export async function prepareRequest(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	try {
		const credentials = await this.getCredentials('vejApi');
		const baseURL = serviceUrl(credentials.baseUrl);
		const resource = this.getNodeParameter('resource') as string;
		const operation = this.getNodeParameter('operation') as string;
		const get = (name: string, fallback?: unknown) => this.getNodeParameter(name, fallback);
		const fields = this.getNode().typeVersion >= 2 ? formValues(resource, operation, get) : {};
		const { path, ...request } = buildRequest(resource, operation, (name, fallback) =>
			Object.prototype.hasOwnProperty.call(fields, name) ? fields[name] : get(name, fallback),
		);
		return {
			...requestOptions,
			...request,
			baseURL,
			url: `${baseURL}${path}`,
			body: request.body,
			qs: request.qs,
			// Let postReceive preserve status and redact server-echoed credential values.
			ignoreHttpStatusErrors: true,
		};
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error, {
			itemIndex: this.getItemIndex(),
		});
	}
}

export async function receiveResponse(
	this: IExecuteSingleFunctions,
	_items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const { body, statusCode } = response;
	if (statusCode < 200 || statusCode >= 300) {
		const problem = body && typeof body === 'object' ? (body as IDataObject) : {};
		const detail = problem.detail ?? problem.error ?? problem.title;
		const description =
			typeof detail === 'string'
				? detail
				: 'Check service availability, credentials, access, and input.';
		const { apiKey } = await this.getCredentials('vejApi');
		const safeDescription =
			typeof apiKey === 'string' && apiKey
				? description.split(apiKey).join('[REDACTED]')
				: description;
		throw new NodeApiError(this.getNode(), { message: safeDescription } as JsonObject, {
			httpCode: String(statusCode),
			itemIndex: this.getItemIndex(),
			description: safeDescription,
			message: `Vej API returned HTTP ${statusCode}`,
		});
	}
	let result = body === '' || body == null ? {} : body;
	if (typeof result !== 'object' || Array.isArray(result))
		throw new NodeOperationError(this.getNode(), 'Vej returned an unexpected response shape.', {
			itemIndex: this.getItemIndex(),
		});
	const operation = this.getNodeParameter('operation') as string;
	if (this.getNode().typeVersion >= 2 && ['delete', 'deleteToken'].includes(operation)) {
		result = { ...result, deleted: true };
	}
	if (this.getNode().typeVersion >= 2) {
		const mode = NodeHelpers.isToolType(this.getNode().type)
			? this.getNodeParameter('output', 'raw')
			: this.getNodeParameter('simplify', false)
				? 'simplified'
				: 'raw';
		let fields: string[] | undefined;
		if (mode === 'simplified') {
			fields =
				operation === 'risk'
					? [
							'candidate_keys',
							'candidate_index',
							'decision',
							'probabilities',
							'calibration_identity',
							'target_error_rate',
							'drift_warning',
							'upper_bound',
							'metadata',
							'usage',
						]
					: operation === 'given'
						? [
								'model',
								'first_outcome',
								'marginal',
								'conditional',
								'bound',
								'product',
								'semantics',
								'metadata',
								'usage',
							]
						: [
								...('feedback_ids' in result ? ['feedback_ids'] : ['model']),
								'status',
								'calibration',
								'calibration_id',
								'calibration_identity',
								'binding',
								'temperature',
								'threshold',
								'metadata',
								'usage',
							];
		} else if (mode === 'selected') {
			const selected = this.getNodeParameter('outputFields', ['metadata', 'usage']);
			if (!Array.isArray(selected) || selected.some((field) => typeof field !== 'string'))
				throw new NodeOperationError(this.getNode(), 'Select response fields to include.');
			fields = [
				'id',
				'calibration_id',
				'calibration_identity',
				'feedback_ids',
				'candidate_keys',
				'candidate_index',
				...(selected as string[]),
			];
		}
		if (fields)
			result = Object.fromEntries(Object.entries(result).filter(([key]) => fields.includes(key)));
	}
	return [{ json: result as IDataObject, pairedItem: { item: this.getItemIndex() } }];
}
