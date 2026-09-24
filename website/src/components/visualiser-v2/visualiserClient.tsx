"use client";
import type { ReactElement } from "react";
import { useState } from "react";

import VisualiserCanvas from "@/components/visualiser-v2/visualiserCanvas";

import type { Order, VisualiserState } from "@/lib/visualiserState";

function acceptOrder(order: Order): VisualiserState {
    return {
        displayOrder: order,
        selectedPackageIndex: null, 
        packageInspectMode: "package",
        packageItemIndices: order.packages.map(() => 0),
    }
}

function assessDisplayState(vState: VisualiserState): "order" | "package" | "items" {
    if (vState.selectedPackageIndex == null) return "order";
    return vState.packageInspectMode;
}

export default function VisualiserClient(props: { order: Order }): ReactElement {
    const [vState, setVState]: [VisualiserState, (override: VisualiserState) => void] 
    = useState(acceptOrder(props.order));

    const displayState: "order" | "package" | "items" = assessDisplayState(vState);

    function incrementPackage(by: number = 1): void {
        if (vState.selectedPackageIndex == null) return;
        if (vState.displayOrder == null) return;
        const maxIndex = vState.displayOrder.packages.length - 1;
        if (vState.displayOrder.packages.length < 0) return;

        const newIndex = Math.max(0, Math.min(maxIndex, vState.selectedPackageIndex + by));
        setVState({...vState, selectedPackageIndex: newIndex});
    }

    function incrementItem(by: number = 1): void {
        if (vState.selectedPackageIndex == null) return;
        const packageItems: any[] | undefined = vState?.displayOrder?.packages?.[vState.selectedPackageIndex]?.items;
        if (packageItems == null || packageItems.length <= 0) return;

        const indices: number[] = vState.packageItemIndices;

        while (indices.length <= vState.selectedPackageIndex) indices.push(0);
        
        const currentIndex: number = vState.packageItemIndices[vState.selectedPackageIndex]
        const newIndex = Math.max(0, Math.min(packageItems.length - 1, currentIndex + by));
        indices[vState.selectedPackageIndex] = newIndex;
        
        setVState({...vState, packageItemIndices: indices});  // array assignment is redundant but done anyway for clarity
    }

    function selectPackage(index: number): void {
        setVState({ ...vState, selectedPackageIndex: index });
    }

    function deselectPackage(): void { setVState({ ...vState, selectedPackageIndex: null }); }
    function inspectItems():    void { setVState({ ...vState, packageInspectMode: "items" }); }
    function inspectPackage():  void { setVState({ ...vState, packageInspectMode: "package" }); }
    function nextPackage():     void { incrementPackage(+1); }
    function previousPackage(): void { incrementPackage(-1); }
    function nextItem():        void { incrementItem(+1); }
    function previousItem():    void { incrementItem(-1); }

    return <div style={{ width: "100%", height: "100vh" }}>
        {("order" === displayState) && <div>
            <div>SELECT A PACKAGE!</div>
        </div>}
        
        {(["package", "items"].includes(displayState)) && <div>
            <div>{`PACKAGE NUMBER ${vState.selectedPackageIndex ?? 0 + 1}`}</div>
            <button onClick={nextPackage}>NEXT PACKAGE</button>
            <button onClick={previousPackage}>PREVIOUS PACKAGE</button>
        </div>}

        {("package" === displayState) && <div>
            <button onClick={deselectPackage}>BROWSE ALL PACKAGES</button>
            <button onClick={inspectItems}>INSPECT ITEMS</button>
        </div>}
        {("items" === displayState) && <div>
            <button onClick={nextItem}>NEXT ITEM</button>
            <button onClick={previousItem}>PREVIOUS ITEM</button>
            <button onClick={inspectPackage}>INSPECT PACKAGE DATA</button>
        </div>}
        <VisualiserCanvas 
            visualiserState={vState}
            onPackageSelected={selectPackage}
        />
    </div>
}
