"use client";
// #region Imports

// External library imports
import type { ReactElement, PointerEvent, RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import type { Vector3Tuple } from "three";
import { Vector2, Vector3, Euler, Color, OrthographicCamera as ThreeOrthographicCamera } from "three";

import { Canvas, useFrame, useThree } from "@react-three/fiber";

import { Box, Edges, OrthographicCamera } from "@react-three/drei";

// Local library imports
import type { Item, Package, Order, VisualiserState } from "@/lib/visualiserState";
import type { VisualiserConfig } from "@/lib/visualiserConfig";
import { fitScale, getPackageViewDiameter } from "@/lib/visualiserGeometry";

// #endregion

// #region Type Declarations
interface Orientation {
    yaw: number,
    pitch: number,
}

interface GridLayout {
    /** Packages in each row of the selection grid (at least `1`). */
    packagesPerRow: number,

    /** Rows in the selection grid. */
    rows: number,
}

// #endregion

// #region Initialisations
const orientationAxes: ["yaw", "pitch"] = ["yaw", "pitch"];
const ORIGIN = new Vector3(0, 0, 0);

// Angle constants for clarity
const HALF_REVOLUTION: number = 1.0 * Math.PI;
const REVOLUTION: number =      2.0 * Math.PI; 

const VISIBLE_SCALE_THRESHOLD: number = Math.pow(2, -6);

/** Fraction of the camera's view that displayed content is allowed to fill. */
const CAMERA_FILL_RATIO: number = 0.9;

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
    },

    idleRotationSpeed: {
        yaw: REVOLUTION / 8.0,
        pitch: 0.0,
    },

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

/** Interpolate {@link from} toward {@link to} in place, using the shortest angle on each axis. */
function slerp(from: Orientation, to: Orientation, fraction: number): void {
    for (const axis of orientationAxes) {
        const difference = (((to[axis] - from[axis] + HALF_REVOLUTION) % REVOLUTION) + REVOLUTION) % REVOLUTION - HALF_REVOLUTION;
        // Keep angle within a full revolution to prevent drift
        from[axis] = (((from[axis] + difference * fraction) % REVOLUTION) + REVOLUTION) % REVOLUTION;
    }
}

/** Smoothstep function; converts a value between `0.0` and `1.0` to a number in the same domain using a 
 * cubic polynomial to provide a smooth transition based on a linear position. 
 */
function smoothstep(fraction: number, passes: number = 1): number {
    let t = Math.max(0, Math.min(1, fraction));
    for (let i = 0; i < passes; i++) {
        t = t * t * (3 - (2 * t));
    }
    return t;
}

