import { SITE } from "@/data/site";

export type StorageKeyName = "controls" | "settings";

export const SITE_NAMESPACE = SITE.namespace;

export const storageKey = (name: StorageKeyName): string => `${SITE_NAMESPACE}:${name}`;
