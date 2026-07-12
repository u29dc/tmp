import { BaseModule, type Context, type Frame } from "@/app/core/module";
import type { InputState, KeyboardState, PointerState, WheelState } from "@/app/core/state";
import { composedPath } from "@/app/utils/dom";

type InputIntentHandler<T> = (intent: T) => void;

export type InputWheelCancelRequest = {
	set: (enabled: boolean) => void;
	dispose: () => void;
};

type InputModifiers = {
	altKey: boolean;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	isModified: boolean;
};

export type InputWheelIntent = InputModifiers & {
	dx: number;
	dy: number;
	rawDx: number;
	rawDy: number;
	deltaMode: number;
	source: "wheel";
	cancelable: boolean;
	target: EventTarget | null;
	path: EventTarget[];
	readonly defaultPrevented: boolean;
	preventDefault: () => void;
};

export type InputClickIntent = InputModifiers & {
	button: number;
	isPrimary: boolean;
	target: EventTarget | null;
	path: EventTarget[];
	readonly defaultPrevented: boolean;
	preventDefault: () => void;
};

const emptyPointer = (): PointerState => ({
	x: 0,
	y: 0,
	nx: 0,
	ny: 0,
	dx: 0,
	dy: 0,
	vx: 0,
	vy: 0,
	isDown: false,
	wasPressed: false,
	wasReleased: false,
	activePointerType: "unknown",
	path: [],
});

const emptyWheel = (): WheelState => ({
	dx: 0,
	dy: 0,
	source: "none",
});

const emptyKeyboard = (): KeyboardState => ({
	lastKey: "",
	hadKeyboardInput: false,
	activeKeys: [],
});

const createInputState = (): InputState => ({
	generation: 0,
	pointer: emptyPointer(),
	wheel: emptyWheel(),
	keyboard: emptyKeyboard(),
});

const keyboardKeyId = (event: KeyboardEvent): string => (event.code.length > 0 ? event.code : `key:${event.key}`);

class Input extends BaseModule {
	readonly name = "input";

	private state = createInputState();
	private previousX = 0;
	private previousY = 0;
	private pointerBaselineValid = false;
	private generation = 0;
	private activeKeys = new Map<string, string>();
	private readonly wheelHandlers = new Set<InputIntentHandler<InputWheelIntent>>();
	private readonly wheelCancelRequests = new Set<symbol>();
	private readonly clickHandlers = new Set<InputIntentHandler<InputClickIntent>>();
	private wheelListenerBound = false;
	private wheelListenerCancelable = false;

	override preInit(context: Context): void {
		super.preInit(context);
		document.addEventListener("pointermove", this.handlePointerMove, { passive: true });
		document.addEventListener("pointerdown", this.handlePointerDown, { passive: true });
		document.addEventListener("pointerup", this.handlePointerUp, { passive: true });
		document.addEventListener("pointercancel", this.handlePointerCancel, { passive: true });
		document.addEventListener("pointerout", this.handlePointerOut, { passive: true });
		this.bindWheelListener(this.wheelCancelRequests.size > 0);
		document.addEventListener("click", this.handleClick);
		document.addEventListener("keydown", this.handleKeyDown);
		document.addEventListener("keyup", this.handleKeyUp);
		window.addEventListener("blur", this.handleInputLoss, { passive: true });
		window.addEventListener("pagehide", this.handleInputLoss, { passive: true });
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
		this.addCleanup(() => document.removeEventListener("pointermove", this.handlePointerMove));
		this.addCleanup(() => document.removeEventListener("pointerdown", this.handlePointerDown));
		this.addCleanup(() => document.removeEventListener("pointerup", this.handlePointerUp));
		this.addCleanup(() => document.removeEventListener("pointercancel", this.handlePointerCancel));
		this.addCleanup(() => document.removeEventListener("pointerout", this.handlePointerOut));
		this.addCleanup(() => this.unbindWheelListener());
		this.addCleanup(() => document.removeEventListener("click", this.handleClick));
		this.addCleanup(() => document.removeEventListener("keydown", this.handleKeyDown));
		this.addCleanup(() => document.removeEventListener("keyup", this.handleKeyUp));
		this.addCleanup(() => window.removeEventListener("blur", this.handleInputLoss));
		this.addCleanup(() => window.removeEventListener("pagehide", this.handleInputLoss));
		this.addCleanup(() => document.removeEventListener("visibilitychange", this.handleVisibilityChange));
	}

	override init(context: Context): void {
		super.init(context);
	}

	override refresh(context: Context): void {
		super.refresh(context);
		this.clearTransientInput();
	}

	override resize(context: Context): void {
		super.resize(context);
	}

	override update(frame: Frame): void {
		super.update(frame);
	}

