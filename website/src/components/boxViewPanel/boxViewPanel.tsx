"use client"
import type { ReactElement } from 'react'
import { useState, useRef } from "react"

import { Vector3 } from "three"
import { useFrame } from '@react-three/fiber'
import { Box, Edges } from "@react-three/drei"

import "./boxViewPanel.module.css"

type InterpolationMode = "linear" | "cubic" | "sinusoid"
function interpolate(fraction: number, mode: InterpolationMode = "cubic"): number {
    if (mode === "cubic") return (3 - (2 * fraction)) * fraction * fraction  // Smoothstep polynomial
    if (mode === "sinusoid") return (1.0 - Math.cos(Math.PI * fraction)) / 2.0  // Sine wave
    return fraction
}

type Vector3Portable = Vector3 | { x: number, y: number, z: number }

function parseVec3(vec3Portable: Vector3Portable | undefined): Vector3 {
    if (vec3Portable == null) return new Vector3()
    if (vec3Portable instanceof Vector3) return vec3Portable
    return new Vector3(vec3Portable.x, vec3Portable.y, vec3Portable.z)
}

export interface Item {
    uuid: string,
    sku?: string,
    position: Vector3Portable,
    size: Vector3Portable, 
}

interface ItemDisplayProps {
    reference: Item,
    opacity?: number
    color?: string,
    renderOrder?: number,
    depthTest?: boolean,
}

interface PackageDisplayProps {
    items?: Item[]
    size?: Vector3Portable,
    ghostAnimationTime?: number,
    topMargin?: number,
}

export function ItemDisplay(props: ItemDisplayProps): ReactElement {
    const size: Vector3 = (new Vector3()).copy(parseVec3(props.reference.size)).multiplyScalar(-1)
    const position: Vector3 = (new Vector3()).copy(parseVec3(props.reference.position))
    const offset: Vector3 = (new Vector3()).copy(size).divideScalar(2)
    const center: Vector3 = (new Vector3()).copy(position).sub(offset)

    return <Box position={center} args={size.toArray()}>
        <meshStandardMaterial color={props.color || "#AAAAAA"} transparent opacity={props.opacity ?? 1.0} depthTest={props.depthTest ?? true} />
        <Edges color={"black"} lineWidth={3}/>
    </Box>
}

export function PackageDisplay(props: PackageDisplayProps = {}): ReactElement {
    const ref = useRef({ ghostTimer: 0.0 })
    const [, requestRender] = useState(0)

    const items: Item[] = props.items || []
    const size: Vector3 = parseVec3(props.size)
    const box: Item = {
        uuid: `OUTER-BOX`,
        position: new Vector3(),  // Zero
        size: size,
    }
    const ghostTime: number = props.ghostAnimationTime || 1.0

    useFrame((_state, delta: number) => { 
        ref.current.ghostTimer += delta
        while (ref.current.ghostTimer > (ghostTime)) {
            ref.current.ghostTimer -= ghostTime
        }
        requestRender((frame) => frame + 1)
    })
    
    let ghostItem: Item | undefined = undefined
    let fallingItem: Item | undefined = undefined
    const candidate: Item | undefined = items.at(-1)
    if (candidate != null) {
        fallingItem = {...candidate}
        fallingItem.uuid = `falling:${candidate.uuid}`
        fallingItem.position = (new Vector3()).copy(candidate.position)

        const topMargin: number = props.topMargin ?? 0.1
        const progress: number = ref.current.ghostTimer / ghostTime
        const span: number = topMargin + size.y - fallingItem.position.y
        const animatedAltitude: number = size.y - (span * interpolate(progress, "cubic"))
        fallingItem.position.y = animatedAltitude + topMargin

        ghostItem = {...candidate}
        ghostItem.uuid =  `ghost:${candidate.uuid}`
        ghostItem.size = (new Vector3()).copy(candidate.size)
        ghostItem.size.y = Math.min(ghostItem.size.y, fallingItem.position.y - ghostItem.position.y)
    }
    
    return <group>
        <ItemDisplay reference={box} color={"blue"} opacity={0.05} depthTest={false}/>
        {items.slice(0, items.length-1).map((item) => { return <ItemDisplay key={item.uuid} reference={item} opacity={0.95}/> })}
        {(fallingItem != null) && <ItemDisplay reference={fallingItem} color={"red"} opacity={1.0}/>}
        {(ghostItem != null) && <ItemDisplay reference={ghostItem} color={"red"} opacity={0.2}/>}
        
    </group>
}
