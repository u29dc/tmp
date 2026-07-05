import { BaseModule, type Context, type Frame } from "@/app/core/module";
import { settings } from "@/app/core/settings";
import { setDataset, setStyleProperty } from "@/app/utils/dom";
import { damp, fixed } from "@/app/utils/math";

export type InteractiveState = {
	element: HTMLElement;
	isHovered: boolean;
	isFocused: boolean;
	isPressed: boolean;
	isDisabled: boolean;
	isCurrent: boolean;
	hoverRatio: number;
	focusRatio: number;
	pressRatio: number;
	activeRatio: number;
	hoverFrames: number;
	focusFrames: number;
	pressFrames: number;
	releaseFrames: number;
	settlingFrames: number;
	changed: boolean;
};

export abstract class Component extends BaseModule {
	protected readonly states = new Map<HTMLElement, InteractiveState>();

	override preInit(context: Context): void {
		super.preInit(context);
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

	override dispose(): void {
		super.dispose();
		this.states.clear();
	}

	protected registerElements(elements: HTMLElement[]): void {
		const nextElements = new Set(elements);
		for (const element of this.states.keys()) {
			if (!nextElements.has(element)) this.states.delete(element);
		}

		for (const element of elements) {
			if (this.states.has(element)) continue;
			this.states.set(element, {
				element,
				isHovered: false,
				isFocused: false,
				isPressed: false,
				isDisabled: false,
				isCurrent: false,
				hoverRatio: 0,
				focusRatio: 0,
				pressRatio: 0,
				activeRatio: 0,
				hoverFrames: 0,
				focusFrames: 0,
				pressFrames: 0,
				releaseFrames: 0,
				settlingFrames: 0,
				changed: true,
			});
		}
	}

	protected updateStateFromInput(frame: Frame, state: InteractiveState): boolean {
		const wasHovered = state.isHovered;
		const wasFocused = state.isFocused;
		const wasPressed = state.isPressed;
		const wasDisabled = state.isDisabled;
		const wasCurrent = state.isCurrent;
		const disabled = isDisabled(state.element);
		const current = isCurrent(state.element);
		const hovering = !disabled && frame.input.pointer.path.includes(state.element);
		const focused = !disabled && document.activeElement === state.element;
		const keyboardPressed = focused && (frame.input.keyboard.activeKeys.includes("Enter") || frame.input.keyboard.activeKeys.includes(" "));
		const pressed = !disabled && ((hovering && frame.input.pointer.isDown) || keyboardPressed);

		state.isDisabled = disabled;
		state.isCurrent = current;
		state.isHovered = hovering;
		state.isFocused = focused;
		state.isPressed = pressed;
		state.hoverFrames = hovering ? state.hoverFrames + 1 : 0;
		state.focusFrames = focused ? state.focusFrames + 1 : 0;
		state.pressFrames = pressed ? state.pressFrames + 1 : 0;
		if (wasPressed && !pressed) state.releaseFrames = 1;
		else if (state.releaseFrames > 0 && state.pressRatio > 0) state.releaseFrames += 1;
		else if (state.pressRatio === 0) state.releaseFrames = 0;
		const nextHover = damp(state.hoverRatio, hovering ? 1 : 0, settings.interaction.ratioLambda, frame.dt);
		const nextFocus = damp(state.focusRatio, focused ? 1 : 0, settings.interaction.ratioLambda, frame.dt);
		const nextPress = damp(state.pressRatio, pressed ? 1 : 0, settings.interaction.pressLambda, frame.dt);
		const nextActive = damp(state.activeRatio, current || focused || hovering ? 1 : 0, settings.interaction.ratioLambda, frame.dt);
		const changed =
			state.changed ||
			Math.abs(nextHover - state.hoverRatio) > settings.interaction.settleEpsilon ||
			Math.abs(nextFocus - state.focusRatio) > settings.interaction.settleEpsilon ||
			Math.abs(nextPress - state.pressRatio) > settings.interaction.settleEpsilon ||
			Math.abs(nextActive - state.activeRatio) > settings.interaction.settleEpsilon ||
			wasHovered !== hovering ||
			wasFocused !== focused ||
			wasPressed !== pressed ||
			wasDisabled !== disabled ||
			wasCurrent !== current;
		state.hoverRatio = nextHover;
		state.focusRatio = nextFocus;
		state.pressRatio = nextPress;
		state.activeRatio = nextActive;
		state.settlingFrames = changed ? state.settlingFrames + 1 : 0;
		state.changed = changed;
		return changed;
	}

	protected writeInteractiveState(state: InteractiveState): void {
		if (!state.changed) return;
		setStyleProperty(state.element, "--ui-hover-ratio", fixed(state.hoverRatio, 4));
		setStyleProperty(state.element, "--ui-focus-ratio", fixed(state.focusRatio, 4));
		setStyleProperty(state.element, "--ui-active-ratio", fixed(state.activeRatio, 4));
		setStyleProperty(state.element, "--ui-press-scale", fixed(1 - state.pressRatio * (1 - settings.interaction.pressScale), 4));
		setDataset(state.element, "uiState", readUiState(state));
		state.changed = false;
	}
}

const isDisabled = (element: HTMLElement): boolean => element.matches(":disabled, [aria-disabled='true']");

const isCurrent = (element: HTMLElement): boolean => {
	const ariaCurrent = element.getAttribute("aria-current");
	return element.dataset["uiCurrent"] !== undefined || (ariaCurrent !== null && ariaCurrent !== "false");
};

const readUiState = (state: InteractiveState): string => {
	if (state.isDisabled) return "disabled";
	if (state.isPressed) return "pressed";
	if (state.isFocused) return "focused";
	if (state.isHovered) return "hovered";
	if (state.isCurrent) return "current";
	return "idle";
};
