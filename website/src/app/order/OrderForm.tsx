"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import styles from "./order.module.css";

type ApiRecord = Record<string, unknown>;

type OrderFormProps = {
  username: string;
};

function toRecords(
  value: unknown,
  possibleKeys: string[]
): ApiRecord[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is ApiRecord =>
        typeof item === "object" &&
        item !== null
    );
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const object = value as ApiRecord;

    for (const key of possibleKeys) {
      if (Array.isArray(object[key])) {
        return (object[key] as unknown[]).filter(
          (item): item is ApiRecord =>
            typeof item === "object" &&
            item !== null
        );
      }
    }

    return [object];
  }

  return [];
}

function getOrderId(order: ApiRecord) {
  return (
    order.orderID ??
    order.orderId ??
    order.OrderID ??
    order.id ??
    order.ID ??
    ""
  );
}

function getBoxId(box: ApiRecord) {
  return (
    box.boxID ??
    box.boxId ??
    box.BoxID ??
    box.id ??
    box.ID ??
    box.Reference ??
    ""
  );
}

function isReadOnlyField(key: string) {
  return [
    "orderID",
    "orderId",
    "OrderID",
    "boxID",
    "boxId",
    "BoxID",
    "ItemCode",
  ].includes(key);
}

type RecordEditorProps = {
  record: ApiRecord;
  onChange: (
    key: string,
    value: unknown
  ) => void;
};

function RecordEditor({
  record,
  onChange,
}: RecordEditorProps) {
  return (
    <div className={styles.recordGrid}>
      {Object.entries(record).map(
        ([key, value]) => {
          /*
           * Nested arrays/objects are handled by the
           * box/item sections rather than being rendered
           * as normal text inputs.
           */
          if (
            typeof value === "object" &&
            value !== null
          ) {
            return null;
          }

          if (typeof value === "boolean") {
            return (
              <label
                key={key}
                className={styles.field}
              >
                <span>{key}</span>

                <select
                  value={String(value)}
                  disabled={isReadOnlyField(key)}
                  onChange={(event) =>
                    onChange(
                      key,
                      event.target.value === "true"
                    )
                  }
                >
                  <option value="true">
                    True
                  </option>

                  <option value="false">
                    False
                  </option>
                </select>
              </label>
            );
          }

          return (
            <label
              key={key}
              className={styles.field}
            >
              <span>{key}</span>

              <input
                type={
                  typeof value === "number"
                    ? "number"
                    : "text"
                }
                value={
                  value === null ||
                  value === undefined
                    ? ""
                    : String(value)
                }
                readOnly={isReadOnlyField(key)}
                onChange={(event) => {
                  const newValue =
                    typeof value === "number"
                      ? Number(event.target.value)
                      : event.target.value;

                  onChange(key, newValue);
                }}
              />
            </label>
          );
        }
      )}
    </div>
  );
}

