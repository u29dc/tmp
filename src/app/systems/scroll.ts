import { BaseModule, type Context, type Frame } from "@/app/core/module";
import { settings } from "@/app/core/settings";
import type { DeviceProfile, ScrollRangeState, ScrollState } from "@/app/core/state";
import {
	onInputClickIntent,
	onInputWheelIntent,
	type InputClickIntent,
	type InputWheelIntent,
} from "@/app/systems/input";
import { setRouteHash } from "@/app/systems/route";
import {
	focusElement,
	removeDataset,
	removeStyleProperty,
	setDataset,
	setStyleProperty,
	toggleClass,
} from "@/app/utils/dom";
import { clamp, damp, fit, saturate, signedDirection, unlerp } from "@/app/utils/math";

type ScrollElement = {
	element: HTMLElement;
	className: string;
	offsetStart: string;
	offsetEnd: string;
	positionStart: string;
	positionEnd: string;
	speed: number | null;
	repeat: boolean;
	cssProgress: boolean;
	callEvent: string | null;
	enableTouchSpeed: boolean;
	top: number;
	height: number;
	intersectionStart: number;
	intersectionEnd: number;
	interactive: boolean;
	range: ScrollRangeState;
};

type ScrollToOptions = {
	offset?: number;
	immediate?: boolean;
};

const SCROLL_SELECTOR = "[data-scroll]";
const SCROLL_TO_SELECTOR = "a[href^='#'], [data-scroll-to], [data-scroll-to-href]";
const NATIVE_SCROLL_SELECTOR =
	"[data-native-scroll], [data-scroll-native], textarea, select, iframe, [contenteditable='true']";
const INVIEW_CLASS = "is-inview";
const INTERACTIVE_ROOT_MARGIN = "100% 0px 100% 0px";
const SETTLE_MS = 120;
const RANGE_EPSILON = 0.000_1;

const createState = (): ScrollState => ({
	actual: 0,
	target: 0,
	animated: 0,
	velocity: 0,
	direction: 0,
	limit: 0,
	progress: 0,
	source: "native",
	isScrolling: false,
	isSmoothEnabled: false,
});

const createRangeState = (): ScrollRangeState => ({
	wasActive: false,
	isActive: false,
	needsShow: false,
	needsHide: false,
	progress: 0,
	rawProgress: 0,
	showRatio: 0,
	hideRatio: 0,
});

class Scroll extends BaseModule {
	readonly name = "scroll";

	private state = createState();
	private elements: ScrollElement[] = [];
	private observer: IntersectionObserver | undefined;
	private resizeObserver: ResizeObserver | undefined;
	private previousY = 0;
	private lastScrollAt = 0;
	private needsMeasure = true;
	private source: ScrollState["source"] = "native";
	private smoothEnabled = false;
	private smoothActive = false;
	private smoothTarget = 0;
	private programmatic = false;
	private writeY: number | undefined;
	private profileGeneration = -1;
	private latestProfile: DeviceProfile | undefined;
	private readonly animator = new ScrollAnimator();

	override preInit(context: Context): void {
		super.preInit(context);
		this.latestProfile = context.profile;
		this.applyCapability(context.profile);
		window.addEventListener("scroll", this.handleScroll, { passive: true });
		this.resizeObserver = this.createResizeObserver();
		this.scan();
		this.addCleanup(onInputWheelIntent(this.handleWheelIntent));
		this.addCleanup(onInputClickIntent(this.handleClickIntent));
		this.addCleanup(() => window.removeEventListener("scroll", this.handleScroll));
		this.addCleanup(() => this.observer?.disconnect());
		this.addCleanup(() => this.resizeObserver?.disconnect());
	}

	override init(context: Context): void {
		super.init(context);
		this.latestProfile = context.profile;
		this.applyCapability(context.profile);
		this.syncFromWindow("route", performance.now());
	}

	override resize(context: Context): void {
		super.resize(context);
		this.needsMeasure = true;
		this.scan();
		this.state.limit = this.measureLimit();
		this.clampSmoothModelToLimit();
	}

