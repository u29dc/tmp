export type SiteImage = {
	path: `/${string}`;
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
): SiteImage => Object.assign({}, fallback, ...overrides);
