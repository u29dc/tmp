export const toArray = <T extends Element>(nodes: Iterable<T> | ArrayLike<T>): T[] =>
	Array.from(nodes);

export const composedPath = (event: Event): EventTarget[] => {
	if (typeof event.composedPath === "function") return event.composedPath();
	const target = event.target;
	return target ? [target] : [];
};

export const isElement = (value: EventTarget | null): value is Element => value instanceof Element;

export const setDataset = (
	element: HTMLElement,
	key: string,
	value: string | number | boolean,
): boolean => {
	const next = String(value);
	if (element.dataset[key] === next) return false;
	element.dataset[key] = next;
	return true;
};

export const removeDataset = (element: HTMLElement, key: string): boolean => {
	if (element.dataset[key] === undefined) return false;
	delete element.dataset[key];
	return true;
};

export const setStyleProperty = (
	element: HTMLElement,
	property: string,
	value: string | number,
): boolean => {
	const next = String(value);
	if (element.style.getPropertyValue(property) === next) return false;
	element.style.setProperty(property, next);
	return true;
};

export const removeStyleProperty = (element: HTMLElement, property: string): boolean => {
	if (!element.style.getPropertyValue(property)) return false;
	element.style.removeProperty(property);
	return true;
};

export const toggleClass = (element: Element, className: string, enabled: boolean): boolean => {
	const hasClass = element.classList.contains(className);
	if (hasClass === enabled) return false;
	element.classList.toggle(className, enabled);
	return true;
};

export const focusElement = (element: HTMLElement): void => {
	const hadTabIndex = element.hasAttribute("tabindex");
	const previousTabIndex = element.getAttribute("tabindex");
	if (!isFocusable(element)) element.setAttribute("tabindex", "-1");
	element.focus({ preventScroll: true });
	if (hadTabIndex) {
		if (previousTabIndex === null) element.removeAttribute("tabindex");
		else element.setAttribute("tabindex", previousTabIndex);
	} else {
		element.removeAttribute("tabindex");
	}
};

const isFocusable = (element: HTMLElement): boolean => {
	if (element.matches(":disabled, [aria-disabled='true'], [hidden], [inert]")) return false;
	if (element.tabIndex >= 0) return true;
	return element.matches(
		"a[href], button, input, select, textarea, summary, iframe, audio[controls], video[controls], [contenteditable='true']",
	);
};
