// WORK IN PROGRESS!
// TODO: Canvas orbit input control
"use client";
// Native library imports

// External library imports
import type { ReactElement, RefObject } from "react";
import { useState, useRef } from "react";

import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";
import { Vector3, Euler, Group } from "three";

import { Canvas } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";

import { Box, Edges, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";

// Local library imports
import type { Item, Package, Order, VisualiserState } from "@/lib/visualiserState";
import { time } from "console";

// Type declarations
type OrbitPosition = {
    longitude: number,
    latitude: number,
    altitude: number,
};

interface RenderSettings {
    packagesPerRow?: number,
    inspectFOV?: number,
    targetingHalfLife?: number,
}

// Prop declarations
interface Item3DProps {

}

interface Package3DProps {

}

interface VisualiserCanvasProps {
    visualiserState: VisualiserState,
    renderSettings?: RenderSettings,
}

// Initialisations
const defaultRenderSettings = {
    packagesPerRow: 3,
    inspectFOV: 60,
    targetingHalfLife: 0.1
};

// Helper functions
function lerp(from: number, to: number, fraction: number): number {
    const linearError: number = to - from;
    return from + (linearError * fraction);
}

function orbitPosition(orbitPosition: OrbitPosition): Vector3 {
    // Displacement from origin
    const position: Vector3 = new Vector3(
        Math.sin(orbitPosition.latitude) * Math.cos(orbitPosition.longitude),
        Math.cos(orbitPosition.latitude),
        Math.sin(orbitPosition.latitude) * Math.sin(orbitPosition.longitude),
    );
    
    position.multiplyScalar(orbitPosition.altitude);

    return position;
}

// Lesser Elements
function Item3D({}: Item3DProps): ReactElement {
    return <div>

    </div>
}

function Package3D({}: Package3DProps): ReactElement {
    return <div />
}

function VisualiserScene({ 
    visualiserState,
}: VisualiserCanvasProps): ReactElement {
    const [orbit, setOrbit]: [OrbitPosition, (pos: OrbitPosition) => void] = useState({
        longitude: 0.0,
        latitude: 1.0,
        altitude: 64.0,
    } as OrbitPosition);

    const [position, setPosition]: [Vector3, (override: Vector3) => void] = useState(orbitPosition(orbit));
    const cameraRef = useRef<ThreePerspectiveCamera>(null);
    useFrame((_rootState: any, timeDelta: number) => {
        orbit.longitude += (timeDelta * Math.PI * 0.5);
        orbit.altitude += (2.0 - orbit.altitude) * timeDelta * 3.0
    
        setOrbit({...orbit});
        setPosition(orbitPosition(orbit));
        cameraRef.current?.lookAt(new Vector3());
    })

    return <group>
        <Box position={[0, 0, 0]}>
            <Edges color={"black"}>

            </Edges>
        </Box>
        <PerspectiveCamera ref={cameraRef} makeDefault position={position} />
    </group>
}

// Main Element
export default function VisualizerCanvas({ 
    visualiserState,
}: VisualiserCanvasProps): ReactElement {
    return <Canvas>
        <VisualiserScene visualiserState={visualiserState} />
    </Canvas>
}