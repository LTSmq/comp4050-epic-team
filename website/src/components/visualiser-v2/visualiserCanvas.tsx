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

// #region Type Declarations
interface Orientation {
    yaw: number,
    pitch: number,
}

// #endregion

// #region Initialisations
// Angle constants for clarity
const RIGHT_ANGLE: number =     0.5 * Math.PI;
const HALF_REVOLUTION: number = 1.0 * Math.PI;
const REVOLUTION: number =      2.0 * Math.PI; 

// Default values across elements
const defaults = {
    packagesPerRow: 3,
    packageMargin: 0.6,

    idleColor: "#CCCCCC",
    selectedColor: "#CC0000",

    menuTransitionTime: 1.0,
    colorTransitionHalfLife: 0.05,
    pointerSensitivity: 0.01,

    selectedPackageScale: 0.8,
    orientation: {
        yaw:    REVOLUTION / 8,
        pitch:  REVOLUTION / 20,
    } as Orientation,
    idleRotationSpeed: {
        yaw: REVOLUTION / 8.0,
        pitch: 0.0,
    } as Orientation,
    orderErrorHalfLife: 0.2,

    dropDistance: 0.15,
    ghostOpacity: 0.2,

    spawnAnimationTime: 0.5,
    dropAnimationTime: 1.0,
    pauseAnimationTime: 0.25,
} as const;


// #endregion

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

/** Spherical linear interpolation */
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

/** Returns a value of {@link from} moved toward {@link to} by at most {@link step}, stopping at the target. */
function moveToward(from: number, to: number, step: number): number {
    const error: number = to - from;
    if (Math.abs(error) <= step) return to;
    return from + (Math.sign(error) * step);
}

/** Returns a value to multiply the given {@link size} to such that no dimension exceeds a length of `1.0` */
function fitScale(size: Vector3 | Vector3Like): number {
    if (!(size instanceof Vector3)) size = new Vector3().copy(size);
    return 1.0 / Math.max(size.x, size.y, size.z);
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

    orientation?: Orientation

    /** Item step to display, with the numbered item highlighted; `0` will display no items, 
     * `package_.length + 1` will display all items without highlighting, and `null` will hide the items. */
    itemStep?: number | null,

    /** How visible the item is; `0.0` - invisible, `1.0` - opaque. */
    opacity?: number;

    /** The color to render as with no specified condition. */
    idleColor?: string;

    /** The color to render as when selected. */
    selectedColor?: string;

    /** The half life of the error between current and target colors */
    colorTransitionHalfLife?: number,

    /** How long it takes an animated item to appear. */
    spawnAnimationTime?: number,

    /** How long it takes an animated item to drop to position. */
    dropAnimationTime?: number,

    /** How much time between spawn and drop animations spent idle. */
    pauseAnimationTime?: number,

    /** How far above the package's top the items appear and drop. */
    dropDistance?: number,
    
    /** How opaque the ghost of the current item is. */
    ghostOpacity?: number, 

    /** Callback for when clicked, allowing response behavior for when user clicks the package on the GUI. */
    onClick?: (event: any) => void;
}

interface Order3DProps {
    /** Schematic reference to the order. */
    order: Order,
    
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

    /** How many packages are displayed in horizontal rows before beginning a new row. */
    packagesPerRow?: number,

    /** The relative distance between package cells on the package selection display. */
    packageMargin?: number,

    /** The time to transition between the package selection menu and the package inspection menu. */
    menuTransitionTime?: number,

    /** How large the package is when selected */
    selectedPackageScale?: number,
    
    /** Callback function that receives the index of the package in `packages` of {@link order} that was just selected. */
    onPackageSelected?: (selectedPackageIndex: number) => void,

    /** How fast the packages rotate when idle */
    idleRotationSpeed?: Orientation,

    /** The half-life of the error between the current and target values of the order properties (packages). */
    errorHalfLife?: number,

    orientationBuffer?: Orientation,
    /** The amount to add to the inspected target's orientation next frame; will be reset to zero after the frame passes. */
}

interface VisualiserCanvasProps {
    /** The reference to the current state attempting to be displayed. */
    visualiserState: VisualiserState,

    /** Where in the list the package table has scrolled to. */
    scroll?: number;

