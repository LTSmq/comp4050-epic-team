"use client";
import type { ReactElement } from "react";
import { useState } from "react";

import { useFrame } from "@react-three/fiber"

import VisualiserCanvas from "@/components/visualiser-v2/visualiserCanvas";

import type { Order, VisualiserState } from "@/lib/visualiserState";

function acceptOrder(order: Order): VisualiserState {
    return {
        displayOrder: order,
        selectedPackageIndex: null, 
        packageInspectMode: "package",
        packageItemIndices: [],
    }
}

export default function VisualiserClient(props: { order: Order }): ReactElement {
    const [vState, setVState]: [VisualiserState, (override: VisualiserState) => void] 
    = useState(acceptOrder(props.order));

    return <div style={{ width: "100%", height: "100vh" }}>
        <VisualiserCanvas 
            visualiserState={vState}
            onPackageSelected={(selectedIndex: number) => {
                vState.selectedPackageIndex = (vState.selectedPackageIndex == selectedIndex) ? null : selectedIndex;
            }}
        />
    </div>
}
