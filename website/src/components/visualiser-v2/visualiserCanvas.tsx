"use client";
// #region Imports

// External library imports
import type { ReactElement, PointerEvent } from "react";
import { useLayoutEffect, useRef, useState, ComponentProps } from "react";

import type { Vector3Like } from "three";
import { Vector2, Vector3, Euler, Color, OrthographicCamera as ThreeOrthographicCamera } from "three";

import { Canvas, useThree } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";

import { Box, Edges, OrthographicCamera } from "@react-three/drei";

// Local library imports
import type { Item, Package, Order, VisualiserState } from "@/lib/visualiserState";
import type { VisualiserConfig  } from "@/lib/visualiserConfig";

// #region Type Declarations
interface Orientation {
    yaw: number,
    pitch: number,
}

// #endregion

// #region Initialisations
const orientationAxes: ["yaw", "pitch"] = ["yaw", "pitch"];

// Angle constants for clarity
const HALF_REVOLUTION: number = 1.0 * Math.PI;
const REVOLUTION: number =      2.0 * Math.PI; 

const VISIBLE_SCALE_THRESHOLD: number = Math.pow(2, -6);

// Default values across elements
const defaults: VisualiserConfig = {
    packagesPerRow: 3,
    packageMargin: 0.6,

    packageOpacitySelected: 0.2,
    packageOpacityUnselected: 0.5,

    idleColor: "#AAAAAA",
    selectedColor: "#0088FF",
    displayItemColor: "#00BB00",
    highlightItemColor: "#FF0000",

    pointerSensitivity: 0.01,

    selectedPackageScale: 2.0,
    initialOrientation: {
        yaw:    REVOLUTION / 8,
        pitch:  REVOLUTION / 20,
    } as Orientation,

    idleRotationSpeed: {
        yaw: REVOLUTION / 8.0,
        pitch: 0.0,
    } as Orientation,

    orderErrorHalfLife: 0.1,
    packageErrorHalfLife: 0.05,

    dropDistance: 0.15,
    ghostOpacity: 0.2,
    animationSmoothness: 5,

    spawnAnimationTime: 0.5,
    dropAnimationTime: 1.0,
    pauseAnimationTime: 0.25,
};

// #endregion


// #region Helper functions
/** Linear interpolation function; 
 * When {@link fraction} = `0.0`, will return {@link from.}
 * When {@link fraction} = `1.0`, will return {@link to}.
 * When {@link fraction} is between `0.0` and `1.0`, will return the value between them at the same proportion.
*/
function lerp(from: number, to: number, fraction: number): number {
    const linearError: number = to - from;
    return from + (linearError * fraction);
}

/** Spherical linear interpolation.
 * Provides a new orientation value based on the interpolation between the values in{@link from} and {@link to} (see {@link lerp}).
 * Use {@link inplace} to override the values of {@link from} with the new interpolated value.
 */
function slerp(from: Orientation, to: Orientation, fraction: number, inplace: boolean = false): Orientation {
    function shortestAngle(start: number, end: number): number {
        return (((end - start + HALF_REVOLUTION) % REVOLUTION) + REVOLUTION) % REVOLUTION - HALF_REVOLUTION;
    }

    function sumWrap(axis: "yaw" | "pitch"): number {
        return from[axis] + (shortestAngle(from[axis], to[axis]) * fraction);
    }

    if (inplace) { 
        from.yaw = sumWrap("yaw");
        from.pitch = sumWrap("pitch")
        return from;
    }

    return { yaw: sumWrap("yaw"), pitch: sumWrap("pitch") } as Orientation;
}

/** Smoothstep function; converts a value between `0.0` and `1.0` to a number in the same domain using a 
 * cubic polynomial to provide a smooth transition based on a linear position. 
 */
function smoothstep(fraction: number, amount: number = 1): number {
    if (amount > 1) return smoothstep(fraction, amount - 1);
    if (fraction <= 0.0) return 0.0;
    if (fraction >= 1.0) return 1.0;
    if (amount < 1) return fraction;
    return fraction * fraction * (3 - (2 * fraction));
}

/** Returns a value to multiply the given {@link size} to such that no dimension exceeds a length of `1.0` */
function fitScale(size: Vector3 | Vector3Like): number {
    if (!(size instanceof Vector3)) size = new Vector3().copy(size);
    return 1.0 / Math.max(size.x, size.y, size.z);
}

/** Returns the decay based on the time passed relative to a half-life. */
function decayFraction(timePassed: number, halfLife: number): number {
    if (halfLife <= 0.0) return 1.0;
    return 1.0 - Math.pow(0.5, timePassed / halfLife);
}