	override update(frame: Frame): void {
		super.update(frame);
		this.refreshCapability(frame.profile);
		if (
			this.smoothActive &&
			(frame.input.pointer.wasPressed || frame.input.keyboard.hadKeyboardInput)
		) {
			this.syncFromWindow("native", frame.now);
		}
		if (frame.input.wheel.source !== "none" && !this.smoothActive) this.source = "wheel";

		const nextState = this.readState(this.source, frame.dt, frame.now);
		const stateChanged = hasStateChanged(this.state, nextState);
		this.state = nextState;
		this.source = "native";

		if (this.needsMeasure) this.measureElements(this.state.actual);
		this.computeElements(frame);
		if (stateChanged || this.needsMeasure) this.writeRootState();
		this.writeElements(frame, stateChanged);
		this.writeScrollPosition();
		this.needsMeasure = false;
	}

	override dispose(): void {
		for (const item of this.elements) {
			toggleClass(item.element, item.className, false);
			removeStyleProperty(item.element, "--scroll-progress");
			removeStyleProperty(item.element, "--scroll-raw-progress");
			removeStyleProperty(item.element, "--scroll-show-ratio");
			removeStyleProperty(item.element, "--scroll-hide-ratio");
			removeStyleProperty(item.element, "--progress");
			removeStyleProperty(item.element, "transform");
			removeDataset(item.element, "scrollState");
		}
		this.elements = [];
		super.dispose();
	}

	getState(): ScrollState {
		return this.state;
	}

	applySettings(): void {
		this.applyCapability(this.latestProfile);
		this.state = {
			...this.state,
			isSmoothEnabled: this.smoothEnabled,
		};
		this.writeRootState();
	}

	scrollTo(target: number | string | HTMLElement, options: ScrollToOptions = {}): void {
		const y = this.resolveTargetY(target, options.offset ?? 0);
		if (y === null) return;
		const reducedMotion = this.latestProfile?.reducedMotion ?? false;
		this.source = "anchor";
		this.stopSmooth();
		window.scrollTo({
			top: clamp(y, 0, this.state.limit),
			behavior: options.immediate || reducedMotion ? "auto" : "smooth",
		});
	}

	private scan(root: ParentNode = document): void {
		this.observer?.disconnect();
		this.observer = this.createIntersectionObserver();
		this.elements = Array.from(root.querySelectorAll<HTMLElement>(SCROLL_SELECTOR)).map(
			(element) => this.createElement(element),
		);
		for (const item of this.elements) {
			if (this.observer) this.observer.observe(item.element);
			else item.interactive = true;
		}
		this.needsMeasure = true;
	}

	private createElement(element: HTMLElement): ScrollElement {
		const [offsetStart = "0", offsetEnd = "0"] = splitPair(element.dataset["scrollOffset"]);
		const [positionStart = "start", positionEnd = "end"] = splitPair(
			element.dataset["scrollPosition"] ?? "start,end",
		);
		const speed =
			element.dataset["scrollSpeed"] === undefined
				? null
				: Number.parseFloat(element.dataset["scrollSpeed"]);

		return {
			element,
			className: element.dataset["scrollClass"] ?? INVIEW_CLASS,
			offsetStart,
			offsetEnd,
			positionStart,
			positionEnd,
			speed: Number.isFinite(speed) ? speed : null,
			repeat: element.dataset["scrollRepeat"] !== undefined,
			cssProgress: element.dataset["scrollCssProgress"] !== undefined,
			callEvent: element.dataset["scrollCall"] ?? null,
			enableTouchSpeed: element.dataset["scrollEnableTouchSpeed"] !== undefined,
			top: 0,
			height: 0,
			intersectionStart: 0,
			intersectionEnd: 1,
			interactive: false,
			range: createRangeState(),
		};
	}