    /** Proxy for {@link Order3DProps.onPackageSelected} using the current order in {@link visualiserState}. */
    onPackageSelected?: (selectedPackageIndex: number) => void,

    /** How responsive packages are rotated */
    pointerSensitivity?: number,
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
    sizeScaleOverride = sizeScaleOverride ?? 1.0
    const [scaleOverride, setScaleOverride] = useState<number>(sizeScaleOverride);
    opacity = opacity ?? 1.0;

    useFrame(() => {
        if (scaleOverride != sizeScaleOverride) {
            setScaleOverride(sizeScaleOverride);
        }
    })

    const itemSize: Vector3 = new Vector3(item.size.x, item.size.y, item.size.z);
    const renderedSize: Vector3 = itemSize.clone().multiplyScalar(sizeScaleOverride);

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
    itemStep,
    orientation,
    position,
    scale,
    onClick,
    opacity,
    idleColor,
    selectedColor,
    colorTransitionHalfLife,
    spawnAnimationTime,
    dropAnimationTime,
    pauseAnimationTime,
    dropDistance,
    ghostOpacity,
}: Package3DProps): ReactElement 
{   
    // Default values
    itemStep = itemStep ?? null;
    orientation = orientation || defaults.orientation;
    opacity = opacity ?? 1.0;
    idleColor = idleColor || defaults.idleColor;
    selectedColor = selectedColor || defaults.selectedColor;
    colorTransitionHalfLife = colorTransitionHalfLife || defaults.colorTransitionHalfLife;
    spawnAnimationTime = spawnAnimationTime ?? defaults.spawnAnimationTime;
    dropAnimationTime = dropAnimationTime ?? defaults.dropAnimationTime;
    pauseAnimationTime = pauseAnimationTime ?? defaults.pauseAnimationTime;
    dropDistance = dropDistance ?? defaults.dropDistance;
    ghostOpacity = ghostOpacity ?? defaults.ghostOpacity;

    // Use state
    const [colorState, setColorState] = useState<"idle" | "selected">("idle");
    const [color, setColor] = useState<string>(idleColor);
    let [animationTimer, setAnimationTimer] = useState<number>(0.0);
    const [placedItem, setPlacedItem] = useState<Item | null>(null);
    
    let previousItems: Item[] = [];
    let currentItem: Item | null = null;
    if (itemStep != null) {
        if (itemStep < 0) {
            previousItems = [...package_.items];
        }
        else {
            previousItems = package_.items.slice(0, itemStep);
            if (itemStep < package_.items.length) currentItem = package_.items[itemStep];
        }
    }

    // Process drop animation
    let currentItemScaleOverride: number = 1.0;
    let currentItemVerticalPositionOverride: number = package_.size.y + dropDistance;
    let ghostItemOpacity: number = ghostOpacity;

    type AnimationStage = { name: string, length: number }
    const animationStages: AnimationStage[] = [
        { name: "spawn",        length: spawnAnimationTime },
        { name: "spawnBreak",   length: pauseAnimationTime },
        { name: "drop",         length: dropAnimationTime  },
        { name: "dropBreak",    length: pauseAnimationTime },
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

    animationProgress = smoothstep(animationProgress, 5);

    if (currentItem != null) {
        switch (currentStage) {
            case "spawnBreak":
                animationProgress = 1.0;
            case "spawn":
                currentItemScaleOverride = animationProgress;
                ghostItemOpacity = lerp(1.0, ghostOpacity, animationProgress);
            break;
            case "dropBreak":
                animationProgress = 1.0;
            case "drop":
                currentItemVerticalPositionOverride = lerp(currentItemVerticalPositionOverride, currentItem.position.y, animationProgress);
            break;
        }
    }
    
    useFrame((_root: any, timeDelta: number) => {
        let targetColor: string = "#FF00FF";  // Debug magenta
        if      (colorState === "idle")     targetColor = idleColor;
        else if (colorState === "selected") targetColor = selectedColor;

        if (color != targetColor) {
            if (colorTransitionHalfLife <= 0.0) setColor(targetColor);
            else setColor(`#${
                (new Color(color))
                .lerp(new Color(targetColor), 1.0 - Math.pow(0.5, timeDelta / colorTransitionHalfLife))
                .getHexString()
            }`)
        }

        if (!Object.is(placedItem, currentItem)) {
            setPlacedItem(currentItem);
            setAnimationTimer(0.0);
            animationTimer = 0.0;
        }

        else if (currentItem != null) {
            setAnimationTimer((animationTimer + timeDelta) % totalAnimationTime)
        }
    })

    // Declare prop values
    const packageSize: Vector3 = new Vector3(package_.size.x, package_.size.y, package_.size.z);
    const eulerRotation: Euler = new Euler(orientation.pitch, orientation.yaw, 0.0);
    
    const onPointerEnter: (event: any) => void = (_event: any) => { setColorState("selected") }
    const onPointerLeave: (event: any) => void = (_event: any) => { setColorState("idle"); }

    const transparent: boolean = opacity < 1.0;
    const edgeColor: string = "black";

    
    // Create element
    return <group position={position} scale={fitScale(package_.size) * (scale as number)} rotation={eulerRotation}>
        {/* Package Contents */}
        <group position={packageSize.clone().multiply({ x: 0.5, y: -0.5, z: 0.5 })}>
            {previousItems.map((item: Item, index: number) => {
                return <Item3D
                    item={item}
                    key={`${index}`}
                    color={"#00df00"}

                />
            })}
            {(currentItem != null) && <group>

                <Item3D
                    item={currentItem}
                    key={`${itemStep}-ghost`}
                    color={"#ee0000"}
                    opacity={ghostItemOpacity}
                />
                <Item3D
                    item={currentItem}
                    key={`${itemStep}`}
                    color={"#ee0000"}
                    sizeScaleOverride={currentItemScaleOverride}
                    verticalPositionOverride={currentItemVerticalPositionOverride}
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
    packageItemIndices,
    inspectMode,
    scroll,
    packagesPerRow,
    packageMargin,
    onPackageSelected,
    selectedPackageIndex,
    selectedPackageScale,
    menuTransitionTime,
    idleRotationSpeed,
    errorHalfLife,
    orientationBuffer,
}: Order3DProps): ReactElement 
{
    // Default Values
    scroll = scroll || 0.0;
    packageMargin = packageMargin || defaults.packageMargin;
    menuTransitionTime = menuTransitionTime || defaults.menuTransitionTime;
    selectedPackageScale = selectedPackageScale || defaults.selectedPackageScale;
    idleRotationSpeed = idleRotationSpeed || defaults.idleRotationSpeed;

    function getPackagesPerRow(): number{
        return Math.min(order.packages.length, packagesPerRow || defaults.packagesPerRow);
    }
    
    const rescale: number = 1.0 / getPackagesPerRow();
    // Use state
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
            packageStates.push({
                package_,
                gridPosition: new Vector2(column, row),
                currentPosition: new Vector3(),
                targetPosition: new Vector3(),
                currentOrientation: {...defaults.orientation},
                targetOrientation: {...defaults.orientation},
                currentScale: 0.0,
                targetScale: 0.2,
            })

            column += 1
            if (column >= maxColumn) {
                column = 0;
                row += 1;
            }
        }

        return packageStates;
    }
    const [flipper, setFlipper] = useState<boolean>(false);
    function refresh(): void { setFlipper(!flipper); }
    const inspectPosition: Vector3 = useState<Vector3>(new Vector3(rescale, -rescale))[0];
    const [packageStates, setPackageStates] = useState<PackageState[]>(acceptOrderPackages(order));
    const [idleOrientation, setIdleOrientation] = useState<Orientation>({...defaults.orientation});
    
    function updatePackageState(packageState: PackageState, fraction: number): void {
        packageState.currentPosition.lerp(packageState.targetPosition, fraction);
        slerp(packageState.currentOrientation, packageState.targetOrientation, fraction, /* inplace = */ true);
        packageState.currentScale = lerp(packageState.currentScale, packageState.targetScale, fraction);
    }
    
    function assignGridCoordinate(receiver: Vector3, gridCoordinate: Vector2): void {
        receiver.set(
            +gridCoordinate.x * rescale,
            -gridCoordinate.y * rescale, 
            receiver.z,
        );
    }
    
    function setAsInspected(packageState: PackageState): void {
        packageState.targetPosition.set(...inspectPosition.toArray())
        packageState.targetScale = 1.5;
        if (orientationBuffer != null) {
            packageState.targetOrientation.yaw = (packageState.targetOrientation.yaw  + orientationBuffer.yaw) % REVOLUTION;
            packageState.targetOrientation.pitch = (packageState.targetOrientation.pitch  + orientationBuffer.pitch) % REVOLUTION;
        }
    }

    function setAsIdle(packageState: PackageState, scale: number): void {
        assignGridCoordinate(packageState.targetPosition, packageState.gridPosition);
        packageState.targetScale = scale
        packageState.targetOrientation.yaw = idleOrientation.yaw;
        packageState.targetOrientation.pitch = idleOrientation.pitch;
    }
    
    useFrame((_root: any, timeDelta: number) => {
        setIdleOrientation({
            yaw: (idleOrientation.yaw + (idleRotationSpeed.yaw * timeDelta)) % REVOLUTION,
            pitch: (idleOrientation.pitch + (idleRotationSpeed.pitch * timeDelta)) % REVOLUTION,
        });

        const halfLife: number = errorHalfLife || defaults.orderErrorHalfLife;  // (λ)
        const fraction: number = (halfLife > 0) ? 1.0 - Math.pow(0.5, timeDelta / halfLife) : 1.0;
        for (let packageIndex = 0; packageIndex < packageStates.length; packageIndex++) {
            const packageState: PackageState = packageStates[packageIndex];
            if (selectedPackageIndex != null) {
                if (selectedPackageIndex === packageIndex) {
                    setAsInspected(packageState);
                }
                else {
                    setAsIdle(packageState, 0.0)
                }
            }
            else {
                setAsIdle(packageState, packageMargin);
            }
            updatePackageState(packageState, fraction);
        }
        
        if (orientationBuffer != null) {
            orientationBuffer.yaw = 0.0;
            orientationBuffer.pitch = 0.0;
        }
        refresh();
    })
    
    const inspectColor: string = "#0099ff";
    return <group position={[rescale / 2.0, -rescale / 2.0, 0]}>
        {packageStates.map((packageState: PackageState, index: number) => { 
            const scale: number = packageState.currentScale * rescale;
            
            if (scale <= 0.005) return;
            function onClick() { onPackageSelected?.(index); }
            return <Package3D
                package_={packageState.package_}
                key={index}
                position={packageState.targetPosition.toArray()}
                orientation={packageState.currentOrientation}
                scale={scale}
                opacity={(index === selectedPackageIndex) ? 0.2 : 0.5}
                itemStep={(inspectMode == "items") ? packageItemIndices?.[index] ?? -1 : -1}
                onClick={onClick}
                idleColor={(index === selectedPackageIndex) ? inspectColor : undefined}
                selectedColor={(index === selectedPackageIndex) ? inspectColor : undefined}
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
        camera.left = 0;
        camera.right = 1;
        camera.top = 0;
        camera.bottom = -size.height / size.width;
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
    onPackageSelected,
    pointerSensitivity,
}: VisualiserCanvasProps): ReactElement {
    const isOrderValid: boolean = visualiserState.displayOrder != null;

    const [pressed, setPressed] = useState<boolean>(false);
    const [orientationBuffer, _setOrientationBuffer] = useState<Orientation>({ yaw: 0.0, pitch: 0.0 });
    
    function onPointerDown(): void { setPressed(true); }
    function onPointerUp(): void { setPressed(false); }

    function onPointerMove(event: PointerEvent<HTMLElement>): void {
        if (!pressed) return;
        pointerSensitivity = pointerSensitivity || defaults.pointerSensitivity;
        orientationBuffer.yaw   += event.movementX * pointerSensitivity;
        orientationBuffer.pitch += event.movementY * pointerSensitivity;
    }
    
    return <Canvas 
        onPointerMove={onPointerMove} 
        onPointerDown={onPointerDown} 
        onPointerUp={onPointerUp}
        
    >
        <group>
            {isOrderValid && <Order3D 
                order={visualiserState.displayOrder as Order} 
                onPackageSelected={onPackageSelected}
                selectedPackageIndex={visualiserState.selectedPackageIndex}
                packageItemIndices={visualiserState.packageItemIndices}
                orientationBuffer={orientationBuffer}
                inspectMode={visualiserState.packageInspectMode}
            />}
            <MachineCamera scroll={scroll ?? 0.0}/>
            
        </group>
    </Canvas>
}

// #endregion
