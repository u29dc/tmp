import type {
	TransitionBeforePreparationEvent,
	TransitionBeforeSwapEvent,
} from "astro:transitions/client";
import { BaseModule, type Context, type Frame } from "@/app/core/module";
import type { RouteState } from "@/app/core/state";
import { setDataset } from "@/app/utils/dom";

export type RoutePreparation = {
	id: number;
	to: URL;
	signal: AbortSignal;
	fromPathname: string;
	toPathname: string;
};

export type RouteSwap = {
	id: number;
	newDocument: Document;
	wrapSwap: (wrapper: (swap: () => void) => void) => void;
};

export type RouteEvent = {
	id: number;
};

type PreparationHandler = (event: RoutePreparation) => void | Promise<void>;
type SwapHandler = (event: RouteSwap) => void;
type RouteHandler = (event: RouteEvent) => void;

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
	private nextTransitionId = 0;
	private activeTransitionId: number | undefined;
	private readonly transitionIds = new WeakMap<AbortSignal, number>();

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
		this.initialized = false;
		this.activeTransitionId = undefined;
		this.nextTransitionId = 0;
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
		this.requestFrame(`route:${pageState}`);
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
		this.requestFrame("route:url");
	};

	private readonly handleBeforePreparation = (event: Event): void => {
		const transitionEvent = event as TransitionBeforePreparationEvent;
		const originalLoader = transitionEvent.loader;
		const fromPathname = this.state.pathname;
		const toPathname = transitionEvent.to.pathname;
		const id = this.createTransitionId(transitionEvent.signal);
		let aborted = false;
		const abortTransition = (): void => {
			if (aborted) return;
			aborted = true;
			this.emitAbort(id);
		};
		const exitWork = this.emitPreparation({
			id,
			to: transitionEvent.to,
			signal: transitionEvent.signal,
			fromPathname,
			toPathname,
		}).catch((error: unknown) => {
			abortTransition();
			throw error;
		});
		void exitWork.catch(() => undefined);

		transitionEvent.loader = async (): Promise<void> => {
			try {
				await Promise.all([originalLoader(), exitWork]);
				this.assertActiveTransition(id, transitionEvent.signal);
			} catch (error) {
				abortTransition();
				throw error;
			}
		};
	};

	private readonly handleBeforeSwap = (event: Event): void => {
		const transitionEvent = event as TransitionBeforeSwapEvent;
		const id = this.readTransitionId(transitionEvent.signal);
		if (!this.isActiveTransition(id)) return;
		let swap = transitionEvent.swap;
		this.setPageState("swapping");
		for (const handler of this.beforeSwapHandlers) {
			handler({
				id,
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
		const id = this.activeTransitionId;
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
		this.emitRouteHandlers("route.afterSwap", this.afterSwapHandlers, { id: id ?? 0 });
		this.requestFrame("route:after-swap");
	};

	private readonly handlePageLoad = (): void => {
		const id = this.activeTransitionId;
		this.state = {
			...this.state,
			pathname: window.location.pathname,
			hash: window.location.hash,
			pageState: "loaded",
			generation: this.state.generation + 1,
		};
		this.applyToDocument();
		try {
			this.emitRouteHandlers("route.load", this.loadHandlers, { id: id ?? 0 });
		} finally {
			this.requestFrame("route:page-load");
			this.setPageState("idle");
			this.activeTransitionId = undefined;
		}
	};

	private async emitPreparation(event: RoutePreparation): Promise<void> {
		if (!this.isActiveTransition(event.id)) return;
		this.setPageState("exiting", {
			from: event.fromPathname,
			to: event.toPathname,
		});
		await Promise.all(Array.from(this.preparationHandlers).map((handler) => handler(event)));
	}

	private emitAbort(id: number): void {
		if (!this.isActiveTransition(id)) return;
		this.setPageState("idle");
		this.activeTransitionId = undefined;
		this.emitRouteHandlers("route.abort", this.abortHandlers, { id });
	}

	private emitRouteHandlers(
		name: string,
		handlers: ReadonlySet<RouteHandler>,
		event: RouteEvent,
	): void {
		for (const handler of Array.from(handlers)) {
			try {
				handler(event);
			} catch (error) {
				this.reportError(name, error);
			}
		}
	}

	private createTransitionId(signal: AbortSignal): number {
		this.nextTransitionId += 1;
		const id = this.nextTransitionId;
		this.activeTransitionId = id;
		this.transitionIds.set(signal, id);
		return id;
	}

	private readTransitionId(signal?: AbortSignal): number {
		return (signal && this.transitionIds.get(signal)) || this.activeTransitionId || 0;
	}

	private isActiveTransition(id: number | undefined): id is number {
		return id !== undefined && id !== 0 && id === this.activeTransitionId;
	}

	private assertActiveTransition(id: number, signal: AbortSignal): void {
		if (this.isActiveTransition(id)) return;
		if (signal.aborted) {
			throw signal.reason instanceof Error
				? signal.reason
				: new DOMException("Route transition aborted", "AbortError");
		}
		throw new DOMException("Route transition superseded", "AbortError");
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
