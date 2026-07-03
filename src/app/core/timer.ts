export type TimerHandle = {
	id: number;
	name: string;
	cancel: () => void;
	active: () => boolean;
};

type TimerEntry = {
	id: number;
	name: string;
	dueAt: number;
	timeout: number;
	callback: () => void;
	cancelled: boolean;
	cancelScheduled?: () => void;
	removeAbortListener?: () => void;
	onCancel?: () => void;
};

type TimerScheduler = (name: string, callback: () => void) => void | (() => void);

const timers = new Map<number, TimerEntry>();
let nextTimerId = 0;
let scheduleTimerCallback: TimerScheduler = (_name, callback) => callback();

const inactiveTimer = (name: string): TimerHandle => ({
	id: 0,
	name,
	cancel: () => {},
	active: () => false,
});

const cancelTimer = (timer: TimerEntry): void => {
	if (timer.cancelled) return;
	timer.cancelled = true;
	window.clearTimeout(timer.timeout);
	timer.cancelScheduled?.();
	timer.removeAbortListener?.();
	timers.delete(timer.id);
	timer.onCancel?.();
};

export const setTimerScheduler = (scheduler: TimerScheduler): (() => void) => {
	scheduleTimerCallback = scheduler;
	return () => {
		if (scheduleTimerCallback === scheduler) {
			scheduleTimerCallback = (_name, callback) => callback();
		}
	};
};

export const setTimer = (
	name: string,
	delayMs: number,
	callback: () => void,
	options?: { signal?: AbortSignal; onCancel?: () => void },
): TimerHandle => {
	if (options?.signal?.aborted) return inactiveTimer(name);

	nextTimerId += 1;
	const id = nextTimerId;
	const dueAt = performance.now() + Math.max(0, delayMs);
	let entry: TimerEntry;

	const cancel = (): void => {
		const timer = timers.get(id);
		if (timer) cancelTimer(timer);
	};

	const timeout = window.setTimeout(
		() => {
			const timer = timers.get(id);
			if (!timer || timer.cancelled) return;
			const cancelScheduled = scheduleTimerCallback(`timer:${name}`, () => {
				const scheduledTimer = timers.get(id);
				if (!scheduledTimer || scheduledTimer.cancelled) return;
				scheduledTimer.cancelled = true;
				scheduledTimer.removeAbortListener?.();
				timers.delete(id);
				scheduledTimer.callback();
			});
			if (cancelScheduled) timer.cancelScheduled = cancelScheduled;
		},
		Math.max(0, delayMs),
	);

	entry = {
		id,
		name,
		dueAt,
		timeout,
		callback,
		cancelled: false,
		...(options?.onCancel ? { onCancel: options.onCancel } : {}),
		...(options?.signal
			? {
					removeAbortListener: () => options.signal?.removeEventListener("abort", cancel),
				}
			: {}),
	};

	timers.set(id, entry);
	options?.signal?.addEventListener("abort", cancel, { once: true });

	return {
		id,
		name,
		cancel,
		active: () => timers.has(id) && !entry.cancelled,
	};
};

export const cancelRuntimeTimers = (): void => {
	for (const timer of Array.from(timers.values())) cancelTimer(timer);
};

export const delayTimer = (name: string, delayMs: number, signal?: AbortSignal): Promise<void> => {
	if (delayMs <= 0 || signal?.aborted) return Promise.resolve();

	return new Promise((resolve) => {
		let timer: TimerHandle | undefined;
		let settled = false;
		const settle = (): void => {
			if (settled) return;
			settled = true;
			signal?.removeEventListener("abort", settle);
			timer?.cancel();
			resolve();
		};

		timer = setTimer(name, delayMs, settle, {
			...(signal ? { signal } : {}),
			onCancel: settle,
		});
	});
};