export default function OrderForm({
  username,
}: OrderFormProps) {
  const [orders, setOrders] = useState<
    ApiRecord[]
  >([]);

  const [
    selectedOrderIndex,
    setSelectedOrderIndex,
  ] = useState<number | null>(null);

  const [boxes, setBoxes] = useState<
    ApiRecord[]
  >([]);

  const [
    selectedBoxIndex,
    setSelectedBoxIndex,
  ] = useState<number | null>(null);

  const [items, setItems] = useState<
    ApiRecord[]
  >([]);

  const [loadingOrders, setLoadingOrders] =
    useState(true);

  const [loadingBoxes, setLoadingBoxes] =
    useState(false);

  const [loadingItems, setLoadingItems] =
    useState(false);

  const [error, setError] = useState("");

  const selectedOrder =
    selectedOrderIndex !== null
      ? orders[selectedOrderIndex]
      : null;

  const selectedBox =
    selectedBoxIndex !== null
      ? boxes[selectedBoxIndex]
      : null;

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoadingOrders(true);
    setError("");

    try {
      const response = await fetch(
        "/json/order",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load orders (${response.status})`
        );
      }

      const data = await response.json();

      const loadedOrders = toRecords(
        data,
        ["orders", "order"]
      );

      setOrders(loadedOrders);
    } catch (error) {
      console.error(
        "Order loading failed:",
        error
      );

      setError(
        "Unable to load orders from the order service."
      );
    } finally {
      setLoadingOrders(false);
    }
  }

  async function selectOrder(index: number) {
    const order = orders[index];
    const orderID = getOrderId(order);

    if (
      orderID === "" ||
      orderID === undefined ||
      orderID === null
    ) {
      setError(
        "The selected order does not contain an orderID."
      );

      return;
    }

    setSelectedOrderIndex(index);
    setSelectedBoxIndex(null);
    setBoxes([]);
    setItems([]);
    setError("");
    setLoadingBoxes(true);

    try {
      /*
       * Keep this URL exactly in line with the
       * parser/API structure agreed by the team.
       */
      const response = await fetch(
        `/json/order?=${encodeURIComponent(
          String(orderID)
        )}/box`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load boxes (${response.status})`
        );
      }

      const data = await response.json();

      setBoxes(
        toRecords(data, ["boxes", "box"])
      );
    } catch (error) {
      console.error(
        "Box loading failed:",
        error
      );

      setError(
        `Unable to load boxes for order ${String(
          orderID
        )}.`
      );
    } finally {
      setLoadingBoxes(false);
    }
  }

  async function selectBox(index: number) {
    if (!selectedOrder) {
      return;
    }

    const orderID =
      getOrderId(selectedOrder);

    const box = boxes[index];
    const boxID = getBoxId(box);

    if (
      boxID === "" ||
      boxID === undefined ||
      boxID === null
    ) {
      setError(
        "The selected box does not contain a box identifier."
      );

      return;
    }

    setSelectedBoxIndex(index);
    setItems([]);
    setError("");
    setLoadingItems(true);

    try {
      /*
       * Again, this intentionally follows the
       * parser route exactly as agreed.
       */
      const response = await fetch(
        `/json/order?=${encodeURIComponent(
          String(orderID)
        )}/box?=${encodeURIComponent(
          String(boxID)
        )}/item`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load items (${response.status})`
        );
      }

      const data = await response.json();

      setItems(
        toRecords(data, ["items", "item"])
      );
    } catch (error) {
      console.error(
        "Item loading failed:",
        error
      );

      setError(
        `Unable to load items for box ${String(
          boxID
        )}.`
      );
    } finally {
      setLoadingItems(false);
    }
  }

  function updateOrder(
    key: string,
    value: unknown
  ) {
    if (selectedOrderIndex === null) {
      return;
    }

    setOrders((currentOrders) =>
      currentOrders.map(
        (order, index) =>
          index === selectedOrderIndex
            ? {
                ...order,
                [key]: value,
              }
            : order
      )
    );
  }

  function updateBox(
    key: string,
    value: unknown
  ) {
    if (selectedBoxIndex === null) {
      return;
    }

    setBoxes((currentBoxes) =>
      currentBoxes.map(
        (box, index) =>
          index === selectedBoxIndex
            ? {
                ...box,
                [key]: value,
              }
            : box
      )
    );
  }

  function updateItem(
    itemIndex: number,
    key: string,
    value: unknown
  ) {
    setItems((currentItems) =>
      currentItems.map(
        (item, index) =>
          index === itemIndex
            ? {
                ...item,
                [key]: value,
              }
            : item
      )
    );
  }

  return (
    <div className={styles.page}>
      <nav className={styles.navbar}>
        <Link
          href="/"
          className={styles.brand}
        >
          <div className={styles.brandMark}>
            <span />
            <span />
            <span />
          </div>

          <div className={styles.brandText}>
            <strong>THOMAX</strong>
            <span>.wms · Perfect Fit</span>
          </div>
        </Link>

        <div className={styles.navLinks}>
  <Link href="/portal">
    Portal
  </Link>

  <Link href="/visualiser">
    Visualiser
  </Link>

  <Link
    href="/account"
    className={styles.accountButton}
  >
    {username}
  </Link>
</div>
      </nav>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>
              <span
                className={styles.liveDot}
              />

              ORDERS
            </div>

            <h1>
              Review your
              <span> orders.</span>
            </h1>

            <p>
              Select an existing order to review
              its details, boxes and items.
            </p>
          </div>

          <Link
            href="/portal"
            className={styles.backLink}
          >
            ← Back to portal
          </Link>
        </header>

        {error && (
          <div
            className={styles.error}
            role="alert"
          >
            {error}
          </div>
        )}

        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <div>
              <span
                className={styles.sectionLabel}
              >
                AVAILABLE ORDERS
              </span>

              <h2>Select an order</h2>
            </div>

            <span className={styles.stepBadge}>
              01
            </span>
          </div>

          {loadingOrders ? (
            <p className={styles.emptyState}>
              Loading orders...
            </p>
          ) : orders.length === 0 ? (
            <p className={styles.emptyState}>
              No orders are currently available.
            </p>
          ) : (
            <div className={styles.listGrid}>
              {orders.map((order, index) => {
                const id =
                  getOrderId(order);

                return (
                  <button
                    key={`${String(id)}-${index}`}
                    type="button"
                    className={`${styles.selectCard} ${
                      selectedOrderIndex ===
                      index
                        ? styles.selectCardActive
                        : ""
                    }`}
                    onClick={() =>
                      selectOrder(index)
                    }
                  >
                    <span>ORDER</span>

                    <strong>
                      {String(
                        id || index + 1
                      )}
                    </strong>

                    <small>
                      View order →
                    </small>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedOrder && (
          <section
            className={styles.section}
          >
            <div
              className={styles.sectionTitle}
            >
              <div>
                <span
                  className={
                    styles.sectionLabel
                  }
                >
                  ORDER DETAILS
                </span>

                <h2>
                  Order{" "}
                  {String(
                    getOrderId(
                      selectedOrder
                    )
                  )}
                </h2>
              </div>

              <span
                className={styles.stepBadge}
              >
                02
              </span>
            </div>

            <RecordEditor
              record={selectedOrder}
              onChange={updateOrder}
            />
          </section>
        )}

        {selectedOrder && (
          <section
            className={styles.section}
          >
            <div
              className={styles.sectionTitle}
            >
              <div>
                <span
                  className={
                    styles.sectionLabel
                  }
                >
                  BOXES
                </span>

                <h2>
                  Order boxes
                </h2>
              </div>

              <span
                className={styles.stepBadge}
              >
                03
              </span>
            </div>

            {loadingBoxes ? (
              <p className={styles.emptyState}>
                Loading boxes...
              </p>
            ) : boxes.length === 0 ? (
              <p className={styles.emptyState}>
                No boxes were returned for this
                order.
              </p>
            ) : (
              <div
                className={styles.listGrid}
              >
                {boxes.map((box, index) => {
                  const boxID =
                    getBoxId(box);

                  return (
                    <button
                      type="button"
                      key={`${String(
                        boxID
                      )}-${index}`}
                      className={`${styles.selectCard} ${
                        selectedBoxIndex ===
                        index
                          ? styles.selectCardActive
                          : ""
                      }`}
                      onClick={() =>
                        selectBox(index)
                      }
                    >
                      <span>BOX</span>

                      <strong>
                        {String(
                          boxID ||
                            index + 1
                        )}
                      </strong>

                      <small>
                        View contents →
                      </small>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {selectedBox && (
          <section
            className={styles.section}
          >
            <div
              className={styles.sectionTitle}
            >
              <div>
                <span
                  className={
                    styles.sectionLabel
                  }
                >
                  SELECTED BOX
                </span>

                <h2>
                  Box{" "}
                  {String(
                    getBoxId(
                      selectedBox
                    )
                  )}
                </h2>
              </div>

              <span
                className={styles.stepBadge}
              >
                04
              </span>
            </div>

            <RecordEditor
              record={selectedBox}
              onChange={updateBox}
            />
          </section>
        )}

        {selectedBox && (
          <section
            className={styles.section}
          >
            <div
              className={styles.sectionTitle}
            >
              <div>
                <span
                  className={
                    styles.sectionLabel
                  }
                >
                  ITEMS
                </span>

                <h2>
                  Box contents
                </h2>
              </div>

              <span
                className={styles.stepBadge}
              >
                05
              </span>
            </div>

            {loadingItems ? (
              <p className={styles.emptyState}>
                Loading items...
              </p>
            ) : items.length === 0 ? (
              <p className={styles.emptyState}>
                No items were returned for this
                box.
              </p>
            ) : (
              <div className={styles.items}>
                {items.map(
                  (item, itemIndex) => (
                    <div
                      key={itemIndex}
                      className={
                        styles.itemCard
                      }
                    >
                      <div
                        className={
                          styles.itemHeading
                        }
                      >
                        <div>
                          <span
                            className={
                              styles.itemLabel
                            }
                          >
                            ITEM{" "}
                            {String(
                              itemIndex + 1
                            ).padStart(
                              2,
                              "0"
                            )}
                          </span>

                          <h3>
                            {String(
                              item.ItemReference ??
                                item.ItemCode ??
                                `Item ${
                                  itemIndex +
                                  1
                                }`
                            )}
                          </h3>
                        </div>
                      </div>

                      <RecordEditor
                        record={item}
                        onChange={(
                          key,
                          value
                        ) =>
                          updateItem(
                            itemIndex,
                            key,
                            value
                          )
                        }
                      />
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        )}

        {(selectedOrder ||
          selectedBox ||
          items.length > 0) && (
          <div className={styles.actions}>
            <div>
              <span
                className={
                  styles.actionLabel
                }
              >
                EDIT MODE
              </span>

              <p>
                Changes can be edited here. They
                are not yet written back to the
                API until the parser provides the
                write method.
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className={styles.footer}>
        <div>
          <strong>THOMAX .WMS</strong>
          <span>Perfect Fit</span>
        </div>

        <div
          className={styles.footerRight}
        >
          <span
            className={styles.footerDot}
          >
            ●
          </span>

          <span>
            Signed in as {username}
          </span>
        </div>
      </footer>
    </div>
  );
}