"use client";
// #region Imports
// Native library imports

// External library imports
import type { ReactElement, RefObject, PointerEvent, WheelEvent } from "react";
import { useState, useRef, ComponentProps } from "react";

import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { Vector3, Euler, Group, Vector2 } from "three";

import { Canvas } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";

import { Box, Edges, OrthographicCamera, PerspectiveCamera, Line } from "@react-three/drei";

// Local library imports
import type { Item, Package, Order, VisualiserState } from "@/lib/visualiserState";
// #endregion

// #region Type declarations
type OrbitPosition = {
    longitude: number,
    latitude: number,
    altitude: number,
};

interface RenderSettings {
    packagesPerRow?: number,
    inspectFOV?: number,
    targetingHalfLife?: number,
    pointerSensitivity?: number,
}

// #endregion

// #region Prop declarations
interface Item3DProps {
    item: Item,
    color?: string,
}

interface Package3DProps extends ComponentProps<typeof Box>{
    package_: Package,
    yaw?: number, 
    pitch?: number,
    selectedItemIndex?: number,
    color?: string,
    onClick?: (event: any) => void;
    opacity?: number;
}

interface Order3DProps {
    order: Order,
    scroll?: number,
    packagesPerRow?: number,
    packageMargin?: number,
    onPackageSelected?: (selectedPackageIndex: number) => void,
    selectedPackageIndex?: number | null,
    zoomTime: number,
}

interface VisualiserSceneProps {
    visualiserState: VisualiserState,
    rotatorBuffer?: Vector2,
    rotatorSmoothness?: number,
    scroll?: number,
    onPackageSelected?: (selectedPackageIndex: number) => void,
}

interface VisualiserCanvasProps {
    visualiserState: VisualiserState,
    renderSettings?: RenderSettings,
    onPackageSelected?: (selectedPackageIndex: number) => void,
}

// #endregion

// #region Initialisations
const defaultRenderSettings = {
    packagesPerRow: 3,
    inspectFOV: 60,
    targetingHalfLife: 0.1,
    pointerSensitivity: 1.0,
};

// #endregion

// #region Helper functions
function lerp(from: number, to: number, fraction: number): number {
    const linearError: number = to - from;
    return from + (linearError * fraction);
}

function smoothstep(fraction: number): number {
    if (fraction <= 0.0) return 0.0;
    if (fraction >= 1.0) return 1.0;
    return fraction * fraction * (3 - (2 * fraction));
}

// #endregion

// #region Lesser Elements
function Item3D({}: Item3DProps): ReactElement {
    return <div>

    </div>
}

function Package3D({
    package_,
    position,
    scale,
    onClick,
    opacity,
}: Package3DProps): ReactElement {
    opacity = opacity || 1.0;
    
    const standardColor: string = "#CCCCCC";
    const selectedColor: string = "#CC0000"
    const [rot, setRot] = useState(0.0);
    const [color, setColor] = useState(standardColor)
    
    useFrame((_root: any, delta: number) => {
        setRot(rot + (delta * 0.5))
    });

    const packageSize: Vector3 = new Vector3(package_.size.x, package_.size.y, package_.size.z);
    return <group position={position} scale={scale} rotation={[0.2, rot, 0.0]}>
        <Box 
            args={packageSize.toArray()} 
            onPointerEnter={(_event: any) => {setColor(selectedColor)}}
            onPointerLeave={(_event: any) => {setColor(standardColor)}}
            onClick={(event) => {onClick?.(event)}}
        >
            <meshBasicMaterial color={color} transparent={opacity < 1.0} opacity={opacity}/>
            <Edges color={"black"} transparent={opacity < 1.0} opacity={opacity} />
        </Box>
    </group>
}