// #endregion

// #region Prop declarations
interface Item3DProps {
    /** Schematic reference to the item. */
    item: Item,

    /** Color to render the item. */
    color?: string,

    /** The y-coordinate override for the item in the container */
    verticalPositionOverride?: number | null,

    /** The multiplier for the item's scale */
    sizeScaleOverride?: number | null,

    /** How opaque the item's mesh is. */
    opacity?: number,
}

interface Package3DProps extends ComponentProps<typeof Box>{
    /** Schematic reference to the package - uses `_` character to differentiate from JavaScript keyword `package`. */
    package_: Package,

    /** Reference to current configuration. */
    config: VisualiserConfig

    /** The current orientation of the package. */
    orientation?: Orientation

    /** Item step to display, with the numbered item highlighted; `0` will display no items, 
     * `package_.length + 1` will display all items without highlighting, and `null` will hide the items. */
    itemStep?: number | null,

    /** How visible the item is; `0.0` - invisible, `1.0` - opaque. */
    opacity?: number;

    /** Callback for when clicked, allowing response behavior for when user clicks the package on the GUI. */
    onClick?: () => void;
}

interface Order3DProps {
    /** Schematic reference to the order. */
    order: Order,

    /** Reference to current configuration. */
    config: VisualiserConfig
    
    /** The currently selected package index; when `null` a package selection menu is displayed, when not `null` the package
     * in `packages` of {@link order} is displayed in a package selection menu.
     */
    selectedPackageIndex?: number | null,

    /** The currently inspected item index for each package in the same order as `order.packages` */
    packageItemIndices?: number[]

    /** How the currenlty selected package is being inspected; `"package"` for aggregate details and `"items"` for content details. */
    inspectMode?: "package" | "items",

    /** The vertical displacement of the package selection display. */
    scroll?: number,

    /** Callback function that receives the index of the package in `packages` of {@link order} that was just selected. */
    onPackageSelected?: (selectedPackageIndex: number) => void,

    /** The amount to add to the inspected target's orientation next frame; will be reset to zero after the frame passes. */
    orientationBuffer?: Orientation,
}

interface VisualiserCanvasProps {
    /** The reference to the current state attempting to be displayed. */
    visualiserState: VisualiserState,

    /** Reference to current configuration. */
    config?: Partial<VisualiserConfig> | VisualiserConfig,

    /** Where in the list the package table has scrolled to. */
    scroll?: number;

    /** Proxy for {@link Order3DProps.onPackageSelected} using the current order in {@link visualiserState}. */
    onPackageSelected?: (selectedPackageIndex: number) => void,
}

// #region Lesser Elements
/** Element of a 3D representation of an {@link Item}. */
function Item3D({
    item,
    color,
    verticalPositionOverride,
    sizeScaleOverride,
    opacity,
}: Item3DProps): ReactElement {
    opacity = opacity ?? 1.0;

    const [scaleOverride, setScaleOverride] = useState<number | null>(sizeScaleOverride ?? null);
    const [itemSize] = useState<Vector3>(new Vector3(item.size.x, item.size.y, item.size.z));
    const [renderedSize, setRenderedSize] = useState<Vector3>(itemSize.clone().multiplyScalar(scaleOverride ?? 1.0));

    useFrame(() => {
        if (scaleOverride != sizeScaleOverride) {
            setScaleOverride(sizeScaleOverride ?? null);
            setRenderedSize(itemSize.clone().multiplyScalar(sizeScaleOverride ?? 1.0));
        }
    })

    return <group position={[-item.position.x, verticalPositionOverride || item.position.y, -item.position.z]}>
        <Box 
            args={renderedSize.toArray()} position={itemSize.clone().multiply({ x: -0.5, y: 0.5, z: -0.5 })}
        >   
            <meshBasicMaterial color={color} transparent={true} opacity={opacity} depthWrite={false} />
            <Edges key={renderedSize.toArray().join(",")} color={"black"} linewidth={3}/>
        </Box>
    </group>
}

