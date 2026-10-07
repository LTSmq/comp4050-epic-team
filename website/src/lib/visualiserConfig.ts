/** 
 * Stylistic configuration for {@link VisualiserCanvas}.
 * VisualiserCanvas uses `Partial<VisualiserConfig>` field, so not all fields have to be supplied (as they are defaulted)*/
export interface VisualiserConfig {
    /** 
     * How many packages to display per row in the selection grid; 
     * If there are less packages in the order than this value, they will still occupy the maximum width.
     */
    packagesPerRow: number,

    /**
     * The relative distance between packages in the selection grid.
     */
    packageMargin: number,

    /**
     * The size of the package when inspected.
     */
    selectedPackageScale: number,

    /**
     * The color of the packages under normal circumstance.
     */
    idleColor: string,

    /**
     * The color of the packages when selected.
     */
    selectedColor: string,

    /**
     * The color of the items in packages.
     */
    displayItemColor: string,

    /**
     * The opacity of a package being inspected.
     */
    packageOpacitySelected: number,

    /**
     * The opacity of the packages in the selection grid.
     */
    packageOpacityUnselected: number,

    /**
     * The color of the demonstration item.
     */
    highlightItemColor: string,

    /**
     * The half-life of the scalar errors in a package's state, including its color.
     * Larger values = smoother, heavier motion.
     * Smaller values = snappier, faster motion.
     */
    packageErrorHalfLife: number,

    /**
     * The multiplier for the pointer's (mouse, touchscreen) velocity when manipulating the viewing orientation.
     */
    pointerSensitivity: number,

    /**
     * The orientation in radians which is initialised to displayed pacakges.
     */
    initialOrientation: { yaw: number, pitch:  number },

    /**
     * The rotational speed in radians per second of the packages in the selection grid.
     */
    idleRotationSpeed: { yaw: number, pitch: number },
    
    /**
     * The half-life of scalar errors of the order, including orientation and position.
     * Larger values = smoother, heavier motion.
     * Smaller values = snappier, faster motion.
     */
    orderErrorHalfLife: number,

    /**
     * The distance above the package which the demonstrated item is spawned at.
     */
    dropDistance: number,

    /**
     * The opacity of the ghost of the demonstration item.
     */
    ghostOpacity: number,

    /**
     * How many times a smoothstep function is applied to the animation keyframe interpolation.
     */
    animationSmoothness: number,

    /**
     * How long it takes the demonstration item to appear.
     */
    spawnAnimationTime: number,

    /**
     * How long it takes the demonstration item to fall to position.
     */
    dropAnimationTime: number,

    /**
     * The idle time between drop and spawn animation cycles.
     */
    pauseAnimationTime: number,
}
