"use client"

import { useState } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"

import { Item, PackageDisplay } from "@/components/boxViewPanel/boxViewPanel"
import { canvasStyle, containerStyle } from "./styles"

// Sample data for a possible item arrangement for 7 items in a 1x1 box
const packingSolution: Item[] = [
    { uuid: "item1", position: { x: 0.0, y: 0.0, z: 0.0 },   size: { x: 1.0, y: 0.2, z: 1.0 } },
    { uuid: "item2", position: { x: 0.0, y: 0.2, z: 0.0 },   size: { x: 1.0, y: 0.4, z: 0.5 } },
    { uuid: "item3", position: { x: 0.0, y: 0.6, z: 0.0 },   size: { x: 1.0, y: 0.4, z: 0.5 } },
    { uuid: "item4", position: { x: 0.0, y: 0.2, z: 0.5 },   size: { x: 0.25, y: 0.8, z: 0.5 } },
    { uuid: "item5", position: { x: 0.25, y: 0.2, z: 0.5 },  size: { x: 0.25, y: 0.8, z: 0.5 } },
    { uuid: "item6", position: { x: 0.5, y: 0.2, z: 0.5 },   size: { x: 0.25, y: 0.8, z: 0.5 } },
    { uuid: "item7", position: { x: 0.75, y: 0.2, z: 0.5 },  size: { x: 0.25, y: 0.8, z: 0.5 } },
]

const boxSize = { x: 1.0, y: 1.0, z: 1.0 }

export default function Page() {
    const [itemIndex, setItemIndex] = useState(1)

    function incrementSolution(by: number = 1): void {
        setItemIndex((currentIndex) => Math.max(1, Math.min(packingSolution.length, Math.floor(currentIndex + by))))
    }

    return <div style={containerStyle}>
        <button onClick={() => {incrementSolution(+1)}}>NEXT ITEM</button>
        <button onClick={() => {incrementSolution(-1)}}>PREVIOUS ITEM</button>
        <Canvas style={canvasStyle} >
            <ambientLight intensity={2.0}/>
            <PackageDisplay items={packingSolution.slice(0, itemIndex)} size={boxSize} ghostAnimationTime={2.5} />
            <OrbitControls enableDamping />
        </Canvas>
    </div>
}
