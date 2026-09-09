import { useTexture } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useRef } from "react"
import { BackSide, Vector3 } from "three"


export function GridSphere() {
    const { camera } = useThree()
    const sphere = useRef({ position: new Vector3(0, 0, 0) })
    const texture = useTexture("/grid.png")
  
    useFrame(() => {
      sphere.current.position
        .copy(camera.position)
        .add(camera.getWorldDirection(new Vector3()).multiplyScalar(2))
    })
  
    return (
      <mesh ref={sphere}>
        <sphereGeometry args={[10.0, 128, 128]} />
        <meshBasicMaterial side={BackSide} color="white" transparent={true} opacity={0.25} map={texture}/>
      </mesh>
    )
  }