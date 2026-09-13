"use client";

/**
 * OrderForm Client Orchestrator (`/orders`)
 *
 * Responsibility:
 * Central client state orchestrator for the order management workflow. Coordinates:
 * - Local & staged order queues (`savedOrders` from MongoDB, `stagedOrders` from imports/external)
 * - Order composer toggles (manual creation via `<ManualOrderComposer />`, file uploads via `<ImportOrderComposer />`)
 * - Order inspection and item editing via `<OrderInspector />`
 * - Persistence CRUD requests to `/api/orders/saved`
 */

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ImportOrderComposer from "@/components/orderForm/ImportOrderComposer";
import ManualOrderComposer from "@/components/orderForm/ManualOrderComposer";
import OrderInspector from "@/components/orderForm/OrderInspector";
import OrderRow from "@/components/orderForm/OrderRow";
import styles from "@/components/orderForm/styles/orderForm.module.css";
import {
  emptyItem,
  extractExternalOrders,
  mergeOrders,
  normaliseItem,
  normaliseOrder,
  parseCsvOrders,
  parseJsonOrders,
  updateItemInList,
} from "@/components/orderForm/orderUtils";
import {
  ComposerMode,
  OrderItem,
  OrderRecord,
  SelectedKind,
  OrderFormProps,
} from "@/components/orderForm/types";

