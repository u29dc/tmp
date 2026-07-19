import { BaseModule, type Context } from "@/app/core/module";
import { settings } from "@/app/core/settings";
import type { DeviceProfile, DisplayProfile, PointerProfile, MotionQuality, NetworkProfile, PerformanceTier } from "@/app/core/state";
import { setDataset } from "@/app/utils/dom";

type NavigatorWithSignals = Navigator & {
	connection?: NetworkInformationLike;
	deviceMemory?: number;
};

type NetworkInformationLike = EventTarget & {
	saveData?: boolean;
	effectiveType?: string;
};

const isBrowser = (): boolean => typeof window !== "undefined" && typeof document !== "undefined";

const createDefaultProfile = (): DeviceProfile => ({
	version: 1,
	generation: 0,
	updatedAt: 0,
	tier: "medium",
	motionQuality: "lite",
	pointerProfile: "unknown",
	displayProfile: "medium",
	networkProfile: "unknown",
	dpr: 1,
	dprCap: 1,
	reducedMotion: false,
	hover: false,
	coarsePointer: false,
	finePointer: false,
	saveData: false,
	viewport: {
		width: 1024,
		height: 768,
	},
});

class Device extends BaseModule {
	readonly name = "device";

	private profile = createDefaultProfile();
	private generation = 0;
	private initialized = false;
	private reduceQuery: MediaQueryList | undefined;
	private coarseQuery: MediaQueryList | undefined;
	private fineQuery: MediaQueryList | undefined;
	private hoverQuery: MediaQueryList | undefined;
	private connection: NetworkInformationLike | undefined;

	override preInit(context: Context): void {
		super.preInit(context);
		this.refreshProfile();
		this.bind();
	}

	override init(context: Context): void {
		super.init(context);
	}

	override resize(context: Context): void {
		super.resize(context);
		this.refreshProfile();
	}

	override dispose(): void {
		super.dispose();
		this.initialized = false;
		this.connection = undefined;
		this.reduceQuery = undefined;
		this.coarseQuery = undefined;
		this.fineQuery = undefined;
		this.hoverQuery = undefined;
	}

	getProfile(): DeviceProfile {
		return this.profile;
	}

	private bind(): void {
		if (!isBrowser() || this.initialized) return;
		this.initialized = true;
		this.reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		this.coarseQuery = window.matchMedia("(hover: none), (pointer: coarse)");
		this.fineQuery = window.matchMedia("(hover: hover), (pointer: fine)");
		this.hoverQuery = window.matchMedia("(hover: hover)");
		const refresh = (): void => this.refreshProfile();
		for (const query of [this.reduceQuery, this.coarseQuery, this.fineQuery, this.hoverQuery]) {
			this.addCleanup(addMediaQueryListener(query, refresh));
		}
		this.connection = (navigator as NavigatorWithSignals).connection;
		this.connection?.addEventListener?.("change", this.handleConnectionChange);
		window.addEventListener("pageshow", this.handlePageShow);
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
		this.addCleanup(() => this.connection?.removeEventListener?.("change", this.handleConnectionChange));
		this.addCleanup(() => window.removeEventListener("pageshow", this.handlePageShow));
		this.addCleanup(() => document.removeEventListener("visibilitychange", this.handleVisibilityChange));
	}

	private refreshProfile(): void {
		if (!isBrowser()) return;
		this.generation += 1;
		const nav = navigator as NavigatorWithSignals;
		const saveData = nav.connection?.saveData ?? false;
		const reducedMotion = this.reduceQuery?.matches ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const coarsePointer = this.coarseQuery?.matches ?? window.matchMedia("(hover: none), (pointer: coarse)").matches;
		const finePointer = this.fineQuery?.matches ?? window.matchMedia("(hover: hover), (pointer: fine)").matches;
		const hover = this.hoverQuery?.matches ?? window.matchMedia("(hover: hover)").matches;
		const width = window.innerWidth;
		const height = window.innerHeight;
		const cores = navigator.hardwareConcurrency ?? 4;
		const memory = nav.deviceMemory ?? 4;
		const tier = readTier(cores, memory, saveData, reducedMotion);
		const displayProfile = readDisplayProfile(width);
		const motionQuality = readMotionQuality(tier, reducedMotion, saveData);
		const pointerProfile = readPointerProfile(coarsePointer, finePointer);
		const networkProfile: NetworkProfile = saveData ? "save-data" : nav.connection?.effectiveType ? "standard" : "unknown";
		const dpr = window.devicePixelRatio || 1;

		this.profile = {
			version: 1,
			generation: this.generation,
			updatedAt: performance.now(),
			tier,
			motionQuality,
			pointerProfile,
			displayProfile,
			networkProfile,
			dpr,
			dprCap: tier === "high" ? Math.min(dpr, settings.device.maxDprHigh) : tier === "medium" ? Math.min(dpr, settings.device.maxDprMedium) : 1,
			reducedMotion,
			hover,
			coarsePointer,
			finePointer,
			saveData,
			viewport: { width, height },
		};

		const root = document.documentElement;
		setDataset(root, "performanceTier", tier);
		setDataset(root, "motionQuality", motionQuality);
		setDataset(root, "pointerProfile", pointerProfile);
		setDataset(root, "displayProfile", displayProfile);
		setDataset(root, "networkProfile", networkProfile);
		this.requestFrame("device:profile");
	}

	private readonly handleConnectionChange = (): void => {
		this.refreshProfile();
	};

	private readonly handlePageShow = (event: PageTransitionEvent): void => {
		if (event.persisted) this.refreshProfile();
	};

	private readonly handleVisibilityChange = (): void => {
		if (!document.hidden) this.refreshProfile();
	};
}

const addMediaQueryListener = (query: MediaQueryList, callback: () => void): (() => void) => {
	if (typeof query.addEventListener === "function") {
		query.addEventListener("change", callback);
		return () => query.removeEventListener("change", callback);
	}

	const legacyQuery = query as unknown as {
		addListener?: (listener: () => void) => void;
		removeListener?: (listener: () => void) => void;
	};
	legacyQuery.addListener?.(callback);
	return () => legacyQuery.removeListener?.(callback);
};

const readDisplayProfile = (width: number): DisplayProfile => {
	if (width < settings.device.smallWidth) return "small";
	if (width >= settings.device.largeWidth) return "large";
	return "medium";
};

const readPointerProfile = (coarse: boolean, fine: boolean): PointerProfile => {
	if (coarse && fine) return "hybrid";
	if (coarse) return "coarse";
	if (fine) return "fine";
	return "unknown";
};

const readTier = (cores: number, memory: number, saveData: boolean, reducedMotion: boolean): PerformanceTier => {
	if (saveData || reducedMotion || cores <= 2 || memory <= 2) return "low";
	if (cores <= 4 || memory <= 4) return "medium";
	return "high";
};

const readMotionQuality = (tier: PerformanceTier, reducedMotion: boolean, saveData: boolean): MotionQuality => {
	if (reducedMotion) return "reduced";
	if (saveData || tier === "low") return "lite";
	return "full";
};

export const device = new Device();
export const getDeviceProfile = (): DeviceProfile => device.getProfile();
