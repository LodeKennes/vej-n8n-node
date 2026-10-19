import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
	analyzePackage,
	analyzePackageByName,
	SOURCE_FILE_PATTERNS,
} from '@n8n/scan-community-package/scanner/scanner.mjs';
import pkg from '../package.json';

// The upstream CLI can exit zero on a failed result. Always assert passed here.
function check(label: string, result: { passed: boolean; message?: string; details?: string }) {
	if (!result.passed) throw new Error(`${label}: ${result.message}\n${result.details ?? ''}`);
	process.stdout.write(`${label}: passed\n`);
}

if (Bun.argv.includes('--registry')) {
	check(
		`Registry, provenance, attested source, and published artifact ${pkg.name}@${pkg.version}`,
		await analyzePackageByName(pkg.name, pkg.version),
	);
} else {
	check(
		'Local source (inline exceptions disabled)',
		await analyzePackage(process.cwd(), SOURCE_FILE_PATTERNS),
	);
	const tarball = resolve(`artifacts/${pkg.name}-${pkg.version}.tgz`);
	if (!(await Bun.file(tarball).exists()))
		throw new Error('Run bun pm pack --destination artifacts first.');
	await mkdir('artifacts', { recursive: true });
	const directory = await mkdtemp(resolve('artifacts/scan-'));
	try {
		const unpack = Bun.spawn(['tar', '-xzf', tarball, '--strip-components=1', '-C', directory], {
			stdout: 'inherit',
			stderr: 'inherit',
		});
		if (await unpack.exited) throw new Error('Could not unpack the release tarball.');
		check(
			'Packed JavaScript and package metadata',
			await analyzePackage(directory, ['**/*.js', 'package.json']),
		);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
	process.stdout.write(
		'Local analysis only. npm provenance and attested-source retrieval require scan:registry after publication.\n',
	);
}
