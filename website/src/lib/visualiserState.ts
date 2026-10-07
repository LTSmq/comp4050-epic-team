import { clamp } from "@/lib/clamp";
import type { Vector3Like } from "three"

/**
 * A box-like object placed in 3D space with additional product information.
 */
export interface Item {
    /**
     * An optional product identifier, as items typically have.
     */
    sku?: string | number,
    /**
     * The coordinates of the item's bottom corner.
     */
    position: Vector3Like,
    /**
     * The lengths of the dimensions of the item.
     */
    size: Vector3Like,
    /**
     * The item's weight if known.
     */
    weight?: number,
    /**
     * Optional tags concerning the item's delivery classification, such as "fragile"
     */
    tags?: string[],
    /**
     * The item's human-readable reference (solver `ItemReference`), if known.
     */
    reference?: string,
    /**
     * The group the item must be boxed with (solver `BoxGroup`), if any.
     */
    boxGroup?: string | null,
}

/**
 * A list of {@link Item}s contained within a 3D space.
 */
export interface Package {
    /**
     * The lengths of each of the dimensions of the 3D container.
     */
    size: Vector3Like,
    /**
     * The package's {@link Item}s sorted from first-to-pack to last-to-pack.
     */
    items: Item[],
    /**
     * Optional tags concerning the package's content classification, such as "fragile".
     */
    tags?: string[],
    /**
     * The box type's reference (solver `BoxType.Reference`), if known.
     */
    reference?: string,
}

/**
 * An order consisting of packages with items packed inside, as required by the assignment's 
 * optimization problem. 
 */
export interface Order {
    /**
     * An optional identifier, as orders typically have.
     */
    id?: string | number,

    /**
     * Individual {@link Package}s sorted from first-to-pack to last-to-pack.
     */
    packages: Package[],

    /**
     * An optional comment about the order.
     */
    note?: string,
}

/**
 * The manipulable state object of the visualiser renderer.
 */
export interface VisualiserState {
    /** 
     * The {@link Order} currently displayed in the visualizser.
     * */
    displayOrder: Order,

    /** 
     * The index of the {@link Order}'s {@link Package} to display currently; 
     * `null` if no package is selected. 
     */
    selectedPackageIndex: number | null,

    /**
     * How the currently selected package (indicated by {@link selectedPackageIndex}) is being inspected.
     * `"package"` is used for viewing the package's aggregate details.
     * `"items"` is used when iterating through the items of the package.
     */
    packageInspectMode: "package" | "items",

    /**
     * The index of the item currently being inspected for each {@link Package}, given the Package's index in {@link Order.packages}.
     * Used when {@link packageInspectMode} = `"items"`.
     */
    packageItemIndices: number[],
}

/**
 * What the visualiser is currently showing:
 * `"order"` - the package selection grid,
 * `"package"` - a selected package's aggregate details,
 * `"items"` - stepping through a selected package's items.
 */
export type DisplayState = "order" | VisualiserState["packageInspectMode"];

/** User navigation through a {@link VisualiserState}; see {@link visualiserReducer}. */
export type VisualiserAction =
    | { type: "selectPackage", index: number | null }
    | { type: "stepPackage", by: number }
    | { type: "stepItem", by: number }
    | { type: "inspect", mode: VisualiserState["packageInspectMode"] };

/** Initial state for viewing {@link order}: package grid shown, every package at its first item. */
export function initVisualiserState(order: Order): VisualiserState {
    return {
        displayOrder: order,
        selectedPackageIndex: null,
        packageInspectMode: "package",
        packageItemIndices: order.packages.map(() => 0),
    };
}

export function getDisplayState(state: VisualiserState): DisplayState {
    return (state.selectedPackageIndex == null) ? "order" : state.packageInspectMode;
}

/** Item inspection stops before an empty package; package view can navigate every package. */
export function getPackageStepIndex(state: VisualiserState, by: number): number | null {
    const selected = state.selectedPackageIndex;
    if (selected == null || !Number.isInteger(by)) return selected;
    const index = clamp(selected + by, 0, state.displayOrder.packages.length - 1);
    return state.packageInspectMode === "items" && state.displayOrder.packages[index].items.length === 0
        ? selected : index;
}

/** Applies {@link action} to {@link state}; stepping is clamped and ignored while no package is selected. */
export function visualiserReducer(state: VisualiserState, action: VisualiserAction): VisualiserState {
    const selected: number | null = state.selectedPackageIndex;
    switch (action.type) {
        case "selectPackage":
            if (action.index != null && (!Number.isInteger(action.index) || action.index < 0 || action.index >= state.displayOrder.packages.length)) return state;
            return {
                ...state,
                selectedPackageIndex: action.index,
                packageInspectMode: action.index == null || state.displayOrder.packages[action.index].items.length === 0
                    ? "package" : state.packageInspectMode,
            };
        case "inspect":         return { ...state, packageInspectMode: action.mode };
        case "stepPackage": {
            const index = getPackageStepIndex(state, action.by);
            return index === selected ? state : { ...state, selectedPackageIndex: index };
        }
        case "stepItem": {
            if (selected == null) return state;
            const packageItemIndices: number[] = [...state.packageItemIndices];
            const itemCount: number = state.displayOrder.packages[selected].items.length;
            packageItemIndices[selected] = clamp(packageItemIndices[selected] + action.by, 0, Math.max(0, itemCount - 1));
            return { ...state, packageItemIndices };
        }
    }
}
