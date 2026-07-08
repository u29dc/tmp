import type { SitePath } from "@/lib/seo";

export type SiteImage = {
	path: SitePath;
	type: string;
	width: number;
	height: number;
	alt: string;
	priority?: boolean;
};

type SiteImageReplacement = Pick<SiteImage, "path" | "type" | "width" | "height" | "alt"> & Partial<Pick<SiteImage, "priority">>;
type SiteImageMetadataOverride = Partial<Pick<SiteImage, "alt" | "priority">> & {
	path?: never;
	type?: never;
	width?: never;
	height?: never;
};

export type SiteImageOverride = SiteImageMetadataOverride | SiteImageReplacement;

export const mergeImage = (fallback: SiteImage, ...overrides: Array<SiteImageOverride | undefined>): SiteImage => {
	const merged = { ...fallback };
	for (const override of overrides) {
		if (!override) continue;
		assertImageOverride(override);
		if (override.path !== undefined) {
			merged.path = override.path;
			merged.type = override.type;
			merged.width = override.width;
			merged.height = override.height;
			merged.alt = override.alt;
		} else if (override.alt !== undefined) {
			merged.alt = override.alt;
		}
		if (override.priority !== undefined) merged.priority = override.priority;
	}
	return merged;
};

const assertImageOverride = (override: SiteImageOverride): void => {
	const hasPath = override.path !== undefined;
	const hasAssetMetadata = override.type !== undefined || override.width !== undefined || override.height !== undefined;
	if (!hasPath && hasAssetMetadata) {
		throw new Error("Image type, width, and height overrides require a replacement image path");
	}
	if (!hasPath) return;
	if (!override.type || !Number.isFinite(override.width) || override.width <= 0 || !Number.isFinite(override.height) || override.height <= 0 || !override.alt) {
		throw new Error("Replacement image overrides must include path, type, width, height, and alt");
	}
};
