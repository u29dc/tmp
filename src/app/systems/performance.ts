import { BaseModule, type Context, type Frame } from "@/app/core/module";

type LongTaskEntry = PerformanceEntry & {
	duration: number;
};

export type PerformanceState = {
	frameCount: number;
	lastFrameMs: number;
	averageFrameMs: number;
	maxFrameMs: number;
	longFrameCount: number;
	longTaskCount: number;
};

const LONG_FRAME_MS = 50;
const AVERAGE_WEIGHT = 0.08;

class Performance extends BaseModule {
	readonly name = "performance";

	private observer: PerformanceObserver | undefined;
	private frameStartedAt = 0;
	private state: PerformanceState = {
		frameCount: 0,
		lastFrameMs: 0,
		averageFrameMs: 0,
		maxFrameMs: 0,
		longFrameCount: 0,
		longTaskCount: 0,
	};

	override preInit(context: Context): void {
		super.preInit(context);
		if ("PerformanceObserver" in window) {
			try {
				this.observer = new PerformanceObserver((list) => {
					for (const entry of list.getEntries() as LongTaskEntry[]) {
						if (entry.duration > LONG_FRAME_MS) {
							this.state = {
								...this.state,
								longTaskCount: this.state.longTaskCount + 1,
							};
						}
					}
				});
				this.observer.observe({ entryTypes: ["longtask"] });
				this.addCleanup(() => this.observer?.disconnect());
			} catch {
				this.observer = undefined;
			}
		}
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

	beginFrame(_frame: Frame): void {
		this.frameStartedAt = performance.now();
	}

	endFrame(_frame: Frame): void {
		if (this.frameStartedAt === 0) return;
		const duration = performance.now() - this.frameStartedAt;
		this.frameStartedAt = 0;
		const frameCount = this.state.frameCount + 1;
		const averageFrameMs = this.state.averageFrameMs === 0 ? duration : this.state.averageFrameMs + (duration - this.state.averageFrameMs) * AVERAGE_WEIGHT;
		this.state = {
			...this.state,
			frameCount,
			lastFrameMs: duration,
			averageFrameMs,
			maxFrameMs: Math.max(this.state.maxFrameMs, duration),
			longFrameCount: duration > LONG_FRAME_MS ? this.state.longFrameCount + 1 : this.state.longFrameCount,
		};
	}

	override dispose(): void {
		super.dispose();
	}

	getState(): PerformanceState {
		return { ...this.state };
	}
}

export const performanceMonitor = new Performance();
export const getPerformanceState = (): PerformanceState => performanceMonitor.getState();
