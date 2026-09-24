"use client";
// #region Imports

// External library imports
import type { ReactElement, PointerEvent, WheelEvent } from "react";
import { useState, ComponentProps } from "react";

import type { Vector3Like } from "three";
import { Vector3, Euler, Vector2 } from "three";

import { Canvas } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";

import { Box, Edges, OrthographicCamera, Line } from "@react-three/drei";

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
    packageMargin: 0.1,

    idleColor: "#CCCCCC",
    selectedColor: "#CC0000",

    menuTransitionTime: 1.0,
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
    inspectOrientationHalfLife: 0.05,
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
function slerp(from: Orientation, to: Orientation, fraction: number): Orientation {
    function shortestAngle(start: number, end: number): number {
        return (((end - start + HALF_REVOLUTION) % REVOLUTION) + REVOLUTION) % REVOLUTION - HALF_REVOLUTION;
    }

    function sumWrap(axis: "yaw" | "pitch"): number {
        return from[axis] + (shortestAngle(from[axis], to[axis]) * fraction);
    }

    return { yaw: sumWrap("yaw"), pitch: sumWrap("pitch") } as Orientation;
}

/** Smoothstep function; converts a value between `0.0` and `1.0` to a number in the same domain using a 
 * cubic polynomial to provide a smooth transition based on a linear position. 
 */
function smoothstep(fraction: number): number {
    if (fraction <= 0.0) return 0.0;
    if (fraction >= 1.0) return 1.0;
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
}

interface Package3DProps extends ComponentProps<typeof Box>{
    /** Schematic reference to the package - uses `_` character to differentiate from JavaScript keyword `package`. */
    package_: Package,

    orientation?: Orientation

    /** Item step to display, with the numbered item highlighted; `0` will display no items, 
     * `package_.length + 1` will display all items without highlighting, and `null` will hide the items. */
    selectedItemIndex?: number | null,

    /** How visible the item is; `0.0` - invisible, `1.0` - opaque. */
    opacity?: number;

    /** The color to render as with no specified condition. */
    idleColor?: string;

    /** The color to render as when selected. */
    selectedColor?: string;
    
    /** Callback for when clicked, allowing response behavior for when user clicks the package on the GUI. */
    onClick?: (event: any) => void;
}

interface Order3DProps {
    /** Schematic reference to the order. */
    order: Order,

    /** The vertical displacement of the package selection display. */
    scroll?: number,

    /** How many packages are displayed in horizontal rows before beginning a new row. */
    packagesPerRow?: number,

    /** The relative distance between package cells on the package selection display. */
    packageMargin?: number,

    /** The time to transition between the package selection menu and the package inspection menu. */
    menuTransitionTime?: number,

    /** The currently selected package index; when `null` a package selection menu is displayed, when not `null` the package
     * in `packages` of {@link order} is displayed in a package selection menu.
     */
    selectedPackageIndex?: number | null,

    selectedPackageScale?: number,
    
    /** Callback function that receives the index of the package in `packages` of {@link order} that was just selected. */
    onPackageSelected?: (selectedPackageIndex: number) => void,

    /** How fast the packages rotate when idle */
    idleRotationSpeed?: Orientation,

    /** The half-life of the error between the current and target orientations of the inspected package. */
    inspectOrientationHalfLife?: number,

    orientationBuffer?: Orientation,
    /** The amount to add to the inspected target's orientation next frame; will be reset to zero after the frame passes. */
}

interface VisualiserSceneProps {
    /** The reference to the current state attempting to be displayed. */
    visualiserState: VisualiserState,

    /** The 2D input direction, used to rotate packages; 
     * Note that this value will be actively modified each frame when the scene is rendered.
     * */
    orientationBuffer?: Orientation,
    
    /** The vertical displacement of the package selection menu. */
    scroll?: number,

    /** Proxy for {@link Order3DProps.onPackageSelected} using the current order in {@link visualiserState}. */
    onPackageSelected?: (selectedPackageIndex: number) => void,
}

interface VisualiserCanvasProps {
    /** The reference to the current state attempting to be displayed. */
    visualiserState: VisualiserState,

    /** Proxy for {@link Order3DProps.onPackageSelected} using the current order in {@link visualiserState}. */
    onPackageSelected?: (selectedPackageIndex: number) => void,

    /** How responsive packages are rotated */
    pointerSensitivity?: number,
}

// #region Lesser Elements
/** Element of a 3D representation of an {@link Item}. */
function Item3D({}: Item3DProps): ReactElement {
    // TODO: Item rendering in packages
    return <div>

    </div>
}