/** Dimensions of the package selection grid for {@link order}. */
function getGridLayout(order: Order, config: VisualiserConfig): GridLayout {
    const packagesPerRow: number = Math.max(1, Math.min(order.packages.length, config.packagesPerRow));
    return { packagesPerRow, rows: Math.ceil(order.packages.length / packagesPerRow) };
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

interface Package3DProps {
    /** Schematic reference to the package - uses `_` character to differentiate from JavaScript keyword `package`. */
    package_: Package,

    /** Reference to current configuration. */
    config: VisualiserConfig

    /** Where the package is displayed. */
    position?: Vector3Tuple,

    /** Multiplier for the package's fitted size. */
    scale: number,

    /** The current orientation of the package. */
    orientation?: Orientation

    /** Item step to display, with the numbered item highlighted and the items before it shown;
     * `-1` will display all items without highlighting. */
    itemStep?: number,

    /** How visible the item is; `0.0` - invisible, `1.0` - opaque. */
    opacity?: number;

    /** Callback for when clicked, allowing response behavior for when user clicks the package on the GUI. */
    onClick?: () => void;
}

interface Order3DProps {
    /** The order, selected package, inspect mode and item steps to display. */
    visualiserState: VisualiserState,

    /** Reference to current configuration. */
    config: VisualiserConfig

    /** Callback function that receives the index of the package in `packages` of the order that was just selected. */
    onPackageSelected?: (selectedPackageIndex: number) => void,

    /** Rotation dragged since the last frame; added to the inspected package's orientation, then reset to zero each frame. */
    orientationDelta: RefObject<Orientation>,
}

interface VisualiserCanvasProps {
    /** The reference to the current state attempting to be displayed. */
    visualiserState: VisualiserState,

    /** Reference to current configuration. */
    config?: Partial<VisualiserConfig> | VisualiserConfig,

    /** Camera magnification on top of the automatic fit; `1.0` shows the fitted view. */
    zoom?: number;

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
    opacity = 1.0,
}: Item3DProps): ReactElement {
    const itemSize: Vector3 = new Vector3().copy(item.size);
    const boxOffset: Vector3 = itemSize.clone().multiply({ x: -0.5, y: 0.5, z: -0.5 });

    return <group
        position={[-item.position.x, verticalPositionOverride ?? item.position.y, -item.position.z]}
        
    >
        <Box args={itemSize.toArray()} position={boxOffset} scale={sizeScaleOverride ?? 1.0}>
            {/* Write to depth buffer for opaque items to avoid sorting glitches */}
            <meshBasicMaterial color={color} transparent={true} opacity={opacity} depthWrite={opacity >= 1.0} />
            <Edges color={"black"} linewidth={3}/>
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
                // falls through - the dropped item keeps its landed position during the break
            case "drop":
                placedItemVerticalPositionOverride = lerp(placedItemVerticalPositionOverride, currentPlacedItem.position.y, animationProgress);
            break;
        }
    }
    
    // Consume frame
    useFrame((_root: unknown, timeDelta: number) => {
        // Transition to target color
        const targetColor = colorState === "selected" ? config.selectedColor : config.idleColor;
        const targetColorHex = new Color(targetColor).getHexString();
        const currentColorHex = new Color(color).getHexString();

        // Compare hex values to avoid loop from case mismatch
        if (currentColorHex !== targetColorHex) {
            const nextHex = (new Color(color))
                .lerp(new Color(`#${targetColorHex}`), decayFraction(timeDelta, config.packageErrorHalfLife))
                .getHexString();
            // Snap to target if step stalled due to hex quantization
            const resolvedHex = (nextHex === currentColorHex && timeDelta > 0) ? targetColorHex : nextHex;
            setColor(`#${resolvedHex}`);
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
    return <group position={position} scale={fitScale(package_.size) * scale} rotation={eulerRotation}>
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
            scale={0.99}
        >
            <meshBasicMaterial color={color} transparent={transparent} opacity={opacity} depthWrite={opacity >= 1.0}/>
            <Edges color={edgeColor} />

        </Box>
    </group>
}

/** Element of a 3D representation of an {@link Order}. */
function Order3D({
    visualiserState,
    config,
    onPackageSelected,
    orientationDelta,
}: Order3DProps): ReactElement 
{
    const { displayOrder: order, selectedPackageIndex, packageItemIndices, packageInspectMode } = visualiserState;
    const { packagesPerRow, rows }: GridLayout = getGridLayout(order, config);
    const rescale: number = 1.0 / packagesPerRow;
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
        const columns = Math.ceil(packagesPerRow);
        return order.packages.map((package_, index) => {
            const gridPosition = new Vector2(index % columns, Math.floor(index / columns));
            const targetPosition = new Vector3();
            assignGridCoordinate(targetPosition, gridPosition);
            return {
                package_,
                gridPosition,
                currentPosition: targetPosition.clone(),
                targetPosition,
                currentOrientation: {...config.initialOrientation},
                targetOrientation: {...config.initialOrientation},
                currentScale: 0.0,
                targetScale: 1.0,
            };
        });
    }
    
    const [prevOrder, setPrevOrder] = useState<Order>(order);
    const [packageStates, setPackageStates] = useState<PackageState[]>(() => acceptOrderPackages(order));
    const [idleOrientation, setIdleOrientation] = useState<Orientation>({...config.initialOrientation});

    // Sync package states when order changes
    if (order !== prevOrder) {
        setPrevOrder(order);
        setPackageStates(acceptOrderPackages(order));
    }
    
    function updatePackageState(packageState: PackageState, fraction: number): void {
        packageState.currentPosition.lerp(packageState.targetPosition, fraction);
        slerp(packageState.currentOrientation, packageState.targetOrientation, fraction);
        packageState.currentScale = lerp(packageState.currentScale, packageState.targetScale, fraction);
    }
    
    function assignGridCoordinate(receiver: Vector3, gridCoordinate: Vector2): void {
        const rowColumns: number = Math.min(packagesPerRow, order.packages.length - (gridCoordinate.y * packagesPerRow));
        
        receiver.set(
            + ((gridCoordinate.x - ((rowColumns - 1) / 2.0)) * rescale),
            - ((gridCoordinate.y - ((rows - 1) / 2.0)) * rescale),
            receiver.z,
        );
    }
    
    function setAsInspected(packageState: PackageState): void {
        packageState.targetPosition.copy(ORIGIN);
        packageState.targetScale = config.selectedPackageScale;
        for (const axis of orientationAxes) {
            packageState.targetOrientation[axis] = (packageState.targetOrientation[axis] + orientationDelta.current[axis]) % REVOLUTION;
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
        packageState.targetPosition.copy(ORIGIN);
        packageState.targetPosition.x += xSide;
        
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

            if (selectedPackageIndex == null) setAsIdle(packageState);
            else if (selectedPackageIndex === packageIndex) setAsInspected(packageState);
            else setAsPeripheral(packageState, packageIndex < selectedPackageIndex ? -1 : 1);

            updatePackageState(packageState, decayFraction(timeDelta, config.orderErrorHalfLife));
        }

        // Clear orientation delta
        orientationDelta.current = { yaw: 0.0, pitch: 0.0 };
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
                itemStep={(packageInspectMode == "items") ? packageItemIndices[index] ?? -1 : -1}
                onClick={onClick}
            />
        })}
    </group>
}

