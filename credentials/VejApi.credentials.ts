import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class VejApi implements ICredentialType {
	name = 'vejApi';
	displayName = 'Vej API';
	documentationUrl = 'https://github.com/LodeKennes/vej-n8n-node/blob/main/docs/installation.md';
	icon = { light: 'file:../nodes/Vej/vej.svg', dark: 'file:../nodes/Vej/vej.dark.svg' } as const;
	properties: INodeProperties[] = [
		{
			displayName: 'API URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.itsvej.com',
			required: true,
			description: 'Vej service root, without /v1 or /v1beta. Use HTTPS for hosted services.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Your vej_sk_ API key. Leave empty only for a trusted local server without authentication.',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{ $credentials.apiKey ? "Bearer " + $credentials.apiKey : "" }}',
			},
		},
	};
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ $credentials.baseUrl.replace(/\\/+$/, "") }}',
			url: '/v1/me',
			method: 'GET',
			disableFollowRedirect: true,
		},
	};
}
