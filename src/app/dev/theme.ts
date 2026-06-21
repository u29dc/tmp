import { getThemeColors, getThemeScheme } from "@/app/systems/theme";
import { setDataset, setStyleProperty } from "@/app/utils/dom";

export const applyDevPaneTheme = (element: HTMLElement): void => {
	const scheme = getThemeScheme();
	const colors = getThemeColors();
	element.style.colorScheme = scheme;
	setDataset(element, "theme", scheme);

	const softState = `color-mix(in srgb, ${colors.ink} 7%, transparent)`;
	const hoverState = `color-mix(in srgb, ${colors.ink} 12%, transparent)`;
	const focusState = `color-mix(in srgb, ${colors.ink} 17%, transparent)`;
	const activeState = `color-mix(in srgb, ${colors.ink} 22%, transparent)`;
	const buttonHover = `color-mix(in srgb, ${colors.ink} 88%, ${colors.ground})`;
	const buttonFocus = `color-mix(in srgb, ${colors.ink} 82%, ${colors.ground})`;
	const buttonActive = `color-mix(in srgb, ${colors.ink} 76%, ${colors.ground})`;

	setStyleProperty(element, "--tp-base-background-color", colors.panel);
	setStyleProperty(
		element,
		"--tp-base-shadow-color",
		scheme === "dark" ? "rgb(0 0 0 / 0.45)" : "rgb(0 0 0 / 0.12)",
	);
	setStyleProperty(element, "--tp-base-border-radius", "8px");
	setStyleProperty(
		element,
		"--tp-base-font-family",
		"var(--font-mono, SFMono-Regular, SF Mono, Consolas, Liberation Mono, Menlo, monospace)",
	);
	setStyleProperty(element, "--tp-blade-border-radius", "4px");
	setStyleProperty(element, "--tp-blade-value-width", "142px");
	setStyleProperty(element, "--tp-button-background-color", colors.ink);
	setStyleProperty(element, "--tp-button-background-color-hover", buttonHover);
	setStyleProperty(element, "--tp-button-background-color-focus", buttonFocus);
	setStyleProperty(element, "--tp-button-background-color-active", buttonActive);
	setStyleProperty(element, "--tp-button-foreground-color", colors.ground);
	setStyleProperty(element, "--tp-container-background-color", softState);
	setStyleProperty(element, "--tp-container-background-color-hover", hoverState);
	setStyleProperty(element, "--tp-container-background-color-focus", focusState);
	setStyleProperty(element, "--tp-container-background-color-active", activeState);
	setStyleProperty(element, "--tp-container-foreground-color", colors.ink);
	setStyleProperty(element, "--tp-input-background-color", softState);
	setStyleProperty(element, "--tp-input-background-color-hover", hoverState);
	setStyleProperty(element, "--tp-input-background-color-focus", focusState);
	setStyleProperty(element, "--tp-input-background-color-active", activeState);
	setStyleProperty(element, "--tp-input-foreground-color", colors.ink);
	setStyleProperty(element, "--tp-label-foreground-color", colors.muted);
	setStyleProperty(element, "--tp-monitor-background-color", softState);
	setStyleProperty(element, "--tp-monitor-foreground-color", colors.muted);
	setStyleProperty(element, "--tp-groove-foreground-color", softState);
};