function Order3D({
    order,
    scroll,
    packagesPerRow,
    packageMargin,
    onPackageSelected,
    selectedPackageIndex,
    zoomTime,
}: Order3DProps): ReactElement {
    packagesPerRow = packagesPerRow || 3;
    scroll = scroll || 0.0;
    packageMargin = packageMargin || 0.1;
    zoomTime = zoomTime || 1.0;

    let [selectingTimer, setSelecting] = useState(1.0);
    const [lastSelectedIndex, setLastSelectedIndex]: [number | null, (override: number | null) => void] 
    = useState(null as number | null);

    useFrame((_root: any, timeDelta: number) => {
        
        if ((selectedPackageIndex == null) && (selectingTimer > 0.0)) { 
            setSelecting(Math.max(0.0, selectingTimer - (timeDelta / zoomTime)));
        }

        else if ((selectedPackageIndex != null)) {
            setLastSelectedIndex(selectedPackageIndex);
            if (selectingTimer < 1.0) {
                setSelecting(Math.min(1.0, selectingTimer + (timeDelta / zoomTime)));
            }
        }
    });


    const outerScale = ((1.0 / packagesPerRow) - packageMargin);
    const baseOffset: Vector3 = new Vector3(
        +((outerScale + packageMargin) / 2.0), 
        -((outerScale + packageMargin) / 2.0) - scroll, 
        +0.5,
    )

    const selecting = smoothstep(selectingTimer)
    return <group position={[-0.5, 0.0, 0.0]} >
        {order.packages.map((package_: Package, index: number) => {
            const position: Vector3 = (new Vector3(
                ((index % packagesPerRow) * (outerScale + packageMargin)),
                (-Math.floor(index / packagesPerRow) * (outerScale + packageMargin)),
                0.0,
            )).add(baseOffset)

            if (index == lastSelectedIndex) {
                position.lerp(new Vector3(
                    0.0,
                    0.0,
                    0.0,
                ), selecting)
            }

            const rescale: number = 1.0

            return (
                <Package3D
                    package_={package_}
                    key={index}
                    position={position}
                    scale={[rescale, rescale, rescale]}
                    onClick={(_event: any) => {if (onPackageSelected != null) onPackageSelected(index);}}
                />
            );
        })}
    </group>
}

function VisualiserScene({ 
    visualiserState,
    rotatorBuffer,
    rotatorSmoothness,
    scroll,
    onPackageSelected,
}: VisualiserSceneProps): ReactElement {
    const [orbit, setOrbit]: [OrbitPosition, (pos: OrbitPosition) => void] = useState({
        longitude: 0.0,
        latitude: 1.0,
        altitude: 3.0,
    } as OrbitPosition);

    const cameraRef = useRef<ThreePerspectiveCamera>(null);
    useFrame((_rootState: any, timeDelta: number) => {
        if (rotatorBuffer == null) return;
        if (rotatorSmoothness == null) rotatorSmoothness = defaultRenderSettings.targetingHalfLife;
        const fraction: number = (rotatorSmoothness <= 0.0) ? 1.0 : 1.0 - Math.pow(0.5, timeDelta / rotatorSmoothness);
        const longitudeDelta: number = lerp(rotatorBuffer.x, 0.0, fraction);
        const latitudeDelta: number = lerp(rotatorBuffer.y, 0.0, fraction);
        rotatorBuffer.sub(new Vector2(longitudeDelta, latitudeDelta));
        orbit.longitude += longitudeDelta;
        orbit.latitude += latitudeDelta;
        
        setOrbit({...orbit});
        cameraRef.current?.lookAt(new Vector3());
    })
    
    return <group>
        {(visualiserState.displayOrder != null) && 
        <Order3D 
            order={visualiserState.displayOrder} 
            scroll={scroll}
            onPackageSelected={onPackageSelected}
        />}
        <OrthographicCamera zoom={250} makeDefault position={[0.0, -1, orbit.altitude]}/>

        <Line points={[new Vector3(0.5, -1024, 0), new Vector3(0.5, 1024, 0)]} color={"black"} lineWidth={2}></Line>
        <Line points={[new Vector3(-0.5, -1024, 0), new Vector3(-0.5, 1024, 0)]} color={"black"} lineWidth={2}></Line>
        <Line points={[new Vector3(-1024, 0, 0), new Vector3(1024, 0, 0)]} color={"black"} lineWidth={2}></Line>
    </group>
}

// #endregion

// #region Main Element
export default function VisualizerCanvas({ 
    visualiserState,
    renderSettings,
    onPackageSelected,
}: VisualiserCanvasProps): ReactElement {
    const [rotationBuffer, _setRotationBuffer] = useState(new Vector2());
    const [pointerPressed, setPointerPressed] = useState(false);
    const [scroll, setScroll] = useState(0.0);

    function onPointerDown(_event: PointerEvent<HTMLElement>): void { setPointerPressed(true); }
    function onPointerUp(_event: PointerEvent<HTMLElement>): void { setPointerPressed(false); }

    function onPointerMove(event: PointerEvent<HTMLElement>): void {
        if (!pointerPressed) return;
        const delta: Vector2 = new Vector2(event.movementX, event.movementY)
        delta.multiplyScalar(renderSettings?.pointerSensitivity || defaultRenderSettings.pointerSensitivity);
        rotationBuffer.add(delta);
    }

    function onWheel(event: WheelEvent<HTMLElement>): void {
        setScroll(scroll + (event.deltaY * 0.00125));
    }

    return <Canvas onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onWheel={onWheel}>
        <VisualiserScene 
            visualiserState={visualiserState} 
            rotatorBuffer={rotationBuffer} 
            scroll={scroll} 
            onPackageSelected={onPackageSelected}
        />

    </Canvas>
}

// #endregion