	postUpdate(_frame: Frame): void {
		this.state = {
			...this.state,
			pointer: {
				...this.state.pointer,
				dx: 0,
				dy: 0,
				vx: 0,
				vy: 0,
				wasPressed: false,
				wasReleased: false,
			},
			wheel: emptyWheel(),
			keyboard: {
				...this.state.keyboard,
				hadKeyboardInput: false,
			},
		};
	}

	override dispose(): void {
		this.pointerBaselineValid = false;
		this.wheelHandlers.clear();
		this.wheelCancelRequests.clear();
		this.clickHandlers.clear();
		super.dispose();
	}

	getState(): InputState {
		return this.state;
	}

	hasPathElement(element: Element): boolean {
		return this.state.pointer.path.includes(element);
	}

	onWheelIntent(handler: InputIntentHandler<InputWheelIntent>): () => void {
		this.wheelHandlers.add(handler);
		return () => this.wheelHandlers.delete(handler);
	}

	createWheelCancelRequest(): InputWheelCancelRequest {
		const token = Symbol("wheel-cancel");
		let disposed = false;
		return {
			set: (enabled) => {
				if (disposed) return;
				if (enabled) this.wheelCancelRequests.add(token);
				else this.wheelCancelRequests.delete(token);
				this.syncWheelListener();
			},
			dispose: () => {
				if (disposed) return;
				disposed = true;
				this.wheelCancelRequests.delete(token);
				this.syncWheelListener();
			},
		};
	}

	onClickIntent(handler: InputIntentHandler<InputClickIntent>): () => void {
		this.clickHandlers.add(handler);
		return () => this.clickHandlers.delete(handler);
	}

	private nextGeneration(): number {
		this.generation += 1;
		return this.generation;
	}

	private activeKeyValues(): string[] {
		return Array.from(new Set(this.activeKeys.values()));
	}

	private bindWheelListener(cancelable: boolean): void {
		if (this.wheelListenerBound) document.removeEventListener("wheel", this.handleWheel);
		document.addEventListener("wheel", this.handleWheel, { passive: !cancelable });
		this.wheelListenerBound = true;
		this.wheelListenerCancelable = cancelable;
	}

	private unbindWheelListener(): void {
		if (!this.wheelListenerBound) return;
		document.removeEventListener("wheel", this.handleWheel);
		this.wheelListenerBound = false;
		this.wheelListenerCancelable = false;
	}

	private syncWheelListener(): void {
		if (!this.wheelListenerBound) return;
		const cancelable = this.wheelCancelRequests.size > 0;
		if (cancelable === this.wheelListenerCancelable) return;
		this.bindWheelListener(cancelable);
	}

