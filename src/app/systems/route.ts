import type {
	TransitionBeforePreparationEvent,
	TransitionBeforeSwapEvent,
} from "astro:transitions/client";
import { BaseModule, type Context, type Frame } from "@/app/core/module";
import type { RouteState } from "@/app/core/state";
import { setDataset } from "@/app/utils/dom";

export type RoutePreparation = {
	to: URL;
	signal: AbortSignal;
	fromPathname: string;
	toPathname: string;
};

export type RouteSwap = {
	newDocument: Document;
	wrapSwap: (wrapper: (swap: () => void) => void) => void;
};

type PreparationHandler = (event: RoutePreparation) => void | Promise<void>;
type SwapHandler = (event: RouteSwap) => void;
type RouteHandler = () => void;

const createRouteState = (): RouteState => ({
	pathname: typeof window === "undefined" ? "/" : window.location.pathname,
	hash: typeof window === "undefined" ? "" : window.location.hash,
	pageState: "idle",
	generation: 0,
});

class Route extends BaseModule {
	readonly name = "route";

	private state = createRouteState();
	private initialized = false;
	private readonly preparationHandlers = new Set<PreparationHandler>();
	private readonly beforeSwapHandlers = new Set<SwapHandler>();
	private readonly afterSwapHandlers = new Set<RouteHandler>();
	private readonly loadHandlers = new Set<RouteHandler>();
	private readonly abortHandlers = new Set<RouteHandler>();

	override preInit(context: Context): void {
		super.preInit(context);
		this.bindAstro();
		this.applyToDocument();
	}

	override init(context: Context): void {
		super.init(context);
		window.addEventListener("popstate", this.refreshFromWindow, { passive: true });
		window.addEventListener("hashchange", this.refreshFromWindow, { passive: true });
		this.addCleanup(() => window.removeEventListener("popstate", this.refreshFromWindow));
		this.addCleanup(() => window.removeEventListener("hashchange", this.refreshFromWindow));
		this.refreshFromWindow();
	}

	override resize(context: Context): void {
		super.resize(context);
	}

	override update(frame: Frame): void {
		super.update(frame);
	}

	override dispose(): void {
		this.preparationHandlers.clear();
		this.beforeSwapHandlers.clear();
		this.afterSwapHandlers.clear();
		this.loadHandlers.clear();
		this.abortHandlers.clear();
		super.dispose();
	}

	getState(): RouteState {
		return { ...this.state };
	}

	onPreparation(handler: PreparationHandler): () => void {
		this.preparationHandlers.add(handler);
		return () => this.preparationHandlers.delete(handler);
	}

	onBeforeSwap(handler: SwapHandler): () => void {
		this.beforeSwapHandlers.add(handler);
		return () => this.beforeSwapHandlers.delete(handler);
	}

	onAfterSwap(handler: RouteHandler): () => void {
		this.afterSwapHandlers.add(handler);
		return () => this.afterSwapHandlers.delete(handler);
	}

	onLoad(handler: RouteHandler): () => void {
		this.loadHandlers.add(handler);
		return () => this.loadHandlers.delete(handler);
	}

	onAbort(handler: RouteHandler): () => void {
		this.abortHandlers.add(handler);
		return () => this.abortHandlers.delete(handler);
	}

	setHash(hash: string): void {
		const nextHash = hash.startsWith("#") ? hash : `#${hash}`;
		if (nextHash === "#") return;
		if (window.location.hash !== nextHash) history.pushState(null, "", nextHash);
		this.refreshFromWindow();
	}

	private bindAstro(): void {
		if (this.initialized || typeof document === "undefined") return;
		this.initialized = true;

		document.addEventListener("astro:before-preparation", this.handleBeforePreparation);
		document.addEventListener("astro:before-swap", this.handleBeforeSwap);
		document.addEventListener("astro:after-swap", this.handleAfterSwap);
		document.addEventListener("astro:page-load", this.handlePageLoad);
		this.addCleanup(() =>
			document.removeEventListener("astro:before-preparation", this.handleBeforePreparation),
		);
		this.addCleanup(() =>
			document.removeEventListener("astro:before-swap", this.handleBeforeSwap),
		);
		this.addCleanup(() =>
			document.removeEventListener("astro:after-swap", this.handleAfterSwap),
		);
		this.addCleanup(() => document.removeEventListener("astro:page-load", this.handlePageLoad));
	}

