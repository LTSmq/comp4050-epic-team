"use client"
import { Vector3, } from "three"
import { Canvas, } from "@react-three/fiber"

import { Item, Package } from "@/components/boxViewPanel/boxViewPanel"
import { containerStyle, controlsPanelStyle, buttonGroupStyle, buttonUpStyle, buttonDownStyle } from "./styles"

const items: Item[] = [
    { identifier: "box1",   position: new Vector3(0.0, 0.0, 0.0),   size: new Vector3(1.0, 1.0, 1.0), color: "red" },
    { identifier: "box2",   position: new Vector3(1.0, 0.0, 0.0),   size: new Vector3(1.0, 1.0, 2.0), color: "green" },
    { identifier: "box3",   position: new Vector3(2.0, 0.0, 0.0),   size: new Vector3(1.0, 1.0, 3.0), color: "blue" },
]

interface MoveButtonProps { identifier: string }
function MoveButton(props: MoveButtonProps) {
    function move(itemIdentifier: string, delta: Vector3) {
        for (const item of items) {
            if (item.identifier == itemIdentifier) {
                item.position = item.position.clone().add(delta)
            }
        }
    }

    return <div style={buttonGroupStyle}>
        <button 
            onClick={() => move(props.identifier, new Vector3(0.0, +1.0, 0.0))}
            style={buttonUpStyle}
        >
            Move {props.identifier} UP
        </button>
        <button 
            onClick={() => move(props.identifier, new Vector3(0.0, -1.0, 0.0))}
            style={buttonDownStyle}
        >
            Move {props.identifier} DOWN
        </button>
    </div>
}

export default function TestPage() {
    return <div style={containerStyle}>
        <Canvas 
            camera={{ position: [1, 4, 3], rotation: [
                Math.PI * (-5 / 16), 
                Math.PI * (+0 / 1), 
                Math.PI * (+0 / 1), 
            ]}} 
            frameloop={"always"}
        >
            <ambientLight intensity={5.0} />
            <directionalLight />
            <Package size={new Vector3(2.5, 2.5, 2.5)} items={items}/>
        </Canvas>
        <div style={controlsPanelStyle}>
            {items.map((item: Item) => {
                return <MoveButton key={item.identifier} identifier={item.identifier} />
            })}
        </div>
    </div>
}
