import type { SitePath } from "@/lib/seo";

export type SiteImage = {
	path: SitePath;
	type: string;
	width: number;
	height: number;
	alt: string;
	priority?: boolean;
};

export type SiteImageOverride = Partial<SiteImage>;

export const mergeImage = (
	fallback: SiteImage,
	...overrides: Array<SiteImageOverride | undefined>
): SiteImage => {
	const merged = { ...fallback };
	for (const override of overrides) {
		if (!override) continue;
		for (const [key, value] of Object.entries(override) as Array<
			[keyof SiteImage, SiteImage[keyof SiteImage] | undefined]
		>) {
			if (value !== undefined) merged[key] = value as never;
		}
	}
	return merged;
};
