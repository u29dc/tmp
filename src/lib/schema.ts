import type { SiteImage } from "@/data/media";
import { SITE } from "@/data/site";
import { absoluteSiteUrl } from "@/lib/seo";

export type SchemaNode = Record<string, unknown>;

export type OrganizationSchemaInput = {
	name: string;
	url?: string;
	logo?: SiteImage;
	sameAs?: string[];
};

export type WebPageSchemaInput = {
	url: string;
	name: string;
	description: string;
	image?: SiteImage;
	datePublished?: Date;
	dateModified?: Date;
};

const SCHEMA_CONTEXT = "https://schema.org";

const compactSchema = (schema: SchemaNode): SchemaNode =>
	Object.fromEntries(Object.entries(schema).filter(([, value]) => value !== undefined));

const imageSchema = (image: SiteImage): SchemaNode =>
	compactSchema({
		"@type": "ImageObject",
		url: absoluteSiteUrl(image.path),
		width: image.width,
		height: image.height,
		name: image.alt,
	});

export const buildWebSiteSchema = (): SchemaNode => ({
	"@type": "WebSite",
	"@id": `${SITE.url}#website`,
	url: SITE.url,
	name: SITE.name,
	description: SITE.description,
	inLanguage: SITE.lang,
});

export const buildWebPageSchema = (page: WebPageSchemaInput): SchemaNode =>
	compactSchema({
		"@type": "WebPage",
		"@id": `${page.url}#webpage`,
		url: page.url,
		name: page.name,
		description: page.description,
		inLanguage: SITE.lang,
		isPartOf: {
			"@id": `${SITE.url}#website`,
		},
		image: page.image ? imageSchema(page.image) : undefined,
		datePublished: page.datePublished?.toISOString(),
		dateModified: page.dateModified?.toISOString(),
	});

export const buildOrganizationSchema = (
	organization?: OrganizationSchemaInput,
): SchemaNode | undefined => {
	if (!organization) return undefined;
	return compactSchema({
		"@type": "Organization",
		"@id": `${organization.url ?? SITE.url}#organization`,
		name: organization.name,
		url: organization.url ?? SITE.url,
		logo: organization.logo ? imageSchema(organization.logo) : undefined,
		sameAs: organization.sameAs,
	});
};

export const buildSchemaGraph = (nodes: Array<SchemaNode | undefined>): SchemaNode => ({
	"@context": SCHEMA_CONTEXT,
	"@graph": nodes.filter((node): node is SchemaNode => Boolean(node)),
});

export const serializeSchema = (schema: SchemaNode): string =>
	JSON.stringify(schema).replaceAll("<", "\\u003c");
