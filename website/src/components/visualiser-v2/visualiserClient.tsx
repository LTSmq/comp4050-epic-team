"use client";
import type { ReactElement } from "react";
import type { WheelEvent } from "react";
import { useState } from "react";

import VisualiserCanvas from "@/components/visualiser-v2/visualiserCanvas";

import type { Order, VisualiserState } from "@/lib/visualiserState";

const SCROLL_SENSITIVTY: number = 0.0005;
const buttonSymbols: Record<string, string> = {
    inspectItems: "🔍︎",
    inspectPackage: "⮽",
    back: "𓃑",
    nextPackage: "↠",
    previousPackage: "↞",
    nextItem: "→",
    previousItem: "←",
}

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
    const [scroll, setScroll] = useState<number>(0.0);
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

    function scrollBy(amount: number) { 
        setScroll(Math.max(0.0, Math.min(1.0, scroll + (amount * SCROLL_SENSITIVTY))));
    }

    function deselectPackage(): void { setVState({ ...vState, selectedPackageIndex: null }); }
    function inspectItems():    void { setVState({ ...vState, packageInspectMode: "items" }); }
    function inspectPackage():  void { setVState({ ...vState, packageInspectMode: "package" }); }
    function nextPackage():     void { incrementPackage(+1); }
    function previousPackage(): void { incrementPackage(-1); }
    function nextItem():        void { incrementItem(+1); }
    function previousItem():    void { incrementItem(-1); }
    function onScroll(event: WheelEvent<HTMLDivElement>): void { scrollBy(event.deltaY); }

    return <div>
        <table style={{ width: "100%", tableLayout: "fixed" }}>
            <tbody>
                <tr>
                    <td style={{ width: "50%" }}>
                        <table style={{ width: "100%", tableLayout: "fixed" }}>
                            <tbody>
                                <tr><th style={{ textAlign: "center", width: "100%" }} colSpan={3}>Controls</th></tr>
                                <tr>
                                    <td>
                                        <button 
                                            disabled={displayState==="order"}
                                            onClick={previousPackage}
                                        >
                                            {buttonSymbols.previousPackage}
                                        </button>
                                    </td>
                                    <td>
                                        <button
                                            disabled={displayState!=="package"}
                                            onClick={inspectItems}
                                        >
                                            {buttonSymbols.inspectItems}
                                        </button>

                                    </td>
                                    <td>
                                        <button 
                                            disabled={displayState==="order"}
                                            onClick={nextPackage}
                                        >
                                            {buttonSymbols.nextPackage}
                                        </button>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <button 
                                            disabled={displayState!=="items"}
                                            onClick={previousItem}
                                        >
                                            {buttonSymbols.previousItem}
                                        </button>
                                    </td>
                                    <td>
                                        <button
                                            hidden={displayState!=="items"}
                                            onClick={inspectPackage}
                                        >
                                            {buttonSymbols.inspectPackage}
                                        </button>
                                        <button
                                            hidden={displayState==="items"}
                                            disabled={displayState==="order"}
                                            onClick={deselectPackage}
                                        >
                                            {buttonSymbols.back}
                                        </button>
                                    </td>
                                    <td>
                                        <button 
                                            disabled={displayState!="items"}
                                            onClick={nextItem}
                                        >
                                            {buttonSymbols.nextItem}
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <br />
                        <table>
                            <tbody>
                                <tr>
                                    <th colSpan={2}>Control Scheme</th>
                                </tr>
                                <tr>
                                    <td> Symbol </td>
                                    <td> Usage </td>
                                </tr>
                                <tr>
                                    <td>{buttonSymbols.previousPackage}</td>
                                    <td>Previous Package</td>
                                </tr>
                                <tr>
                                    <td>{buttonSymbols.nextPackage}</td>
                                    <td>Next Package</td>
                                </tr>
                                <tr>
                                    <td>{buttonSymbols.previousItem}</td>
                                    <td>Previous Item</td>
                                </tr>
                                <tr>
                                    <td>{buttonSymbols.nextItem}</td>
                                    <td>Next Item</td>
                                </tr>
                                <tr>
                                    <td>{buttonSymbols.inspectPackage}</td>
                                    <td>Inspect Package</td>
                                </tr>
                                <tr>
                                    <td>{buttonSymbols.inspectItems}</td>
                                    <td>Inspect Items of Package</td>
                                </tr>
                                <tr>
                                    <td>{buttonSymbols.back}</td>
                                    <td>View All Packages</td>
                                </tr>
                                <tr>
                                    <th colSpan={2}>Click package in canvas to select</th>
                                </tr>
                            </tbody>

                        </table>
                    </td>
                    <td style={{ width: "50%", height: "90vh" }}>
                        <div
                            style={{ width: "100%", height: "100%" }} 
                            onWheelCapture={onScroll}
                        >
                            <VisualiserCanvas 
                                visualiserState={vState}
                                onPackageSelected={selectPackage}
                                scroll={scroll}
                            />
                        </div>
                    </td>
                    
                </tr>
            </tbody>
        </table>
        
    </div>
}
