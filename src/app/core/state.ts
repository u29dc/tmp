export type PerformanceTier = "low" | "medium" | "high";
export type MotionQuality = "reduced" | "lite" | "full";
export type PointerProfile = "coarse" | "fine" | "hybrid" | "unknown";
export type DisplayProfile = "small" | "medium" | "large";
export type NetworkProfile = "save-data" | "standard" | "unknown";

export type DeviceProfile = {
	version: 1;
	generation: number;
	updatedAt: number;
	tier: PerformanceTier;
	motionQuality: MotionQuality;
	pointerProfile: PointerProfile;
	displayProfile: DisplayProfile;
	networkProfile: NetworkProfile;
	dpr: number;
	dprCap: number;
	reducedMotion: boolean;
	hover: boolean;
	coarsePointer: boolean;
	finePointer: boolean;
	saveData: boolean;
	viewport: {
		width: number;
		height: number;
	};
};

export type RouteState = {
	pathname: string;
	hash: string;
	pageState: "idle" | "preparing" | "exiting" | "swapping" | "entering" | "loaded";
	from?: string;
	to?: string;
	generation: number;
};

export type PointerState = {
	x: number;
	y: number;
	nx: number;
	ny: number;
	dx: number;
	dy: number;
	vx: number;
	vy: number;
	isDown: boolean;
	wasPressed: boolean;
	wasReleased: boolean;
	activePointerType: string;
	path: EventTarget[];
};

export type WheelState = {
	dx: number;
	dy: number;
	source: "wheel" | "touch" | "none";
};

export type KeyboardState = {
	lastKey: string;
	hadKeyboardInput: boolean;
	activeKeys: string[];
};

export type InputState = {
	generation: number;
	pointer: PointerState;
	wheel: WheelState;
	keyboard: KeyboardState;
};

export type ScrollState = {
	actual: number;
	target: number;
	animated: number;
	velocity: number;
	direction: -1 | 0 | 1;
	limit: number;
	progress: number;
	source: "native" | "wheel" | "anchor" | "route";
	isScrolling: boolean;
	isSmoothEnabled: boolean;
};

export type ScrollRangeState = {
	wasActive: boolean;
	isActive: boolean;
	needsShow: boolean;
	needsHide: boolean;
	progress: number;
	rawProgress: number;
	showRatio: number;
	hideRatio: number;
};