	private createIntersectionObserver(): IntersectionObserver | undefined {
		if (!("IntersectionObserver" in window)) return undefined;
		return new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const item = this.elements.find(
						(candidate) => candidate.element === entry.target,
					);
					if (!item) continue;
					item.interactive = entry.isIntersecting;
				}
			},
			{ rootMargin: INTERACTIVE_ROOT_MARGIN },
		);
	}

	private createResizeObserver(): ResizeObserver | undefined {
		if (!("ResizeObserver" in window)) return undefined;
		const observer = new ResizeObserver(() => {
			this.needsMeasure = true;
		});
		observer.observe(document.documentElement);
		if (document.body) observer.observe(document.body);
		return observer;
	}

	private refreshCapability(profile: DeviceProfile): void {
		if (profile.generation === this.profileGeneration) return;
		this.latestProfile = profile;
		this.profileGeneration = profile.generation;
		this.applyCapability(profile);
	}

	private applyCapability(profile = this.latestProfile): void {
		const enabled = profile ? this.shouldEnhance(profile) : false;
		const changed = enabled !== this.smoothEnabled;
		this.smoothEnabled = enabled;
		setDataset(document.documentElement, "smoothScroll", enabled ? "enhanced" : "native");
		if (changed && !enabled) this.syncFromWindow("native", performance.now());
	}

	private shouldEnhance(profile: DeviceProfile): boolean {
		return (
			settings.scroll.smoothEnabled &&
			!profile.reducedMotion &&
			profile.hover &&
			profile.finePointer &&
			profile.motionQuality === "full" &&
			profile.pointerProfile !== "coarse" &&
			profile.displayProfile !== "small" &&
			profile.networkProfile !== "save-data" &&
			profile.tier !== "low"
		);
	}

	private readState(source: ScrollState["source"], dt: number, now: number): ScrollState {
		if (this.smoothActive) return this.readSmooth(source, dt, now);
		return this.readWindow(source, dt, now);
	}

	private readSmooth(source: ScrollState["source"], dt: number, now: number): ScrollState {
		const limit = this.measureLimit();
		this.smoothTarget = clamp(this.smoothTarget, 0, limit);
		this.animator.retarget(this.smoothTarget);
		const settled = this.animator.advance(dt);
		const animated = clamp(this.animator.value, 0, limit);
		const velocity = this.animator.velocity;
		const direction = signedDirection(velocity);
		this.writeY = animated;
		this.previousY = animated;
		this.lastScrollAt = now;

		if (settled) {
			this.smoothActive = false;
			this.smoothTarget = animated;
		}

		return {
			actual: animated,
			target: this.smoothTarget,
			animated,
			velocity,
			direction,
			limit,
			progress: limit <= 0 ? 0 : saturate(animated / limit),
			source,
			isScrolling: true,
			isSmoothEnabled: this.smoothEnabled,
		};
	}

	private readWindow(source: ScrollState["source"], dt: number, now: number): ScrollState {
		const limit = this.measureLimit();
		const actual = clamp(window.scrollY, 0, limit);
		const delta = actual - this.previousY;
		const changed = Math.abs(delta) > 0.01 || limit !== this.state.limit;
		const velocity = dt > 0 && changed ? delta / dt : 0;
		const direction = changed ? signedDirection(delta) : this.state.direction;
		const isScrolling = changed || now - this.lastScrollAt < SETTLE_MS;

		if (changed) {
			this.previousY = actual;
			this.lastScrollAt = now;
		}

		return {
			actual,
			target: actual,
			animated: actual,
			velocity,
			direction,
			limit,
			progress: limit <= 0 ? 0 : saturate(actual / limit),
			source,
			isScrolling,
			isSmoothEnabled: this.smoothEnabled,
		};
	}

	private measureLimit(): number {
		const body = document.body;
		const root = document.documentElement;
		return Math.max(0, Math.max(body.scrollHeight, root.scrollHeight) - window.innerHeight);
	}

	private syncFromWindow(source: ScrollState["source"], now = performance.now()): void {
		const limit = this.measureLimit();
		const actual = clamp(window.scrollY, 0, limit);
		this.smoothActive = false;
		this.smoothTarget = actual;
		this.writeY = undefined;
		this.programmatic = false;
		this.previousY = actual;
		this.lastScrollAt = now;
		this.animator.sync(actual);
		this.state = {
			actual,
			target: actual,
			animated: actual,
			velocity: 0,
			direction: 0,
			limit,
			progress: limit <= 0 ? 0 : saturate(actual / limit),
			source,
			isScrolling: false,
			isSmoothEnabled: this.smoothEnabled,
		};
	}

	private clampSmoothModelToLimit(): void {
		const limit = this.state.limit;
		const actual = clamp(window.scrollY, 0, limit);
		const animated = clamp(this.state.animated, 0, limit);
		this.smoothTarget = clamp(this.smoothTarget || actual, 0, limit);
		if (!this.smoothActive) this.animator.sync(actual);
		else this.animator.sync(animated);
	}

	private measureElements(currentScroll: number): void {
		for (const item of this.elements) {
			const rect = item.element.getBoundingClientRect();
			item.top = currentScroll + rect.top;
			item.height = rect.height;
			item.intersectionStart = resolveStart(item, window.innerHeight);
			item.intersectionEnd = resolveEnd(item);
			if (item.intersectionEnd <= item.intersectionStart) {
				item.intersectionEnd = item.intersectionStart + Math.max(1, item.height);
			}
		}
	}

	private computeElements(frame: Frame): void {
		const viewport = frame.profile.viewport.height || window.innerHeight;
		for (const item of this.elements) {
			if (!item.interactive && !item.range.isActive && !this.state.isScrolling) continue;
			const previousActive = item.range.isActive;
			const rawProgress = unlerp(
				item.intersectionStart,
				item.intersectionEnd,
				this.state.actual,
			);
			const progress = saturate(rawProgress);
			const isActive = rawProgress >= -RANGE_EPSILON && rawProgress <= 1 + RANGE_EPSILON;
			const visibleSpan = Math.max(
				RANGE_EPSILON,
				item.height <= 0 ? 1 : saturate(viewport / item.height),
			);
			item.range = {
				wasActive: previousActive,
				isActive,
				needsShow: !previousActive && isActive,
				needsHide: previousActive && !isActive,
				progress,
				rawProgress,
				showRatio: saturate(rawProgress / visibleSpan),
				hideRatio: saturate((rawProgress - (1 - visibleSpan)) / visibleSpan),
			};
		}
	}

	private writeRootState(): void {
		const root = document.documentElement;
		setStyleProperty(root, "--scroll-y", this.state.actual.toFixed(3));
		setStyleProperty(root, "--scroll-target", this.state.target.toFixed(3));
		setStyleProperty(root, "--scroll-progress", this.state.progress.toFixed(5));
		setStyleProperty(root, "--scroll-velocity", this.state.velocity.toFixed(3));
		setDataset(root, "smoothScroll", this.state.isSmoothEnabled ? "enhanced" : "native");
		setDataset(root, "scrolling", this.state.isScrolling);
		setDataset(
			root,
			"scrollDirection",
			this.state.direction > 0 ? "down" : this.state.direction < 0 ? "up" : "none",
		);
	}

	private writeElements(frame: Frame, stateChanged: boolean): void {
		for (const item of this.elements) {
			if (
				!stateChanged &&
				!this.needsMeasure &&
				!item.range.needsShow &&
				!item.range.needsHide
			) {
				continue;
			}
			this.writeElementState(item, frame);
		}
	}

	private writeElementState(item: ScrollElement, frame: Frame): void {
		const scrollState = item.range.isActive
			? "visible"
			: item.range.rawProgress <= 0
				? "before"
				: "after";
		setDataset(item.element, "scrollState", scrollState);
		setStyleProperty(item.element, "--scroll-progress", item.range.progress.toFixed(4));
		setStyleProperty(item.element, "--scroll-raw-progress", item.range.rawProgress.toFixed(4));
		setStyleProperty(item.element, "--scroll-show-ratio", item.range.showRatio.toFixed(4));
		setStyleProperty(item.element, "--scroll-hide-ratio", item.range.hideRatio.toFixed(4));
		if (item.cssProgress) {
			setStyleProperty(item.element, "--progress", item.range.progress.toFixed(4));
		}
		if (item.range.isActive) toggleClass(item.element, item.className, true);
		else if (item.repeat) toggleClass(item.element, item.className, false);
		if ((item.range.needsShow || item.range.needsHide) && item.callEvent) {
			this.dispatchScrollCall(item);
		}
		this.writeElementTransform(item, frame);
	}

	private writeScrollPosition(): void {
		if (this.writeY === undefined) return;
		const y = this.writeY;
		this.writeY = undefined;
		if (Math.abs(window.scrollY - y) <= 0.1) return;
		this.programmatic = true;
		window.scrollTo(0, y);
	}

	private writeElementTransform(item: ScrollElement, frame: Frame): void {
		if (item.speed === null) return;
		const allowTransform =
			!frame.profile.reducedMotion &&
			(!frame.profile.coarsePointer || item.enableTouchSpeed) &&
			item.interactive;
		if (!allowTransform) {
			removeStyleProperty(item.element, "transform");
			return;
		}
		const viewport = frame.profile.viewport.height || window.innerHeight;
		const value = fit(item.range.progress, 0, 1, -1, 1) * viewport * item.speed * -1;
		setStyleProperty(item.element, "transform", `translate3d(0, ${value.toFixed(3)}px, 0)`);
	}

	private dispatchScrollCall(item: ScrollElement): void {
		if (!item.callEvent) return;
		window.dispatchEvent(
			new CustomEvent(item.callEvent, {
				detail: {
					target: item.element,
					way: item.range.needsShow ? "enter" : "leave",
					progress: item.range.progress,
					rawProgress: item.range.rawProgress,
				},
			}),
		);
	}

	private resolveTargetY(target: number | string | HTMLElement, offset: number): number | null {
		if (typeof target === "number") return target + offset;
		const element = typeof target === "string" ? resolveTargetElement(target) : target;
		if (!element) return null;
		return element.getBoundingClientRect().top + window.scrollY + offset;
	}

	private readonly handleScroll = (): void => {
		if (this.programmatic) {
			if (Math.abs(window.scrollY - this.state.animated) > 2) {
				this.syncFromWindow("native", performance.now());
				return;
			}
			this.programmatic = false;
			return;
		}
		this.stopSmooth();
		this.source = "native";
	};

	private readonly handleWheelIntent = (intent: InputWheelIntent): void => {
		this.applyCapability(this.latestProfile);
		if (shouldUseNativeWheel(intent, this.smoothEnabled)) return;
		intent.preventDefault();
		this.startSmoothScroll(readSmoothWheelDeltaY(intent) * settings.scroll.wheelMultiplier);
	};

	private startSmoothScroll(deltaY: number): void {
		this.state.limit = this.measureLimit();
		if (!this.smoothActive) {
			const y = clamp(window.scrollY, 0, this.state.limit);
			this.smoothTarget = y;
			this.animator.sync(y);
		}
		this.smoothTarget = clamp(this.smoothTarget + deltaY, 0, this.state.limit);
		this.smoothActive = true;
		this.source = "wheel";
	}

	private stopSmooth(): void {
		if (!this.smoothActive) return;
		this.smoothActive = false;
		this.writeY = undefined;
		this.animator.sync(clamp(window.scrollY, 0, this.state.limit));
	}

	private readonly handleClickIntent = (intent: InputClickIntent): void => {
		if (!intent.isPrimary || intent.isModified || intent.defaultPrevented) return;
		const target = intent.target;
		if (!(target instanceof Element)) return;
		const trigger = target.closest<HTMLElement>(SCROLL_TO_SELECTOR);
		if (!trigger) return;
		if (trigger instanceof HTMLAnchorElement && !shouldEnhanceAnchor(trigger)) return;

		const targetValue =
			trigger.dataset["scrollToHref"] ??
			trigger.dataset["scrollTo"] ??
			(trigger instanceof HTMLAnchorElement ? trigger.getAttribute("href") : null);
		if (!targetValue || targetValue === "#") return;

		const samePageUrl =
			trigger instanceof HTMLAnchorElement ? resolveSamePageUrl(targetValue) : null;
		if (trigger instanceof HTMLAnchorElement && !samePageUrl) return;

		const selector = samePageUrl?.hash || targetValue;
		const element = resolveTargetElement(selector);
		if (!element) return;

		intent.preventDefault();
		const offset = Number.parseFloat(trigger.dataset["scrollToOffset"] ?? "0");
		this.scrollTo(element, {
			offset: Number.isFinite(offset) ? offset : 0,
			immediate: trigger.dataset["scrollToImmediate"] !== undefined,
		});
		if (samePageUrl?.hash) setRouteHash(samePageUrl.hash);
		focusElement(element);
	};
}

