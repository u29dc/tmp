import { BaseModule, type Context, type Frame } from "@/app/core/module";
import type { InputState, KeyboardState, PointerState, WheelState } from "@/app/core/state";
import { composedPath } from "@/app/utils/dom";

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

class Input extends BaseModule {
	readonly name = "input";

	private state = createInputState();
	private previousX = 0;
	private previousY = 0;
	private generation = 0;
	private activeKeys = new Set<string>();

	override preInit(context: Context): void {
		super.preInit(context);
		document.addEventListener("pointermove", this.handlePointerMove, { passive: true });
		document.addEventListener("pointerdown", this.handlePointerDown, { passive: true });
		document.addEventListener("pointerup", this.handlePointerUp, { passive: true });
		document.addEventListener("pointercancel", this.handlePointerUp, { passive: true });
		document.addEventListener("wheel", this.handleWheel, { passive: true });
		document.addEventListener("keydown", this.handleKeyDown);
		document.addEventListener("keyup", this.handleKeyUp);
		this.addCleanup(() => document.removeEventListener("pointermove", this.handlePointerMove));
		this.addCleanup(() => document.removeEventListener("pointerdown", this.handlePointerDown));
		this.addCleanup(() => document.removeEventListener("pointerup", this.handlePointerUp));
		this.addCleanup(() => document.removeEventListener("pointercancel", this.handlePointerUp));
		this.addCleanup(() => document.removeEventListener("wheel", this.handleWheel));
		this.addCleanup(() => document.removeEventListener("keydown", this.handleKeyDown));
		this.addCleanup(() => document.removeEventListener("keyup", this.handleKeyUp));
	}

	override init(context: Context): void {
		super.init(context);
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
		super.dispose();
	}

	getState(): InputState {
		return this.state;
	}

	hasPathElement(element: Element): boolean {
		return this.state.pointer.path.includes(element);
	}

	private nextGeneration(): number {
		this.generation += 1;
		return this.generation;
	}

	private updatePointer(
		event: PointerEvent,
		options?: { pressed?: boolean; released?: boolean },
	): void {
		const x = event.clientX;
		const y = event.clientY;
		const dx = x - this.previousX;
		const dy = y - this.previousY;
		this.previousX = x;
		this.previousY = y;
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
				isDown: options?.released
					? false
					: options?.pressed
						? true
						: this.state.pointer.isDown,
				wasPressed: options?.pressed ?? false,
				wasReleased: options?.released ?? false,
				activePointerType: event.pointerType || "unknown",
				path: composedPath(event),
			},
		};
	}

	private readonly handlePointerMove = (event: PointerEvent): void => this.updatePointer(event);
	private readonly handlePointerDown = (event: PointerEvent): void =>
		this.updatePointer(event, { pressed: true });
	private readonly handlePointerUp = (event: PointerEvent): void =>
		this.updatePointer(event, { released: true });

	private readonly handleWheel = (event: WheelEvent): void => {
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			wheel: {
				dx: normalizeWheelDelta(event.deltaX, event.deltaMode, window.innerWidth),
				dy: normalizeWheelDelta(event.deltaY, event.deltaMode, window.innerHeight),
				source: "wheel",
			},
		};
	};

	private readonly handleKeyDown = (event: KeyboardEvent): void => {
		this.activeKeys.add(event.key);
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			keyboard: {
				lastKey: event.key,
				hadKeyboardInput: true,
				activeKeys: Array.from(this.activeKeys),
			},
		};
	};

	private readonly handleKeyUp = (event: KeyboardEvent): void => {
		this.activeKeys.delete(event.key);
		this.state = {
			...this.state,
			generation: this.nextGeneration(),
			keyboard: {
				lastKey: event.key,
				hadKeyboardInput: true,
				activeKeys: Array.from(this.activeKeys),
			},
		};
	};
}

const LINE_HEIGHT = 100 / 6;

const normalizeWheelDelta = (delta: number, mode: number, size: number): number => {
	if (mode === WheelEvent.DOM_DELTA_LINE) return delta * LINE_HEIGHT;
	if (mode === WheelEvent.DOM_DELTA_PAGE) return delta * size;
	return delta;
};

export const input = new Input();
export const getInputState = (): InputState => input.getState();
