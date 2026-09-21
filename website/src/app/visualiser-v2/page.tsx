import { readFileSync as readFile } from "fs";

import type { ReactElement } from "react";

import VisualiserClient from "@/components/visualiser-v2/visualiserClient";

import type {  Order, VisualiserState } from "@/lib/visualiserState";

const TEST_ORDER_NUMBER: number = 1;

const order: Order = JSON.parse(readFile("./src/app/visualiser-v2/sample-data.json", "utf-8"))["orders"][TEST_ORDER_NUMBER];

export default function VisualiserPage(): ReactElement {
    return <VisualiserClient order={order} />
}