	private updatePointer(event: PointerEvent, options?: { pressed?: boolean; released?: boolean }): void {
		const x = event.clientX;
		const y = event.clientY;
		const dx = this.pointerBaselineValid ? x - this.previousX : 0;
		const dy = this.pointerBaselineValid ? y - this.previousY : 0;
		this.previousX = x;
		this.previousY = y;
		this.pointerBaselineValid = true;
		const width = window.innerWidth || 1;
		const height = window.innerHeight || 1;
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			pointer: {
				x,
				y,
				nx: (x / width) * 2 - 1,
				ny: 1 - (y / height) * 2,
				dx,
				dy,
				vx: dx,
				vy: dy,
				isDown: options?.released ? false : options?.pressed ? true : this.state.pointer.isDown,
				wasPressed: this.state.pointer.wasPressed || options?.pressed === true,
				wasReleased: this.state.pointer.wasReleased || options?.released === true,
				activePointerType: event.pointerType || "unknown",
				path: composedPath(event),
			},
		};
	}

	private clearTransientInput(): void {
		this.pointerBaselineValid = false;
		const pointer = this.state.pointer;
		const keyboard = this.state.keyboard;
		const wheel = this.state.wheel;
		const hasTransientInput =
			pointer.isDown ||
			pointer.wasPressed ||
			pointer.wasReleased ||
			pointer.dx !== 0 ||
			pointer.dy !== 0 ||
			pointer.vx !== 0 ||
			pointer.vy !== 0 ||
			pointer.path.length > 0 ||
			this.activeKeys.size > 0 ||
			keyboard.hadKeyboardInput ||
			keyboard.activeKeys.length > 0 ||
			wheel.source !== "none";
		if (!hasTransientInput) return;
		this.activeKeys.clear();
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			pointer: {
				...this.state.pointer,
				dx: 0,
				dy: 0,
				vx: 0,
				vy: 0,
				isDown: false,
				wasPressed: false,
				wasReleased: false,
				path: [],
			},
			wheel: emptyWheel(),
			keyboard: {
				...this.state.keyboard,
				hadKeyboardInput: false,
				activeKeys: [],
			},
		};
		this.requestFrame("input:release");
	}

	private readonly handlePointerMove = (event: PointerEvent): void => {
		this.updatePointer(event);
		this.requestFrame("input:pointer");
	};

	private readonly handlePointerDown = (event: PointerEvent): void => {
		this.updatePointer(event, { pressed: true });
		this.requestFrame("input:pointer");
	};

	private readonly handlePointerUp = (event: PointerEvent): void => {
		this.updatePointer(event, { released: true });
		this.requestFrame("input:pointer");
	};

	private readonly handlePointerCancel = (event: PointerEvent): void => {
		this.updatePointer(event, { released: true });
		this.pointerBaselineValid = false;
		this.requestFrame("input:pointer");
	};

	private readonly handlePointerOut = (event: PointerEvent): void => {
		if (event.relatedTarget !== null) return;
		this.clearTransientInput();
	};

	private readonly handleWheel = (event: WheelEvent): void => {
		const dx = normalizeWheelDelta(event.deltaX, event.deltaMode, window.innerWidth);
		const dy = normalizeWheelDelta(event.deltaY, event.deltaMode, window.innerHeight);
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			wheel: {
				dx: this.state.wheel.dx + dx,
				dy: this.state.wheel.dy + dy,
				source: "wheel",
			},
		};
		try {
			this.emitWheelIntent(event, dx, dy);
		} finally {
			this.requestFrame("input:wheel");
		}
	};

	private readonly handleKeyDown = (event: KeyboardEvent): void => {
		this.activeKeys.set(keyboardKeyId(event), event.key);
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			keyboard: {
				lastKey: event.key,
				hadKeyboardInput: true,
				activeKeys: this.activeKeyValues(),
			},
		};
		this.requestFrame("input:keyboard");
	};

	private readonly handleKeyUp = (event: KeyboardEvent): void => {
		this.activeKeys.delete(keyboardKeyId(event));
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			keyboard: {
				lastKey: event.key,
				hadKeyboardInput: true,
				activeKeys: this.activeKeyValues(),
			},
		};
		this.requestFrame("input:keyboard");
	};

	private readonly handleClick = (event: MouseEvent): void => {
		const intent = createClickIntent(event);
		try {
			this.emitIntent("input.click", this.clickHandlers, intent);
		} finally {
			this.requestFrame("input:click");
		}
	};

	private readonly handleInputLoss = (): void => {
		this.clearTransientInput();
	};

	private readonly handleVisibilityChange = (): void => {
		if (document.visibilityState === "hidden") this.clearTransientInput();
	};

	private emitWheelIntent(event: WheelEvent, dx: number, dy: number): void {
		const intent = createWheelIntent(event, dx, dy, this.wheelListenerCancelable && event.cancelable);
		this.emitIntent("input.wheel", this.wheelHandlers, intent);
	}

	private emitIntent<T>(name: string, handlers: ReadonlySet<InputIntentHandler<T>>, intent: T): void {
		for (const handler of Array.from(handlers)) {
			try {
				handler(intent);
			} catch (error) {
				this.reportError(name, error);
			}
		}
	}
}

const LINE_HEIGHT = 100 / 6;

const normalizeWheelDelta = (delta: number, mode: number, size: number): number => {
	if (mode === WheelEvent.DOM_DELTA_LINE) return delta * LINE_HEIGHT;
	if (mode === WheelEvent.DOM_DELTA_PAGE) return delta * size;
	return delta;
};

const readModifiers = (event: Pick<MouseEvent | WheelEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">): InputModifiers => ({
	altKey: event.altKey,
	ctrlKey: event.ctrlKey,
	metaKey: event.metaKey,
	shiftKey: event.shiftKey,
	isModified: event.altKey || event.ctrlKey || event.metaKey || event.shiftKey,
});

const createWheelIntent = (event: WheelEvent, dx: number, dy: number, cancelable: boolean): InputWheelIntent => ({
	...readModifiers(event),
	dx,
	dy,
	rawDx: event.deltaX,
	rawDy: event.deltaY,
	deltaMode: event.deltaMode,
	source: "wheel",
	cancelable,
	target: event.target,
	path: composedPath(event),
	get defaultPrevented() {
		return event.defaultPrevented;
	},
	preventDefault: () => {
		if (cancelable) event.preventDefault();
	},
});

const createClickIntent = (event: MouseEvent): InputClickIntent => ({
	...readModifiers(event),
	button: event.button,
	isPrimary: event.button === 0,
	target: event.target,
	path: composedPath(event),
	get defaultPrevented() {
		return event.defaultPrevented;
	},
	preventDefault: () => event.preventDefault(),
});

export const input = new Input();
export const getInputState = (): InputState => input.getState();
export const onInputWheelIntent = (handler: InputIntentHandler<InputWheelIntent>): (() => void) => input.onWheelIntent(handler);
export const createInputWheelCancelRequest = (): InputWheelCancelRequest => input.createWheelCancelRequest();
export const onInputClickIntent = (handler: InputIntentHandler<InputClickIntent>): (() => void) => input.onClickIntent(handler);
