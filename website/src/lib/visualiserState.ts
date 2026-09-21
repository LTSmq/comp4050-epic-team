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
     * The {@link Order} currently displayed in the visualizser; 
     * `null` if no order is selected 
     * */
    displayOrder: Order | null,

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
