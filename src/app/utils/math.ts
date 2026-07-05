export type EasingFunction = (t: number) => number;

const EPSILON = 0.000_001;

export const linear: EasingFunction = (t) => t;

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const saturate = (value: number): number => clamp(value, 0, 1);

export const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

export const unlerp = (min: number, max: number, value: number): number => {
	if (Math.abs(max - min) <= EPSILON) return 0;
	return (value - min) / (max - min);
};

export const normalize = (value: number, min: number, max: number): number => saturate(unlerp(min, max, value));

export const fit = (value: number, inMin: number, inMax: number, outMin: number, outMax: number, ease: EasingFunction = linear): number => lerp(outMin, outMax, ease(normalize(value, inMin, inMax)));

export const wrap = (value: number, min: number, max: number): number => {
	const range = max - min;
	if (Math.abs(range) <= EPSILON) return min;
	return ((((value - min) % range) + range) % range) + min;
};

export const smoothstep = (edge0: number, edge1: number, value: number): number => {
	const t = normalize(value, edge0, edge1);
	return t * t * (3 - 2 * t);
};

export const smootherstep = (edge0: number, edge1: number, value: number): number => {
	const t = normalize(value, edge0, edge1);
	return t * t * t * (t * (t * 6 - 15) + 10);
};

export const centerRatio = (value: number): number => 1 - Math.abs(saturate(value) * 2 - 1);

export const damp = (value: number, target: number, lambda: number, dt: number, epsilon = 0.001): number => {
	const next = lerp(value, target, 1 - Math.exp(-lambda * dt));
	return Math.abs(next - target) <= epsilon ? target : next;
};

export const signedDirection = (value: number): -1 | 0 | 1 => (value > 0 ? 1 : value < 0 ? -1 : 0);

export const finiteOr = (value: number, fallback = 0): number => (Number.isFinite(value) ? value : fallback);

export const parseFiniteFloat = (value: string | undefined, fallback = 0): number => {
	if (value === undefined) return fallback;
	const parsed = Number.parseFloat(value);
	return finiteOr(parsed, fallback);
};

export const fixed = (value: number, digits: number, fallback = 0): string => finiteOr(value, fallback).toFixed(digits);

export const distance = (x: number, y: number): number => Math.hypot(x, y);

export const distanceSquared = (x: number, y: number): number => x * x + y * y;

export const normalizeAngle = (angle: number): number => wrap(angle + Math.PI, 0, Math.PI * 2) - Math.PI;

export const closestAngleTo = (from: number, to: number): number => from + normalizeAngle(to - from);

export const randomRange = (min: number, max: number, random = Math.random): number => lerp(min, max, random());

export const easeQuadIn: EasingFunction = (t) => t * t;
export const easeQuadOut: EasingFunction = (t) => t * (2 - t);
export const easeQuadInOut: EasingFunction = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export const easeCubicIn: EasingFunction = (t) => t * t * t;
export const easeCubicOut: EasingFunction = (t) => 1 - (1 - t) ** 3;
export const easeCubicInOut: EasingFunction = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export const easeQuartIn: EasingFunction = (t) => t * t * t * t;
export const easeQuartOut: EasingFunction = (t) => 1 - (1 - t) ** 4;
export const easeQuartInOut: EasingFunction = (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - (-2 * t + 2) ** 4 / 2);

export const easeSineIn: EasingFunction = (t) => 1 - Math.cos((t * Math.PI) / 2);
export const easeSineOut: EasingFunction = (t) => Math.sin((t * Math.PI) / 2);
export const easeSineInOut: EasingFunction = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

export const easeExpoIn: EasingFunction = (t) => (t === 0 ? 0 : 2 ** (10 * t - 10));
export const easeExpoOut: EasingFunction = (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t));
export const easeExpoInOut: EasingFunction = (t) => {
	if (t === 0 || t === 1) return t;
	return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
};

export const easeBackIn: EasingFunction = (t) => {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	return c3 * t * t * t - c1 * t * t;
};

export const easeBackOut: EasingFunction = (t) => {
	const c1 = 1.70158;
	const c3 = c1 + 1;
	return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

export const easeBackInOut: EasingFunction = (t) => {
	const c1 = 1.70158;
	const c2 = c1 * 1.525;
	return t < 0.5 ? ((2 * t) ** 2 * ((c2 + 1) * 2 * t - c2)) / 2 : ((2 * t - 2) ** 2 * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
};

export const cubicBezier = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
	const c = (p1 - p0) * 3;
	const b = (p2 - p1) * 3 - c;
	const a = p3 - p0 - c - b;
	return ((a * t + b) * t + c) * t + p0;
};

export const createCubicBezier =
	(p0: number, p1: number, p2: number, p3: number): EasingFunction =>
	(t) =>
		cubicBezier(p0, p1, p2, p3, t);

export const ease = {
	linear,
	quadIn: easeQuadIn,
	quadOut: easeQuadOut,
	quadInOut: easeQuadInOut,
	cubicIn: easeCubicIn,
	cubicOut: easeCubicOut,
	cubicInOut: easeCubicInOut,
	quartIn: easeQuartIn,
	quartOut: easeQuartOut,
	quartInOut: easeQuartInOut,
	sineIn: easeSineIn,
	sineOut: easeSineOut,
	sineInOut: easeSineInOut,
	expoIn: easeExpoIn,
	expoOut: easeExpoOut,
	expoInOut: easeExpoInOut,
	backIn: easeBackIn,
	backOut: easeBackOut,
	backInOut: easeBackInOut,
};
