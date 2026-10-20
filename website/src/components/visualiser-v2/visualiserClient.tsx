"use client";
import type { ReactElement } from "react";
import { useId, useReducer, useState } from "react";

import SideMenu from "@/components/sideMenu/sideMenu";
import VisualiserCanvas from "@/components/visualiser-v2/visualiserCanvas";
import VisualiserControls from "@/components/visualiser-v2/visualiserControls";
import { ItemInfoPanel } from "@/components/visualiser-v2/itemInfoPanel";
import styles from "./visualiserPage.module.css";

import { clamp } from "@/lib/clamp";
import {
    getDisplayState,
    getPackageStepIndex,
    initVisualiserState,
    visualiserReducer,
    type Order,
    type Package,
} from "@/lib/visualiserState";
import type { VisualiserConfig } from "@/lib/visualiserConfig";

const ZOOM_STEP: number = 1.2;
const MIN_ZOOM: number = 0.5;
const MAX_ZOOM: number = 4.0;

const CANVAS_CONFIG: Partial<VisualiserConfig> = {
    displayItemColor: "#00FF00",
    dropAnimationTime: 2.0,
    pauseAnimationTime: 0.5,
};

export default function VisualiserClient({ order }: { order: Order }): ReactElement {
    const packageSelectorId = useId();
    const [zoom, setZoom] = useState<number>(1.0);
    const [vState, dispatch] = useReducer(visualiserReducer, order, initVisualiserState);

    const displayState = getDisplayState(vState);
    const { selectedPackageIndex, displayOrder, packageItemIndices } = vState;
    const selectedPackage: Package | undefined = (selectedPackageIndex != null)
        ? displayOrder.packages[selectedPackageIndex]
        : undefined;
    const itemCount: number = selectedPackage?.items.length ?? 0;
    const itemIndex: number = (selectedPackageIndex != null) ? packageItemIndices[selectedPackageIndex] ?? 0 : 0;
    const inspectedItem = (displayState === "items") ? selectedPackage?.items[itemIndex] : undefined;

    return (
        <div className={styles.client}>
            <div className={styles.packagePicker}>
                <label htmlFor={packageSelectorId}>Package</label>
                <select
                    id={packageSelectorId}
                    value={selectedPackageIndex ?? ""}
                    onChange={(event) => dispatch({
                        type: "selectPackage",
                        index: event.target.value === "" ? null : Number(event.target.value),
                    })}
                >
                    <option value="">All packages ({displayOrder.packages.length})</option>
                    {displayOrder.packages.map((package_, index) => (
                        <option key={index} value={index}>
                            {index + 1}: {package_.reference ?? "Package"} ({package_.items.length} items)
                        </option>
                    ))}
                </select>
            </div>
            <div className={styles.viewport}>
                <VisualiserCanvas
                    visualiserState={vState}
                    onPackageSelected={(index) => dispatch({ type: "selectPackage", index })}
                    zoom={zoom}
                    config={CANVAS_CONFIG}
                />
            </div>

            <SideMenu
                title={selectedPackage?.reference ? `Item Info (${selectedPackage.reference})` : "Item Info"}
                ariaLabel="Item Information"
                collapsedContent={<span className={styles.railCounter}>{inspectedItem ? itemIndex + 1 : 0}/{itemCount}</span>}
            >
                <ItemInfoPanel item={inspectedItem} />
                <p className={styles.progress} role="status">
                    {selectedPackageIndex == null
                        ? `${displayOrder.packages.length} packages`
                        : `Package ${selectedPackageIndex + 1} of ${displayOrder.packages.length} · Item ${inspectedItem ? itemIndex + 1 : 0} of ${itemCount}`}
                </p>
            </SideMenu>

            <VisualiserControls
                displayState={displayState}
                dispatch={dispatch}
                canStepPreviousPackage={getPackageStepIndex(vState, -1) !== selectedPackageIndex}
                canStepNextPackage={getPackageStepIndex(vState, 1) !== selectedPackageIndex}
                canInspectItems={itemCount > 0}
                canStepPreviousItem={itemIndex > 0}
                canStepNextItem={itemIndex < itemCount - 1}
                onZoomIn={() => setZoom((current) => clamp(current * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
                onZoomOut={() => setZoom((current) => clamp(current / ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
            />
        </div>
    );
}