/** Element of a 3D representation of a {@link Package}. */
function Package3D({
    package_,
    config,
    itemStep,
    orientation,
    position,
    scale,
    opacity,
    onClick,
}: Package3DProps): ReactElement 
{   
    // Default values
    itemStep = itemStep ?? -1;
    orientation = orientation ?? config.initialOrientation;
    opacity = opacity ?? 1.0;

    // Use state
    const [colorState, setColorState] = useState<"idle" | "selected">("idle");
    const [color, setColor] = useState<string>(config.idleColor);
    const [placedItem, setPlacedItem] = useState<Item | null>(null);
    const [animationTimer, setAnimationTimer] = useState<number>(0.0);
    
    // Determine items to display based on item step
    const itemsToShow: number = (itemStep < 0) ? package_.items.length : itemStep;  // show all if step is -1 else show everything before current step 
    const showItems: Item[] = package_.items.slice(0, itemsToShow);
    const currentPlacedItem: Item | null = package_.items?.[itemStep] ?? null;

    // Process animation
    let placedItemScaleOverride: number = 1.0;
    let placedItemVerticalPositionOverride: number = package_.size.y + config.dropDistance;
    let ghostItemOpacity: number = config.ghostOpacity;

    type AnimationStage = { name: string, length: number }
    const animationStages: AnimationStage[] = [
        { name: "spawn",        length: config.spawnAnimationTime },
        { name: "spawnBreak",   length: config.pauseAnimationTime },
        { name: "drop",         length: config.dropAnimationTime  },
        { name: "dropBreak",    length: config.pauseAnimationTime },
    ]
    let currentStage: string = "";
    let totalAnimationTime: number = 0.0
    let animationProgress: number = 0.0;
    for (const animationStage of animationStages) {
        if (animationTimer >= totalAnimationTime) {
            currentStage = animationStage.name;
            animationProgress = (animationTimer - totalAnimationTime) / animationStage.length;
        }
        totalAnimationTime += animationStage.length;
    }

    if (currentStage.includes("Break")) animationProgress = 1.0;
    else                                animationProgress = smoothstep(animationProgress, config.animationSmoothness);

    if (currentPlacedItem != null) {
        switch (currentStage) {
            case "spawnBreak":
            case "spawn":
                placedItemScaleOverride = animationProgress;
                ghostItemOpacity = lerp(1.0, config.ghostOpacity, animationProgress);
            break;

            case "dropBreak":
                placedItemScaleOverride = 0.0
                ghostItemOpacity = 1.0
            case "drop":
                placedItemVerticalPositionOverride = lerp(placedItemVerticalPositionOverride, currentPlacedItem.position.y, animationProgress);
            break;
        }
    }
    
    // Consume frame
    useFrame((_root: unknown, timeDelta: number) => {
        // Transition to target color
        let targetColor: string = "#FF00FF";  // Debug magenta
        switch (colorState) {
            case "idle":        targetColor = config.idleColor;     break;
            case "selected":    targetColor = config.selectedColor; break;
        }

        if (color !== targetColor) {
            setColor(`#${
                (new Color(color))
                .lerp(new Color(targetColor), decayFraction(timeDelta, config.packageErrorHalfLife))
                .getHexString()
            }`)
        }

        // Reset animation timer for new item
        if (!Object.is(placedItem, currentPlacedItem)) {
            setPlacedItem(currentPlacedItem);
            setAnimationTimer(0.0);
        }

        // Increment animation timeline
        else if (currentPlacedItem != null) {
            setAnimationTimer((animationTimer + timeDelta) % totalAnimationTime)
        }
    })

    // Declare prop values
    const packageSize: Vector3 = new Vector3(package_.size.x, package_.size.y, package_.size.z);
    const eulerRotation: Euler = new Euler(orientation.pitch, orientation.yaw, 0.0);
    
    const onPointerEnter: () => void = () => { setColorState("selected") }
    const onPointerLeave: () => void = () => { setColorState("idle"); }

    const transparent: boolean = opacity < 1.0;
    const edgeColor: string = "black";

    
    // Create element
    return <group position={position} scale={fitScale(package_.size) * (scale as number)} rotation={eulerRotation}>
        {/* Package Contents */}
        <group position={packageSize.clone().multiply({ x: 0.5, y: -0.5, z: 0.5 })}>
            {showItems.map((item: Item, index: number) => {
                return <Item3D
                    item={item}
                    key={`${index}`}
                    color={config.displayItemColor}

                />
            })}
            {(currentPlacedItem != null) && <group>

                <Item3D
                    item={currentPlacedItem}
                    key={`${itemStep}-ghost`}
                    color={config.highlightItemColor}
                    opacity={ghostItemOpacity}
                />
                <Item3D
                    item={currentPlacedItem}
                    key={`${itemStep}`}
                    color={config.highlightItemColor}
                    sizeScaleOverride={placedItemScaleOverride}
                    verticalPositionOverride={placedItemVerticalPositionOverride}
                />

            </group>}
        </group>
        
        <Box 
            args={packageSize.toArray()} 
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onClick={onClick}
        >
            <meshBasicMaterial color={color} transparent={transparent} opacity={opacity} depthWrite={opacity >= 1.0}/>
            <Edges color={edgeColor} />

        </Box>
    </group>
}