const hasStateChanged = (previous: ScrollState, next: ScrollState): boolean =>
	previous.actual !== next.actual ||
	previous.target !== next.target ||
	previous.animated !== next.animated ||
	previous.limit !== next.limit ||
	previous.progress !== next.progress ||
	previous.isScrolling !== next.isScrolling ||
	previous.isSmoothEnabled !== next.isSmoothEnabled ||
	previous.direction !== next.direction ||
	previous.source !== next.source;

class ScrollAnimator {
	value = 0;
	target = 0;
	velocity = 0;
	running = false;

	sync(value: number): void {
		this.value = value;
		this.target = value;
		this.velocity = 0;
		this.running = false;
	}

	retarget(target: number): void {
		this.target = target;
		this.running = true;
	}

	advance(dt: number): boolean {
		if (!this.running) return true;
		const previous = this.value;
		this.value = damp(this.value, this.target, settings.scroll.lambda, dt);
		this.velocity = dt > 0 ? (this.value - previous) / dt : 0;
		const settled =
			Math.abs(this.target - this.value) <= settings.scroll.settlePx &&
			Math.abs(this.velocity) <= settings.scroll.settlePx * 120;
		if (!settled) return false;
		this.value = this.target;
		this.velocity = 0;
		this.running = false;
		return true;
	}
}

