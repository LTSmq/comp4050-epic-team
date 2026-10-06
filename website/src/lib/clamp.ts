/** Restricts {@link value} to the inclusive range [{@link min}, {@link max}]. */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