/** Element of a 3D representation of an {@link Order}. */
function Order3D({
    order,
    config,
    packageItemIndices,
    inspectMode,
    scroll,
    onPackageSelected,
    selectedPackageIndex,
    orientationBuffer,
}: Order3DProps): ReactElement 
{
    function getPackagesPerRow(): number{
        return Math.min(order.packages.length, config.packagesPerRow);
    }
    
    const rescale: number = 1.0 / getPackagesPerRow();
    type PackageState = {
        package_: Package,
        gridPosition: Vector2,
        currentPosition: Vector3,
        targetPosition: Vector3, 
        currentOrientation: Orientation,
        targetOrientation: Orientation,
        currentScale: number,
        targetScale: number,
    }

    function acceptOrderPackages(order: Order): PackageState[] {
        const packageStates: PackageState[] = [];
        let row: number = 0; 
        let column: number = 0;
        const maxColumn: number = getPackagesPerRow();
        for (const package_ of order.packages) {
            const gridPosition: Vector2 = new Vector2(column, row);
            const targetPosition: Vector3 = new Vector3();
            assignGridCoordinate(targetPosition, gridPosition);
            const currentPosition: Vector3 = targetPosition.clone();

            packageStates.push({
                package_,
                gridPosition,
                currentPosition,
                targetPosition,
                currentOrientation: {...config.initialOrientation},
                targetOrientation: {...config.initialOrientation},
                currentScale: 0.0,
                targetScale: 1.0,
            })

            column += 1
            if (column >= maxColumn) {
                column = 0;
                row += 1;
            }
        }

        return packageStates;
    }
    
    const inspectPosition: Vector3 = useState<Vector3>(new Vector3())[0];
    const [packageStates] = useState<PackageState[]>(acceptOrderPackages(order));
    const [idleOrientation, setIdleOrientation] = useState<Orientation>({...config.initialOrientation});
    const [orientationBufferLastFrame, setOrientationBufferLastFrame] = useState<Orientation>({ yaw: 0.0, pitch: 0.0 });
    
    function updatePackageState(packageState: PackageState, fraction: number): void {
        packageState.currentPosition.lerp(packageState.targetPosition, fraction);
        slerp(packageState.currentOrientation, packageState.targetOrientation, fraction, /* inplace = */ true);
        packageState.currentScale = lerp(packageState.currentScale, packageState.targetScale, fraction);
    }
    
    function assignGridCoordinate(receiver: Vector3, gridCoordinate: Vector2): void {
        const defaultedScroll: number = Math.max(-1.0, Math.min(1.0, scroll ?? 0.0));;
        const scrollDistance: number = Math.floor(order.packages.length * rescale) * defaultedScroll;
        const ppr: number = getPackagesPerRow();
        const rows: number = Math.ceil(order.packages.length / ppr);
        
        receiver.set(
            + ((gridCoordinate.x - ((ppr  - 1) / 2.0)) * rescale),
            - ((gridCoordinate.y - ((rows - 1) / 2.0)) * rescale) - (scrollDistance), 
            receiver.z,
        );
    }
    
    function setAsInspected(packageState: PackageState): void {
        packageState.targetPosition.set(...inspectPosition.toArray())
        packageState.targetScale = config.selectedPackageScale;
        if (orientationBuffer != null) for (const axis of orientationAxes) {
            packageState.targetOrientation[axis] += orientationBuffer[axis] - orientationBufferLastFrame[axis];
            packageState.targetOrientation[axis] %= REVOLUTION;
        }
    }

    function setAsIdle(packageState: PackageState): void {
        assignGridCoordinate(packageState.targetPosition, packageState.gridPosition);
        packageState.targetScale = config.packageMargin;
        packageState.targetOrientation.yaw = idleOrientation.yaw;
        packageState.targetOrientation.pitch = idleOrientation.pitch;
    }

    function setAsPeripheral(packageState: PackageState, xSide: -1 | 1): void {
        packageState.targetScale = 0.0;
        packageState.targetPosition.set(...inspectPosition.toArray());
        packageState.targetPosition.set(
            packageState.targetPosition.x + xSide, 
            packageState.targetPosition.y, 
            packageState.targetPosition.z,
        );
        
        if (packageState.currentScale < VISIBLE_SCALE_THRESHOLD) {
            packageState.currentPosition.set(...packageState.targetPosition.toArray());
        }
    }
    
    useFrame((_root: unknown, timeDelta: number) => {
        // Update rotation for idle display (i.e. spin packages in selection menu for style)
        const updateAxis = (axis: "yaw" | "pitch") => {
            return (idleOrientation[axis] + (config.idleRotationSpeed[axis] * timeDelta)) % REVOLUTION;
        }
        setIdleOrientation({ yaw: updateAxis("yaw"), pitch: updateAxis("pitch") });

        // Update each package state
        for (let packageIndex = 0; packageIndex < packageStates.length; packageIndex++) {
            const packageState: PackageState = packageStates[packageIndex];

            const displayProtocol: "inspected" | "left" | "right" | "idle" = (
                (selectedPackageIndex != null) 
                ? (selectedPackageIndex === packageIndex) 
                    ? "inspected" 
                    : (packageIndex < selectedPackageIndex)
                        ? "left"
                        : "right"
                : "idle"
            );

            switch (displayProtocol) {
                case "inspected":   setAsInspected(packageState);       break;
                case "left":        setAsPeripheral(packageState, -1);  break;
                case "right":       setAsPeripheral(packageState, +1);  break;
                case "idle":        setAsIdle(packageState);            break;
            }

            updatePackageState(packageState, decayFraction(timeDelta, config.orderErrorHalfLife));
        }

        // Clear orientation buffer
        if (orientationBuffer != null) setOrientationBufferLastFrame({ ...orientationBuffer });
        
    })
    
    return <group>
        {packageStates.map((packageState: PackageState, index: number) => { 
            const scale: number = packageState.currentScale * rescale;
            
            if (scale <= VISIBLE_SCALE_THRESHOLD) return;
            function onClick() { onPackageSelected?.(index); }
            return <Package3D
                package_={packageState.package_}
                config={config}
                key={index}
                position={packageState.currentPosition.toArray()}
                orientation={packageState.currentOrientation}
                scale={scale}
                opacity={(index === selectedPackageIndex) ? config.packageOpacitySelected : config.packageOpacityUnselected}
                itemStep={(inspectMode == "items") ? packageItemIndices?.[index] ?? -1 : -1}
                onClick={onClick}
            />
        })}
    </group>
}

