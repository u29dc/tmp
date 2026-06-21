import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { minify as minifyHtml } from "@minify-html/node";
import { minifySync, parseSync } from "rolldown/utils";

interface FileResult {
	path: string;
	before: number;
	after: number;
	changed: boolean;
}

const distPath = path.resolve("dist");
const scriptExtensions = new Set([".js", ".mjs"]);
const htmlExtension = ".html";
const htmlMinifyOptions = {
	keep_closing_tags: true,
	keep_html_and_head_opening_tags: true,
} as const;

function byteLength(value: string): number {
	return Buffer.byteLength(value, "utf8");
}

async function directoryExists(directory: string): Promise<boolean> {
	return stat(directory)
		.then((details) => details.isDirectory())
		.catch(() => false);
}

async function collectTargets(
	directory: string,
	matches: (fileName: string) => boolean,
	files: string[] = [],
): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name);

		if (entry.isDirectory()) {
			await collectTargets(entryPath, matches, files);
			continue;
		}

		if (entry.isFile() && matches(entry.name)) {
			files.push(entryPath);
		}
	}

	return files.sort();
}

async function collectScriptTargets(directory: string): Promise<string[]> {
	return collectTargets(directory, (fileName) => scriptExtensions.has(path.extname(fileName)));
}

async function collectHtmlTargets(directory: string): Promise<string[]> {
	return collectTargets(directory, (fileName) => path.extname(fileName) === htmlExtension);
}

async function minifyScriptFile(filePath: string): Promise<FileResult> {
	const source = await readFile(filePath, "utf8");
	const result = minifySync(filePath, source, {
		module: true,
		compress: false,
		mangle: false,
		codegen: {
			removeWhitespace: true,
		},
		sourcemap: false,
	});

	parseSync(filePath, result.code, {
		sourceType: "module",
	});

	const before = byteLength(source);
	const after = byteLength(result.code);
	const changed = result.code !== source && after <= before;

	if (changed) {
		await writeFile(filePath, result.code);
	}

	return {
		path: path.relative(process.cwd(), filePath),
		before,
		after: changed ? after : before,
		changed,
	};
}

async function minifyHtmlFile(filePath: string): Promise<FileResult> {
	const source = await readFile(filePath);
	const result = minifyHtml(source, htmlMinifyOptions);

	const before = source.byteLength;
	const after = result.byteLength;
	const changed = !source.equals(result) && after <= before;

	if (changed) {
		await writeFile(filePath, result);
	}

	return {
		path: path.relative(process.cwd(), filePath),
		before,
		after: changed ? after : before,
		changed,
	};
}

function reportResults(label: string, results: FileResult[]): void {
	const changed = results.filter((result) => result.changed);
	const before = results.reduce((total, result) => total + result.before, 0);
	const after = results.reduce((total, result) => total + result.after, 0);
	const saved = before - after;

	for (const result of changed) {
		const savedForFile = result.before - result.after;
		console.log(`${result.path}: ${result.before} -> ${result.after} bytes (-${savedForFile})`);
	}

	console.log(
		`Minified ${changed.length}/${results.length} ${label} files. ${before} -> ${after} bytes (-${saved}).`,
	);
}

async function main(): Promise<void> {
	if (!(await directoryExists(distPath))) {
		throw new Error("dist directory does not exist. Run the Astro build first.");
	}

	const scriptTargets = await collectScriptTargets(distPath);
	const scriptResults = await Promise.all(
		scriptTargets.map((filePath) => minifyScriptFile(filePath)),
	);
	reportResults("JS", scriptResults);

	const htmlTargets = await collectHtmlTargets(distPath);
	const htmlResults = await Promise.all(htmlTargets.map((filePath) => minifyHtmlFile(filePath)));
	reportResults("HTML", htmlResults);
}

await main();
