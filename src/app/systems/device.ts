import { BaseModule, type Context, type Frame } from "@/app/core/module";
import { settings } from "@/app/core/settings";
import type {
	DeviceProfile,
	DisplayProfile,
	PointerProfile,
	MotionQuality,
	NetworkProfile,
	PerformanceTier,
} from "@/app/core/state";

type NavigatorWithSignals = Navigator & {
	connection?: {
		saveData?: boolean;
		effectiveType?: string;
	};
	deviceMemory?: number;
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
	private reduceQuery?: MediaQueryList;
	private coarseQuery?: MediaQueryList;
	private fineQuery?: MediaQueryList;
	private hoverQuery?: MediaQueryList;

	override preInit(context: Context): void {
		super.preInit(context);
		this.refresh();
		this.bind();
	}

	override init(context: Context): void {
		super.init(context);
	}

	override resize(context: Context): void {
		super.resize(context);
		this.refresh();
	}

	override update(frame: Frame): void {
		super.update(frame);
	}

	override dispose(): void {
		super.dispose();
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
		const refresh = (): void => this.refresh();
		for (const query of [this.reduceQuery, this.coarseQuery, this.fineQuery, this.hoverQuery]) {
			query.addEventListener("change", refresh);
			this.addCleanup(() => query.removeEventListener("change", refresh));
		}
	}

	private refresh(): void {
		if (!isBrowser()) return;
		this.generation += 1;
		const nav = navigator as NavigatorWithSignals;
		const saveData = nav.connection?.saveData ?? false;
		const reducedMotion =
			this.reduceQuery?.matches ??
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const coarsePointer =
			this.coarseQuery?.matches ??
			window.matchMedia("(hover: none), (pointer: coarse)").matches;
		const finePointer =
			this.fineQuery?.matches ?? window.matchMedia("(hover: hover), (pointer: fine)").matches;
		const hover = this.hoverQuery?.matches ?? window.matchMedia("(hover: hover)").matches;
		const width = window.innerWidth;
		const height = window.innerHeight;
		const cores = navigator.hardwareConcurrency ?? 4;
		const memory = nav.deviceMemory ?? 4;
		const tier = readTier(cores, memory, saveData, reducedMotion);
		const displayProfile = readDisplayProfile(width);
		const motionQuality = readMotionQuality(tier, reducedMotion, saveData);
		const pointerProfile = readPointerProfile(coarsePointer, finePointer);
		const networkProfile: NetworkProfile = saveData
			? "save-data"
			: nav.connection?.effectiveType
				? "standard"
				: "unknown";
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
			dprCap:
				tier === "high"
					? Math.min(dpr, settings.device.maxDprHigh)
					: tier === "medium"
						? Math.min(dpr, settings.device.maxDprMedium)
						: 1,
			reducedMotion,
			hover,
			coarsePointer,
			finePointer,
			saveData,
			viewport: { width, height },
		};

		const root = document.documentElement;
		root.dataset["performanceTier"] = tier;
		root.dataset["motionQuality"] = motionQuality;
		root.dataset["pointerProfile"] = pointerProfile;
		root.dataset["displayProfile"] = displayProfile;
		root.dataset["networkProfile"] = networkProfile;
	}
}

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

const readTier = (
	cores: number,
	memory: number,
	saveData: boolean,
	reducedMotion: boolean,
): PerformanceTier => {
	if (saveData || reducedMotion || cores <= 2 || memory <= 2) return "low";
	if (cores <= 4 || memory <= 4) return "medium";
	return "high";
};

const readMotionQuality = (
	tier: PerformanceTier,
	reducedMotion: boolean,
	saveData: boolean,
): MotionQuality => {
	if (reducedMotion) return "reduced";
	if (saveData || tier === "low") return "lite";
	return "full";
};

export const device = new Device();
export const getDeviceProfile = (): DeviceProfile => device.getProfile();
