"use client";
import type { ReactElement } from "react";

import VisualiserCanvas from "@/components/visualiser-v2/visualiserCanvas";

import type { Item, Package, Order, VisualiserState } from "@/lib/visualiserState";

const vState: VisualiserState = {
    displayOrder: {} as Order,
    selectedPackageIndex: null, 
    packageInspectMode: "package",
    packageItemIndices: new WeakMap(),
}

export default function VisualiserPage(): ReactElement {
    return <div style={{ width: "100%", height: "100vh" }}>
        <VisualiserCanvas visualiserState={vState}/>
    </div>
}