/** Element of a 3D representation of a {@link Package}. */
function Package3D({
    package_,
    orientation,
    position,
    scale,
    onClick,
    opacity,
    idleColor,
    selectedColor,
}: Package3DProps): ReactElement 
{   
    // Default values
    orientation = orientation || defaults.orientation;
    opacity = opacity || 1.0;
    idleColor = idleColor || defaults.idleColor;
    selectedColor = selectedColor || defaults.selectedColor;

    // Use state
    const [meshColor, setMeshColor] = useState<string>(idleColor)
    
    // Declare prop values
    const packageSize: Vector3 = new Vector3(package_.size.x, package_.size.y, package_.size.z);
    const eulerRotation: Euler = new Euler(orientation.pitch, orientation.yaw, 0.0);
    
    const onPointerEnter: (event: any) => void = (_event: any) => { setMeshColor(selectedColor); }
    const onPointerLeave: (event: any) => void = (_event: any) => { setMeshColor(idleColor); }

    const transparent: boolean = opacity < 1.0;
    const edgeColor: string = "black";

    // Create element
    return <group position={position} scale={scale} rotation={eulerRotation}>
        <Box 
            args={packageSize.toArray()} 
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onClick={onClick}
        >
            <meshBasicMaterial color={meshColor} transparent={transparent} opacity={opacity}/>
            <Edges color={edgeColor} transparent={transparent} opacity={opacity} />
        </Box>
    </group>
}

/** Element of a 3D representation of an {@link Order}. */
function Order3D({
    order,
    scroll,
    packagesPerRow,
    packageMargin,
    onPackageSelected,
    selectedPackageIndex,
    selectedPackageScale,
    menuTransitionTime,
    idleRotationSpeed,
    inspectOrientationHalfLife,
    orientationBuffer,
}: Order3DProps): ReactElement 
{
    // Default Values
    scroll = scroll || 0.0;
    packagesPerRow = packagesPerRow || defaults.packagesPerRow;
    packageMargin = packageMargin || defaults.packageMargin;
    menuTransitionTime = menuTransitionTime || defaults.menuTransitionTime;
    selectedPackageScale = selectedPackageScale || defaults.selectedPackageScale;
    idleRotationSpeed = idleRotationSpeed || defaults.idleRotationSpeed;
    inspectOrientationHalfLife = inspectOrientationHalfLife || defaults.inspectOrientationHalfLife;

    // Use state
    const [selectingTimer, setSelectingTimer] = useState<number>(1.0);
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
    const [idlePackageOrientation, setIdlePackageOrientation] = useState<Orientation>(defaults.orientation);
    const [inspectedPackageCurrentOrientation, setInspectedCurrentPackageOrientation] 
        = useState<Orientation>(defaults.orientation);
    const [inspectedPackageTargetOrientation, setInspectedPackageTargetOrientation] 
        = useState<Orientation>(defaults.orientation);

    // Process frame update
    useFrame((_root: any, timeDelta: number) => {
        // Calculate new timer value
        const packageSelected: boolean = selectedPackageIndex != null;
        const selectingTimerTarget: number = (packageSelected) ? 1.0 : 0.0;  // 1.0 = fully selected, 0.0 = fully unselected
        const selectingTimerUpdated: number = moveToward(selectingTimer, selectingTimerTarget, timeDelta / menuTransitionTime);
        setSelectingTimer(selectingTimerUpdated);

        // React to package selection update
        if (packageSelected && (selectedPackageIndex != lastSelectedIndex)) {
            // Save index as last selected (such that when deselected it can "fade out")
            setLastSelectedIndex(selectedPackageIndex as number);

            // Set inspected 
            setInspectedCurrentPackageOrientation(idlePackageOrientation);
            setInspectedPackageTargetOrientation(defaults.orientation);
        }

        // Update idle rotations
        setIdlePackageOrientation({
            yaw: (idlePackageOrientation.yaw + (idleRotationSpeed.yaw * timeDelta)) % REVOLUTION,
            pitch: (idlePackageOrientation.pitch + (idleRotationSpeed.pitch * timeDelta)) % REVOLUTION,
        });

        // Update inspected package target orientation
        if (orientationBuffer != null) {
            setInspectedPackageTargetOrientation({
                yaw: (inspectedPackageTargetOrientation.yaw + orientationBuffer.yaw) % REVOLUTION,
                pitch: Math.max(-RIGHT_ANGLE, Math.min(RIGHT_ANGLE, inspectedPackageTargetOrientation.pitch + orientationBuffer.pitch)),
            })
            orientationBuffer.yaw = 0.0;
            orientationBuffer.pitch = 0.0;
        }

        // Update inspected package current orientation
        if (inspectOrientationHalfLife <= 0.0) setInspectedCurrentPackageOrientation(inspectedPackageTargetOrientation)
        else setInspectedCurrentPackageOrientation(slerp(
            inspectedPackageCurrentOrientation,
            inspectedPackageTargetOrientation,
            1.0 - Math.pow(0.5, timeDelta / inspectOrientationHalfLife),
        ));
    });

    // Calculate common values across package elements
    const positionScale: number = 1.0 / packagesPerRow;
    const idleScale: number = positionScale - packageMargin;
    const baseOffset: Vector3 = new Vector3(
        + (positionScale / 2.0), 
        - (positionScale / 2.0) - scroll, 
        + 0.5,
    )

    const selectingFraction: number = smoothstep(selectingTimer)
    const inspectPosition: Vector3 = new Vector3(0.5, -0.5, -1.0);

    // Create package elements
    return <group position={[-0.5, 0.0, 0.0]} >
        {order.packages.map((package_: Package, index: number) => {
            // Calculate selection data for package
            const isSelected: boolean = index == lastSelectedIndex;
            const selectingScale: number = (isSelected) ? selectedPackageScale : 0.0;
            
            // Calculate the abstract position of the package in the grid
            const x: number = index % packagesPerRow;
            const y: number = Math.floor(index / packagesPerRow);
            const gridPosition: Vector3 = new Vector3(+x, -y, 0.0);

            // Calculate the position to display the item in the package selection menu
            const position: Vector3 = gridPosition.clone()
                .multiplyScalar(positionScale)
                .add(baseOffset)
            ;
            
            // Calculate scale based on current selection fraction
            const scaleLength: number = fitScale(package_.size) * lerp(idleScale, selectingScale, selectingFraction);
            const scale: [number, number, number] = [scaleLength, scaleLength, scaleLength];

            // Define package orientation
            let orientation: Orientation = idlePackageOrientation;
            
            // Mutate vectors to inspect position if selected
            if (isSelected) {
                position.lerp(inspectPosition, selectingFraction);
                orientation = slerp(idlePackageOrientation, inspectedPackageCurrentOrientation, selectingFraction);
            }

            // Define selection callback
            function onClick(_event: any) { if (onPackageSelected != null) onPackageSelected(index); }

            // Create element
            return (
                <Package3D
                    package_={package_}
                    key={index}
                    position={position}
                    orientation={orientation}
                    scale={scale}
                    onClick={onClick}
                />
            );
        })}
    </group>
}

