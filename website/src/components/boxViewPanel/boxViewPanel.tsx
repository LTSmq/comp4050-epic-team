"use client"
import { ReactElement, } from 'react';

import { Vector3 } from "three"
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

import "./boxViewPanel.module.css"

type ItemIdentifier = string
export type Item = {
    identifier: ItemIdentifier,  // Different from product SKU
    position: Vector3,
    size: Vector3,
    color?: string,
}

interface PackageProps { size: Vector3, items?: Item[], positionHalfLife?: number, snapDistance?: number } 
export function Package(props: PackageProps): ReactElement {
    const meshRefs = useRef<Record<ItemIdentifier, any>>({})
    const currentPositionsRef = useRef<Record<ItemIdentifier, Vector3>>({})

    const items: Item[] = props.items || []
    const halfLife: number = props.positionHalfLife || Math.pow(2, -3)
    const snapDistance: number = props.snapDistance || Math.pow(2, -16)
    const snapDistanceSquared: number = snapDistance * snapDistance

    useFrame((_state, delta: number) => {
        const fraction: number = 1.0 - Math.pow(0.5, delta / halfLife)
        const currentPositions = currentPositionsRef.current
        
        for (const item of items) {
            let currentPosition: Vector3 = currentPositions[item.identifier] || item.position.clone()
            
            if (item.position.distanceToSquared(currentPosition) <= snapDistanceSquared) {
                currentPosition.set(...item.position.toArray())
            }
            else {
                currentPosition = currentPosition.lerp(item.position, fraction)
            }
            currentPositions[item.identifier] = currentPosition
            
            if (meshRefs.current[item.identifier]) {
                meshRefs.current[item.identifier].position.copy(currentPosition)
            }
        }
    })

    return (
        <group>
            {items.map((item: Item) => {
                return <mesh 
                    ref={(mesh: any) => { if (mesh) meshRefs.current[item.identifier] = mesh }}
                    position={[0, 0, 0]} 
                    key={item.identifier}>
                    <boxGeometry args={item.size.toArray()} />
                    <meshStandardMaterial color={item.color || "red"} />
                </mesh>
            })}
        </group>
    )
}
