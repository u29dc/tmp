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
};

type TimerScheduler = (name: string, callback: () => void) => void;

const timers = new Map<number, TimerEntry>();
let nextTimerId = 0;
let scheduleTimerCallback: TimerScheduler = (_name, callback) => callback();

const inactiveTimer = (name: string): TimerHandle => ({
	id: 0,
	name,
	cancel: () => {},
	active: () => false,
});

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
	options?: { signal?: AbortSignal },
): TimerHandle => {
	if (options?.signal?.aborted) return inactiveTimer(name);

	nextTimerId += 1;
	const id = nextTimerId;
	const dueAt = performance.now() + Math.max(0, delayMs);

	const cancel = (): void => {
		const timer = timers.get(id);
		if (!timer || timer.cancelled) return;
		timer.cancelled = true;
		window.clearTimeout(timer.timeout);
		timers.delete(id);
		options?.signal?.removeEventListener("abort", cancel);
	};

	const timeout = window.setTimeout(
		() => {
			const timer = timers.get(id);
			if (!timer || timer.cancelled) return;
			timers.delete(id);
			options?.signal?.removeEventListener("abort", cancel);
			scheduleTimerCallback(`timer:${name}`, timer.callback);
		},
		Math.max(0, delayMs),
	);

	const entry: TimerEntry = {
		id,
		name,
		dueAt,
		timeout,
		callback,
		cancelled: false,
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

		timer = setTimer(name, delayMs, settle);
		signal?.addEventListener("abort", settle, { once: true });
	});
};
