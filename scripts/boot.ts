import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { type OutputChunk, rolldown } from "rolldown";
import { parseSync } from "rolldown/utils";

const sourcePath = path.resolve("src/app/boot.ts");
const outputPath = path.resolve("public/boot.js");

function formatBytes(bytes: number): string {
	return bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} kB`;
}

const bundle = await rolldown({
	input: sourcePath,
	cwd: process.cwd(),
	platform: "browser",
	tsconfig: path.resolve("tsconfig.json"),
});

try {
	const result = await bundle.generate({
		file: outputPath,
		format: "iife",
		exports: "none",
		sourcemap: false,
		minify: true,
	});
	const chunks = result.output.filter((item): item is OutputChunk => item.type === "chunk");
	const chunk = chunks[0];
	if (!chunk || chunks.length !== 1) throw new Error(`Expected one boot chunk, received ${chunks.length}.`);
	const code = `${chunk.code.trim()}\n`;
	parseSync(outputPath, code, { sourceType: "script" });
	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(outputPath, code);
	console.log(`boot: generated ${path.relative(process.cwd(), outputPath)} ${formatBytes(Buffer.byteLength(code))}`);
} finally {
	await bundle.close();
}
