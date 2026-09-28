export interface VisualiserConfig {
    packagesPerRow: number,
    packageMargin: number,

    idleColor: string,
    selectedColor: string,
    displayItemColor: string,
    highlightItemColor: string,
    
    colorTransitionHalfLife: number,
    pointerSensitivity: number,

    selectedPackageScale: number,
    initialOrientation: { yaw: number, pitch:  number },
    idleRotationSpeed: { yaw: number, pitch: number },
    
    orderErrorHalfLife: number,
    dropDistance: number,
    ghostOpacity: number,
    animationSmoothness: number,

    spawnAnimationTime: number,
    dropAnimationTime: number,
    pauseAnimationTime: number,
}
