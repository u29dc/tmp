import { type Context, type Frame } from "@/app/core/module";
import { SELECTORS } from "@/app/core/selectors";
import { Component } from "@/app/ui/base";

class Link extends Component {
	readonly name = "link";

	override preInit(context: Context): void {
		super.preInit(context);
		this.scan();
	}

	override init(context: Context): void {
		super.init(context);
	}

	override resize(context: Context): void {
		super.resize(context);
		this.scan();
	}

	override update(frame: Frame): void {
		super.update(frame);
		for (const state of this.states.values()) {
			this.updateStateFromInput(frame, state);
			this.writeInteractiveState(state);
		}
	}

	override dispose(): void {
		super.dispose();
	}

	private scan(): void {
		this.registerElements(Array.from(document.querySelectorAll<HTMLElement>(SELECTORS.link)));
	}
}

export const link = new Link();