function MachineCamera({
    visualiserState,
    config,
    zoom,
}: {
    visualiserState: VisualiserState,
    config: VisualiserConfig,
    zoom: number,
}): ReactElement {
    const size = useThree().size;
    const cameraRef = useRef<ThreeOrthographicCamera>(null);

    const { displayOrder: order, selectedPackageIndex, packageInspectMode } = visualiserState;
    const { packagesPerRow, rows }: GridLayout = getGridLayout(order, config);

    let minimumSpan: number;
    let minimumVerticalSpan: number;
    if (selectedPackageIndex != null) {
        minimumSpan = Math.max(
            1.0,
            getPackageViewDiameter(order.packages[selectedPackageIndex], packageInspectMode === "items", config.dropDistance)
                * config.selectedPackageScale / packagesPerRow / CAMERA_FILL_RATIO,
        );
        minimumVerticalSpan = minimumSpan;
    } else {
        const packageDiagonal: number = Math.max(0, ...order.packages.map(package_ => getPackageViewDiameter(package_)));
        const packageSpan: number = packageDiagonal * config.packageMargin / packagesPerRow;

        minimumSpan = Math.max(1.0, (((packagesPerRow - 1) / packagesPerRow) + packageSpan) / CAMERA_FILL_RATIO);
        minimumVerticalSpan = (((rows - 1) / packagesPerRow) + packageSpan) / CAMERA_FILL_RATIO;
    }

    function updateCameraRef() {
        const camera = cameraRef.current;
        if (camera == null || size.width <= 0 || size.height <= 0) return;
        const proportion: number = size.height / size.width;
        const span: number = Math.max(minimumSpan, minimumVerticalSpan / proportion) / zoom;
    
        camera.left     = -0.5 * span;
        camera.right    = +0.5 * span;
        camera.bottom   = -0.5 * span * proportion;
        camera.top      = +0.5 * span * proportion;
        camera.position.z = Math.max(3, minimumSpan);
        camera.near = 0.01;
        camera.far = camera.position.z + minimumSpan + 1;
    
        camera.updateProjectionMatrix();
    }
    
    useLayoutEffect(updateCameraRef, [size.width, size.height, minimumSpan, minimumVerticalSpan, zoom]);
    
    return <OrthographicCamera
        ref={cameraRef}
        makeDefault
        manual
        position={[0, 0, 3]}
    />;
}

// #endregion

// #region Main Element
export default function VisualizerCanvas({
    visualiserState,
    zoom = 1.0,
    config,
    onPackageSelected,
}: VisualiserCanvasProps): ReactElement {
    const defaultedConfig: VisualiserConfig = { ...defaults, ...config };
    const orientationDelta = useRef<Orientation>({ yaw: 0.0, pitch: 0.0 });
    const previousPointerPosition = useRef<{ x: number, y: number } | null>(null);

    // Pointer capture keeps the drag going outside the canvas; the browser releases it on pointer up.
    function onPointerDown(event: PointerEvent<HTMLElement>): void {
        event.currentTarget.setPointerCapture(event.pointerId);
        previousPointerPosition.current = { x: event.clientX, y: event.clientY };
    }

    function onPointerUp(): void {
        previousPointerPosition.current = null;
    }

    function onPointerMove(event: PointerEvent<HTMLElement>): void {
        const isTouch = event.pointerType === "touch";
        // Ignore hover moves for mouse when no button is pressed
        if (event.buttons === 0 && !isTouch) return;

        let movementX = event.movementX ?? 0;
        let movementY = event.movementY ?? 0;

        // Fall back to client coordinate deltas when movementX/Y is undefined
        if (event.movementX == null && previousPointerPosition.current != null) {
            movementX = event.clientX - previousPointerPosition.current.x;
            movementY = event.clientY - previousPointerPosition.current.y;
        }
        previousPointerPosition.current = { x: event.clientX, y: event.clientY };

        orientationDelta.current = {
            yaw:   orientationDelta.current.yaw   + (movementX * defaultedConfig.pointerSensitivity),
            pitch: orientationDelta.current.pitch + (movementY * defaultedConfig.pointerSensitivity),
        };
    }
    
    return <Canvas
        aria-label="3D packing view. Select a package using the package selector."
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
    >
        <group>
            <Order3D
                visualiserState={visualiserState}
                config={defaultedConfig}
                onPackageSelected={onPackageSelected}
                orientationDelta={orientationDelta}
            />
            <MachineCamera
                visualiserState={visualiserState}
                config={defaultedConfig}
                zoom={zoom}
            />
        </group>
    </Canvas>
}

// #endregion