const readSmoothWheelDeltaY = (intent: InputWheelIntent): number =>
	intent.deltaMode === WheelEvent.DOM_DELTA_PAGE
		? intent.dy * settings.scroll.pageMultiplier
		: intent.dy;

const shouldUseNativeWheel = (intent: InputWheelIntent, enabled: boolean): boolean => {
	if (!enabled || intent.defaultPrevented) return true;
	if (intent.ctrlKey || intent.metaKey || intent.shiftKey) return true;
	if (!(intent.target instanceof Element)) return false;
	return Boolean(intent.target.closest(NATIVE_SCROLL_SELECTOR));
};

const splitPair = (value = ""): [string, string] => {
	const [first = "0", second = "0"] = value.split(",").map((part) => part.trim());
	return [first, second];
};

const parseViewportOffset = (value: string, viewport: number): number => {
	if (value.endsWith("%")) return (viewport * Number.parseFloat(value)) / 100;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const resolveStart = (item: ScrollElement, viewport: number): number => {
	const offset = parseViewportOffset(item.offsetStart, viewport);
	if (item.top < viewport && item.positionStart !== "fold") return 0;
	if (item.positionStart === "middle") return item.top - viewport + offset + item.height * 0.5;
	if (item.positionStart === "end") return item.top - viewport + offset + item.height;
	if (item.positionStart === "fold") return 0;
	return item.top - viewport + offset;
};

const resolveEnd = (item: ScrollElement): number => {
	const offset = parseViewportOffset(item.offsetEnd, window.innerHeight);
	if (item.positionEnd === "start") return item.top - offset;
	if (item.positionEnd === "middle") return item.top - offset + item.height * 0.5;
	return item.top - offset + item.height;
};

const shouldEnhanceAnchor = (anchor: HTMLAnchorElement): boolean => {
	if (anchor.target && anchor.target !== "_self") return false;
	if (anchor.hasAttribute("download")) return false;
	return true;
};

const resolveSamePageUrl = (href: string): URL | null => {
	try {
		const url = new URL(href, window.location.href);
		if (url.origin !== window.location.origin) return null;
		if (url.pathname !== window.location.pathname || url.search !== window.location.search)
			return null;
		if (!url.hash) return null;
		return url;
	} catch {
		return null;
	}
};

const resolveTargetElement = (target: string): HTMLElement | null => {
	if (target.startsWith("#")) {
		const id = decodeHash(target);
		return id ? document.getElementById(id) : null;
	}
	try {
		const element = document.querySelector(target);
		return element instanceof HTMLElement ? element : null;
	} catch {
		return null;
	}
};

const decodeHash = (hash: string): string => {
	try {
		return decodeURIComponent(hash.slice(1));
	} catch {
		return hash.slice(1);
	}
};

export const scroll = new Scroll();
export const getScrollState = (): ScrollState => scroll.getState();
export const applyScrollSettings = (): void => scroll.applySettings();
export const scrollTo = (target: number | string | HTMLElement, options?: ScrollToOptions): void =>
	scroll.scrollTo(target, options);