export default function OrderForm({
  username,
  embedded = false,
}: OrderFormProps) {
  const router = useRouter();

  const [savedOrders, setSavedOrders] = useState<OrderRecord[]>([]);
  const [stagedOrders, setStagedOrders] = useState<OrderRecord[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [selectedKind, setSelectedKind] = useState<SelectedKind>(null);
  const [composer, setComposer] = useState<ComposerMode>(null);
  const [search, setSearch] = useState("");
  const [loadingExternal, setLoadingExternal] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [manualOrderId, setManualOrderId] = useState("");
  const [manualItems, setManualItems] = useState<OrderItem[]>([emptyItem()]);
  const [importOrderId, setImportOrderId] = useState("");
  const [importFileName, setImportFileName] = useState("");

  /* ===================================================
     LOAD SAVED ORDERS FROM MONGODB
     =================================================== */

  async function loadSavedOrders() {
    try {
      const response = await fetch("/api/orders/saved", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to retrieve saved orders.");
      }

      const data = await response.json();
      setSavedOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (loadError) {
      console.error("Failed to load saved orders:", loadError);
      setError("Unable to load your saved orders.");
    } finally {
      setLoadingSaved(false);
    }
  }

  useEffect(() => {
    const id = setTimeout(() => {
      void loadSavedOrders();
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const allOrders = savedOrders;

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return allOrders;
    }

    return allOrders.filter(
      (order) =>
        order.orderId.toLowerCase().includes(query) ||
        order.source.toLowerCase().includes(query) ||
        order.status.toLowerCase().includes(query),
    );
  }, [allOrders, search]);

  const { externalCount, localCount } = useMemo(() => {
    const external = allOrders.filter(
      (order) => order.source === "External",
    ).length;
    return {
      externalCount: external,
      localCount: allOrders.length - external,
    };
  }, [allOrders]);

  /* ===================================================
     PERSIST & COMMIT ORDER (UNIFIED CRUD)
     =================================================== */

  async function persistOrder(order: OrderRecord, alreadySaved: boolean) {
    const url = alreadySaved
      ? `/api/orders/saved/${encodeURIComponent(order.orderId)}`
      : "/api/orders/saved";

    const response = await fetch(url, {
      method: alreadySaved ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(order),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to save order.");
    }

    return data as OrderRecord;
  }

  async function commitOrder(
    order: OrderRecord,
    options?: { isUpdate?: boolean; onSuccess?: () => void },
  ) {
    setError("");
    setSuccess("");

    try {
      const items = order.items.map((item, index) =>
        normaliseItem(item, index),
      );

      const orderToSave: OrderRecord = {
        ...order,
        items,
      };

      const isUpdate =
        options?.isUpdate ??
        savedOrders.some((existing) => existing.orderId === order.orderId);

      const saved = await persistOrder(orderToSave, isUpdate);

      setSavedOrders((current) => mergeOrders(current, [saved]));
      setSelectedOrder(null);
      setSelectedKind(null);
      setSuccess(`Order ${order.orderId} saved successfully.`);

      options?.onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save order.",
      );
    }
  }

  /* ===================================================
     LOAD EXTERNAL
     =================================================== */

  async function loadExternalOrders() {
    setLoadingExternal(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/orders", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Order source returned ${response.status}`);
      }

      const data = await response.json();
      const loaded = extractExternalOrders(data);
      const savedIds = new Set(savedOrders.map((order) => order.orderId));
      const newOrders = loaded.filter((order) => !savedIds.has(order.orderId));

      setStagedOrders((current) => mergeOrders(current, newOrders));
      setSelectedOrder(null);
      setSelectedKind(null);

      const ignored = loaded.length - newOrders.length;
      setSuccess(
        `${newOrders.length} order${
          newOrders.length === 1 ? "" : "s"
        } loaded for review${
          ignored > 0 ? ` (${ignored} already saved).` : "."
        }`,
      );
    } catch (loadError) {
      console.error("External order load failed:", loadError);
      setError("Unable to load external orders.");
    } finally {
      setLoadingExternal(false);
    }
  }

  /* ===================================================
     SELECT STAGED
     =================================================== */

  async function selectLoadedOrder(order: OrderRecord) {
    setError("");
    setSuccess("");

    if (order.source === "External" && order.items.length === 0) {
      try {
        const response = await fetch(
          `/api/orders/${encodeURIComponent(order.orderId)}`,
          {
            cache: "no-store",
          },
        );

        if (response.ok) {
          const data = await response.json();
          const fullOrder = normaliseOrder(data, "External");

          if (fullOrder) {
            setSelectedOrder(fullOrder);
            setSelectedKind("staged");
            setStagedOrders((current) => mergeOrders(current, [fullOrder]));
            return;
          }
        }
      } catch {
        // Use summary.
      }
    }

    setSelectedOrder({
      ...order,
      items: order.items.map((item) => ({ ...item })),
    });
    setSelectedKind("staged");
  }

  function switchComposer(next: ComposerMode) {
    setComposer(composer === next ? null : next);
    setError("");
    setSuccess("");
  }

  /* ===================================================
     MANUAL ORDER HANDLERS
     =================================================== */

  function updateManualItem(
    index: number,
    field: keyof OrderItem,
    value: string,
  ) {
    setManualItems((current) => updateItemInList(current, index, field, value));
  }

  function addManualItem() {
    setManualItems((current) => [...current, emptyItem()]);
  }

  function removeManualItem(index: number) {
    if (manualItems.length === 1) {
      return;
    }

    setManualItems((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  async function createManualOrder() {
    setError("");
    setSuccess("");

    const orderId = manualOrderId.trim();
    if (!orderId) {
      setError("Order ID is required.");
      return;
    }

    if (savedOrders.some((order) => order.orderId === orderId)) {
      setError(`Order ${orderId} already exists.`);
      return;
    }

    await commitOrder(
      {
        orderId,
        source: "Manual",
        status: "Draft",
        items: manualItems,
      },
      {
        isUpdate: false,
        onSuccess: () => {
          setManualOrderId("");
          setManualItems([emptyItem()]);
          setComposer(null);
        },
      },
    );
  }

  /* ===================================================
     IMPORT HANDLERS
     =================================================== */

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setSuccess("");
    setImportFileName(file.name);

    try {
      const content = await file.text();
      const extension = file.name.split(".").pop()?.toLowerCase();

      let imported: OrderRecord[];
      if (extension === "csv") {
        imported = parseCsvOrders(content, importOrderId);
      } else if (extension === "json") {
        imported = parseJsonOrders(content, importOrderId);
      } else {
        throw new Error("Only CSV and JSON files are supported.");
      }

      const savedIds = new Set(savedOrders.map((order) => order.orderId));
      const newOrders = imported.filter(
        (order) => !savedIds.has(order.orderId),
      );

      setStagedOrders((current) => mergeOrders(current, newOrders));

      if (newOrders.length > 0) {
        setSelectedOrder({
          ...newOrders[0],
          items: newOrders[0].items.map((item) => ({ ...item })),
        });
        setSelectedKind("staged");
      }

      const ignored = imported.length - newOrders.length;
      setSuccess(
        `${newOrders.length} order${
          newOrders.length === 1 ? "" : "s"
        } loaded for review${
          ignored > 0 ? ` (${ignored} already saved).` : "."
        }`,
      );

      setComposer(null);
      setImportOrderId("");
    } catch (importError) {
      console.error("Order import failed:", importError);
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to import the order file.",
      );
    }

    event.target.value = "";
  }

  /* ===================================================
     SELECTED ORDER EDIT / SAVE / DELETE
     =================================================== */

  function updateSelectedItem(
    index: number,
    field: keyof OrderItem,
    value: string,
  ) {
    setSelectedOrder((current) =>
      current
        ? {
            ...current,
            items: updateItemInList(current.items, index, field, value),
          }
        : null,
    );
  }

  async function saveSelectedOrder() {
    if (!selectedOrder) {
      return;
    }

    await commitOrder(selectedOrder, {
      onSuccess: () => {
        setStagedOrders((current) =>
          current.filter((staged) => staged.orderId !== selectedOrder.orderId),
        );
      },
    });
  }

  async function removeSavedOrder(orderId: string) {
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `/api/orders/saved/${encodeURIComponent(orderId)}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Unable to remove order.");
      }

      setSavedOrders((current) =>
        current.filter((order) => order.orderId !== orderId),
      );
      setSelectedOrder(null);
      setSelectedKind(null);
      setSuccess(`Order ${orderId} removed.`);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to remove order.",
      );
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.orderHeader}>
          <div>
            <div className={styles.eyebrow}>
              <span className={styles.liveDot} />
              ORDER DESK
            </div>
            <h1>
              Orders,
              <span> organised.</span>
            </h1>
            <p>
              Load, create, import and review packing orders from one workspace.
            </p>
          </div>

          <div className={styles.headerStats}>
            <div>
              <span>TOTAL</span>
              <strong>{allOrders.length}</strong>
            </div>
            <div>
              <span>EXTERNAL</span>
              <strong>{externalCount}</strong>
            </div>
            <div>
              <span>LOCAL</span>
              <strong>{localCount}</strong>
            </div>
          </div>
        </header>

        <section className={styles.commandStrip}>
          <div className={styles.commandIntro}>
            <span>ADD ORDERS</span>
            <strong>Choose a source</strong>
          </div>

          <button
            type="button"
            className={styles.commandButton}
            onClick={loadExternalOrders}
            disabled={loadingExternal}
          >
            <span className={styles.commandNumber}>01</span>
            <div>
              <strong>
                {loadingExternal ? "Loading..." : "Load External Orders"}
              </strong>
              <small>Retrieve available orders</small>
            </div>
            <span className={styles.commandArrow}>↗</span>
          </button>

          <button
            type="button"
            className={`${styles.commandButton} ${
              composer === "manual" ? styles.commandButtonActive : ""
            }`}
            onClick={() => switchComposer("manual")}
          >
            <span className={styles.commandNumber}>02</span>
            <div>
              <strong>Create Order</strong>
              <small>Enter an order manually</small>
            </div>
            <span className={styles.commandArrow}>+</span>
          </button>

          <button
            type="button"
            className={`${styles.commandButton} ${
              composer === "import" ? styles.commandButtonActive : ""
            }`}
            onClick={() => switchComposer("import")}
          >
            <span className={styles.commandNumber}>03</span>
            <div>
              <strong>Import Orders</strong>
              <small>JSON or CSV</small>
            </div>
            <span className={styles.commandArrow}>↑</span>
          </button>
        </section>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        {composer === "manual" && (
          <ManualOrderComposer
            manualOrderId={manualOrderId}
            onOrderIdChange={setManualOrderId}
            manualItems={manualItems}
            onItemChange={updateManualItem}
            onAddItem={addManualItem}
            onRemoveItem={removeManualItem}
            onSubmit={createManualOrder}
            onClose={() => setComposer(null)}
          />
        )}

        {composer === "import" && (
          <ImportOrderComposer
            importOrderId={importOrderId}
            onOrderIdChange={setImportOrderId}
            importFileName={importFileName}
            onFileSelect={handleImport}
            onClose={() => setComposer(null)}
          />
        )}

        {stagedOrders.length > 0 && (
          <section
            className={styles.queuePanel}
            style={{ marginTop: "28px" }}
          >
            <div className={styles.queueHeader}>
              <div>
                <span>LOADED ORDERS</span>
                <h2>Ready for review</h2>
              </div>
              <div className={styles.orderCount}>{stagedOrders.length}</div>
            </div>

            <div className={styles.queueColumns}>
              <span>ORDER</span>
              <span>SOURCE</span>
              <span>ITEMS</span>
              <span>STATUS</span>
              <span />
            </div>

            <div className={styles.orderList}>
              {stagedOrders.map((order) => (
                <OrderRow
                  key={order.orderId}
                  order={order}
                  isActive={
                    selectedOrder?.orderId === order.orderId &&
                    selectedKind === "staged"
                  }
                  statusLabel="Review"
                  onClick={() => selectLoadedOrder(order)}
                />
              ))}
            </div>
          </section>
        )}

        <section className={styles.workspace}>
          <div className={styles.queuePanel}>
            <div className={styles.queueHeader}>
              <div>
                <span>YOUR ORDERS</span>
                <h2>Order queue</h2>
              </div>
              <div className={styles.orderCount}>{visibleOrders.length}</div>
            </div>

            <div className={styles.searchBar}>
              <span>⌕</span>
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search orders..."
              />
            </div>

            <div className={styles.queueColumns}>
              <span>ORDER</span>
              <span>SOURCE</span>
              <span>ITEMS</span>
              <span>STATUS</span>
              <span />
            </div>

            <div className={styles.orderList}>
              {loadingSaved ? (
                <div className={styles.emptyQueue}>
                  <strong>Loading orders...</strong>
                </div>
              ) : visibleOrders.length === 0 ? (
                <div className={styles.emptyQueue}>
                  <div>00</div>
                  <strong>No saved orders</strong>
                  <p>Review an order and save it to add it here.</p>
                </div>
              ) : (
                visibleOrders.map((order) => (
                  <OrderRow
                    key={order.orderId}
                    order={order}
                    isActive={
                      selectedOrder?.orderId === order.orderId &&
                      selectedKind === "saved"
                    }
                    onClick={() =>
                      router.push(
                        `/visualiser?orderId=${encodeURIComponent(order.orderId)}`,
                      )
                    }
                  />
                ))
              )}
            </div>
          </div>

          <OrderInspector
            selectedOrder={selectedOrder}
            selectedKind={selectedKind}
            onItemChange={updateSelectedItem}
            onRemoveSavedOrder={removeSavedOrder}
            onSaveChanges={saveSelectedOrder}
          />
        </section>
      </main>
    </div>
  );
}
