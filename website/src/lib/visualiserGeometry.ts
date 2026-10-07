import type { Vector3Like } from "three";
import type { Package } from "./visualiserState";

/** Fit the longest dimension to one scene unit without producing infinite scales. */
export function fitScale(size: Vector3Like): number {
  const longest = Math.max(size.x, size.y, size.z);
  return longest > 0 && Number.isFinite(longest) ? 1 / longest : 1;
}

/** A rotation-independent diameter covering the box and, optionally, every item drop. */
export function getPackageViewDiameter(
  package_: Package,
  includeDrop = false,
  dropDistance = 0,
): number {
  const { size, items } = package_;
  let radius = Math.hypot(size.x, size.y, size.z) / 2;

  if (includeDrop) {
    for (const item of items) {
      // The renderer reflects X/Z and centres the container about the origin.
      // A sphere around all landed/spawned corners also covers intermediate scales,
      // positions, and any orientation chosen by dragging the package.
      const x = Math.max(
        Math.abs(size.x / 2 - item.position.x),
        Math.abs(size.x / 2 - item.position.x - item.size.x),
      );
      const y = Math.max(
        Math.abs(item.position.y - size.y / 2),
        Math.abs(item.position.y + item.size.y - size.y / 2),
        Math.abs(size.y / 2 + dropDistance),
        Math.abs(size.y / 2 + dropDistance + item.size.y),
      );
      const z = Math.max(
        Math.abs(size.z / 2 - item.position.z),
        Math.abs(size.z / 2 - item.position.z - item.size.z),
      );
      radius = Math.max(radius, Math.hypot(x, y, z));
    }
  }

  return radius * 2 * fitScale(size);
}
