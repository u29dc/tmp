import { BaseModule, type Context, type Frame } from "@/app/core/module";
import { button } from "@/app/ui/button";
import { link } from "@/app/ui/link";

class UI extends BaseModule {
	readonly name = "ui";

	override preInit(context: Context): void {
		super.preInit(context);
		button.preInit(context);
		link.preInit(context);
	}

	override init(context: Context): void {
		super.init(context);
		button.init(context);
		link.init(context);
	}

	override resize(context: Context): void {
		super.resize(context);
		button.resize(context);
		link.resize(context);
	}

	override update(frame: Frame): void {
		super.update(frame);
		button.update(frame);
		link.update(frame);
	}

	override dispose(): void {
		link.dispose();
		button.dispose();
		super.dispose();
	}
}

export const ui = new UI();