function VisualiserScene({ 
    visualiserState,
    scroll,
    orientationBuffer,
    onPackageSelected,
}: VisualiserSceneProps): ReactElement {
    const cameraPosition: [number, number, number] = [0.0, -1.0, 3.0];
    const cameraZoom: number = 250;
    const isOrderValid: boolean = visualiserState.displayOrder != null;
    
    const [selectedPackageIndex, setSelectedPackageIndex] = useState<number | null>(null);
    useFrame(() => {
        if (visualiserState.selectedPackageIndex != selectedPackageIndex) 
            setSelectedPackageIndex(visualiserState.selectedPackageIndex);
    })
    
    return <group>
        {isOrderValid && <Order3D 
            order={visualiserState.displayOrder as Order} 
            scroll={scroll}
            onPackageSelected={onPackageSelected}
            selectedPackageIndex={visualiserState.selectedPackageIndex}
            orientationBuffer={orientationBuffer}
        />}
        <OrthographicCamera zoom={cameraZoom} makeDefault position={cameraPosition}/>
        
        {/* Debug helper lines to keep items in range */}
        <Line points={[new Vector3(+0.5,  -1024, 0), new Vector3(+0.5,  1024, 0)]} color={"red"}   lineWidth={2} />
        <Line points={[new Vector3(-0.5,  -1024, 0), new Vector3(-0.5,  1024, 0)]} color={"green"} lineWidth={2} />
        <Line points={[new Vector3(-1024, +0,    0), new Vector3(+1024, 0,    0)]} color={"blue"}  lineWidth={2} />
    </group>
}

// #endregion

// #region Main Element
export default function VisualizerCanvas({ 
    visualiserState,
    onPackageSelected,
    pointerSensitivity,
}: VisualiserCanvasProps): ReactElement {
    
    const [scroll, setScroll] = useState(0.0);
    const [pressed, setPressed] = useState<boolean>(false);
    const [orientationBuffer, _setOrientationBuffer] = useState<Orientation>({ yaw: 0.0, pitch: 0.0 });
    
    // TODO: Add orbit controls based on Canvas input
    function onPointerDown(_event: PointerEvent<HTMLElement>): void { 
        setPressed(true);
    }
    function onPointerUp(_event: PointerEvent<HTMLElement>): void {
        setPressed(false);
    }

    function onPointerMove(event: PointerEvent<HTMLElement>): void {
        if (!pressed) return;
        pointerSensitivity = pointerSensitivity || defaults.pointerSensitivity;
        orientationBuffer.yaw   += event.movementX * pointerSensitivity;
        orientationBuffer.pitch += event.movementY * pointerSensitivity;
    }

    function onWheel(event: WheelEvent<HTMLElement>): void {
        setScroll(scroll + (event.deltaY * 0.00125));
    }

    return <Canvas onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onWheel={onWheel}>
        <VisualiserScene 
            visualiserState={visualiserState} 
            scroll={scroll} 
            onPackageSelected={onPackageSelected}
            orientationBuffer={orientationBuffer}
        />

    </Canvas>
}

// #endregion