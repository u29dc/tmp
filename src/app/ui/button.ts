import { type Context, type Frame } from "@/app/core/module";
import { SELECTORS } from "@/app/core/selectors";
import { Component } from "@/app/ui/base";

class Button extends Component {
	readonly name = "button";

	override preInit(context: Context): void {
		super.preInit(context);
		this.scan();
	}

	override init(context: Context): void {
		super.init(context);
	}

	override refresh(context: Context): void {
		super.refresh(context);
		this.scan();
	}

	override resize(context: Context): void {
		super.resize(context);
	}

	override update(frame: Frame): boolean | void {
		let needsFrame = false;
		for (const state of this.states.values()) {
			needsFrame = this.updateStateFromInput(frame, state) || needsFrame;
			this.writeInteractiveState(state);
		}
		return needsFrame;
	}

	override dispose(): void {
		super.dispose();
	}

	private scan(): void {
		this.registerElements(Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.button)));
	}
}

export const button = new Button();