function MachineCamera(): ReactElement {
    const size = useThree().size;
    const cameraRef = useRef<ThreeOrthographicCamera>(null);

    function updateCameraRef() {
        const camera = cameraRef.current;
        if (camera == null || size.width <= 0 || size.height <= 0) return;
        const proportion = size.height / size.width;
        camera.left = -0.5;
        camera.right = 0.5;
        camera.top = proportion / 2.0;
        camera.bottom = -proportion / 2.0;
        camera.updateProjectionMatrix();
    }
    useLayoutEffect(updateCameraRef, [size.width, size.height]);
    
    return <OrthographicCamera
        ref={cameraRef}
        makeDefault
        position={[0, 0, 3]}
    >

    </OrthographicCamera>
}

// #endregion

// #region Main Element
export default function VisualizerCanvas({ 
    visualiserState,
    scroll,
    config,
    onPackageSelected,
}: VisualiserCanvasProps): ReactElement {
    const defaultedConfig: VisualiserConfig = { ...defaults, ...config };
    const isOrderValid: boolean = visualiserState.displayOrder != null;

    const [pressed, setPressed] = useState<boolean>(false);
    const [orientationBuffer, setOrientationBuffer] = useState<Orientation>({ yaw: 0.0, pitch: 0.0 });
    
    function onPointerDown(): void  { setPressed(true); }
    function onPointerUp(): void    { setPressed(false); }

    function onPointerMove(event: PointerEvent<HTMLElement>): void {
        if (!pressed) return;
        const motionMap: Orientation = { yaw: event.movementX, pitch: event.movementY };
        for (const axis of orientationAxes) {
            motionMap[axis] *= defaultedConfig.pointerSensitivity;
            motionMap[axis] += orientationBuffer[axis];
        }
        setOrientationBuffer({ ...motionMap })
    }
    
    return <Canvas 
        onPointerMove={onPointerMove} 
        onPointerDown={onPointerDown} 
        onPointerUp={onPointerUp}
        
    >
        <group>
            {isOrderValid && <Order3D 
                order={visualiserState.displayOrder as Order} 
                config={defaultedConfig}
                onPackageSelected={onPackageSelected}
                selectedPackageIndex={visualiserState.selectedPackageIndex}
                packageItemIndices={visualiserState.packageItemIndices}
                orientationBuffer={orientationBuffer}
                inspectMode={visualiserState.packageInspectMode}
                scroll={scroll}
            />}
            <MachineCamera />
            
        </group>
    </Canvas>
}

// #endregion