	private setPageState(pageState: RouteState["pageState"], next?: Partial<RouteState>): void {
		this.state = {
			...this.state,
			...next,
			pageState,
			generation: this.state.generation + 1,
		};
		this.applyToDocument();
	}

	private applyToDocument(): void {
		const root = document.documentElement;
		setDataset(root, "routePathname", this.state.pathname);
		setDataset(root, "routeState", this.state.pageState);
	}

	private readonly refreshFromWindow = (): void => {
		this.state = {
			...this.state,
			pathname: window.location.pathname,
			hash: window.location.hash,
			generation: this.state.generation + 1,
		};
		this.applyToDocument();
	};

	private readonly handleBeforePreparation = (event: Event): void => {
		const transitionEvent = event as TransitionBeforePreparationEvent;
		const originalLoader = transitionEvent.loader;
		const fromPathname = this.state.pathname;
		const toPathname = transitionEvent.to.pathname;
		const exitWork = this.emitPreparation({
			to: transitionEvent.to,
			signal: transitionEvent.signal,
			fromPathname,
			toPathname,
		});

		transitionEvent.loader = async (): Promise<void> => {
			try {
				await originalLoader();
				await exitWork;
			} catch (error) {
				this.emitAbort();
				throw error;
			}
		};
	};

	private readonly handleBeforeSwap = (event: Event): void => {
		const transitionEvent = event as TransitionBeforeSwapEvent;
		let swap = transitionEvent.swap;
		this.setPageState("swapping");
		for (const handler of this.beforeSwapHandlers) {
			handler({
				newDocument: transitionEvent.newDocument,
				wrapSwap(wrapper) {
					const previous = swap;
					swap = () => wrapper(previous);
				},
			});
		}
		transitionEvent.swap = swap;
	};

	private readonly handleAfterSwap = (): void => {
		this.state = {
			...this.state,
			pathname: window.location.pathname,
			hash: window.location.hash,
			pageState: "entering",
			generation: this.state.generation + 1,
		};
		delete this.state.from;
		delete this.state.to;
		this.applyToDocument();
		for (const handler of this.afterSwapHandlers) handler();
	};

	private readonly handlePageLoad = (): void => {
		this.state = {
			...this.state,
			pathname: window.location.pathname,
			hash: window.location.hash,
			pageState: "loaded",
			generation: this.state.generation + 1,
		};
		this.applyToDocument();
		for (const handler of this.loadHandlers) handler();
		this.setPageState("idle");
	};

	private async emitPreparation(event: RoutePreparation): Promise<void> {
		this.setPageState("exiting", {
			from: event.fromPathname,
			to: event.toPathname,
		});
		await Promise.all(Array.from(this.preparationHandlers).map((handler) => handler(event)));
	}

	private emitAbort(): void {
		this.setPageState("idle");
		for (const handler of this.abortHandlers) handler();
	}
}

export const route = new Route();
export const getRouteState = (): RouteState => route.getState();
export const onRoutePreparation = (handler: PreparationHandler): (() => void) =>
	route.onPreparation(handler);
export const onRouteBeforeSwap = (handler: SwapHandler): (() => void) =>
	route.onBeforeSwap(handler);
export const onRouteAfterSwap = (handler: RouteHandler): (() => void) => route.onAfterSwap(handler);
export const onRouteLoad = (handler: RouteHandler): (() => void) => route.onLoad(handler);
export const onRouteAbort = (handler: RouteHandler): (() => void) => route.onAbort(handler);
export const setRouteHash = (hash: string): void => route.setHash(hash);
