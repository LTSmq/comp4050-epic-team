"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import styles from "./order.module.css";

type OrderSource =
  | "External"
  | "Manual"
  | "Imported";

type OrderStatus =
  | "Available"
  | "Draft"
  | "Imported";

type OrderItem = {
  ItemCode: string;
  ItemReference: string;
  Width: number;
  Length: number;
  Depth: number;
  BoxGroup?: string;
};

type OrderRecord = {
  orderId: string;
  source: OrderSource;
  status: OrderStatus;
  items: OrderItem[];
};

type ApiRecord =
  Record<string, unknown>;

type OrderFormProps = {
  username: string;
};

type ComposerMode =
  | "manual"
  | "import"
  | null;

type SelectedKind =
  | "staged"
  | "saved"
  | null;

const emptyItem =
  (): OrderItem => ({
    ItemCode: "",
    ItemReference: "",
    Width: 0,
    Length: 0,
    Depth: 0,
    BoxGroup: "",
  });

/* =====================================================
   HELPERS
   ===================================================== */

function getValue(
  record: ApiRecord,
  keys: string[]
) {
  for (const key of keys) {
    if (
      record[key] !==
      undefined
    ) {
      return record[key];
    }

    const foundKey =
      Object.keys(
        record
      ).find(
        (existingKey) =>
          existingKey.toLowerCase() ===
          key.toLowerCase()
      );

    if (foundKey) {
      return record[
        foundKey
      ];
    }
  }

  return undefined;
}

function getOrderId(
  record: ApiRecord
) {
  const value = getValue(
    record,
    [
      "orderId",
      "orderID",
      "OrderID",
      "id",
      "_id",
    ]
  );

  return value === undefined ||
    value === null
    ? ""
    : String(value);
}

function normaliseItem(
  value: unknown,
  index: number
): OrderItem {
  if (
    typeof value !==
      "object" ||
    value === null
  ) {
    throw new Error(
      `Item ${
        index + 1
      } is invalid.`
    );
  }

  const item =
    value as ApiRecord;

  const itemCode =
    String(
      getValue(item, [
        "ItemCode",
        "itemCode",
        "itemId",
        "id",
      ]) ?? ""
    ).trim();

  const itemReference =
    String(
      getValue(item, [
        "ItemReference",
        "itemReference",
        "reference",
        "name",
        "itemId",
      ]) ?? itemCode
    ).trim();

  const width =
    Number(
      getValue(item, [
        "Width",
        "width",
      ]) ?? 0
    );

  const length =
    Number(
      getValue(item, [
        "Length",
        "length",
      ]) ?? 0
    );

  const depth =
    Number(
      getValue(item, [
        "Depth",
        "depth",
      ]) ?? 0
    );

  const boxGroupRaw =
    getValue(item, [
      "BoxGroup",
      "boxGroup",
    ]);

  const boxGroup =
    boxGroupRaw ===
      undefined ||
    boxGroupRaw === null
      ? ""
      : String(
          boxGroupRaw
        ).trim();

  if (!itemCode) {
    throw new Error(
      `Item ${
        index + 1
      } requires an item code.`
    );
  }

  if (!itemReference) {
    throw new Error(
      `Item ${
        index + 1
      } requires an item reference.`
    );
  }

  if (
    !Number.isFinite(
      width
    ) ||
    width <= 0 ||
    !Number.isFinite(
      length
    ) ||
    length <= 0 ||
    !Number.isFinite(
      depth
    ) ||
    depth <= 0
  ) {
    throw new Error(
      `Item ${
        index + 1
      } requires valid dimensions.`
    );
  }

  return {
    ItemCode:
      itemCode,

    ItemReference:
      itemReference,

    Width: width,
    Length: length,
    Depth: depth,

    ...(boxGroup
      ? {
          BoxGroup:
            boxGroup,
        }
      : {}),
  };
}

function extractItems(
  record: ApiRecord
) {
  const directItems =
    getValue(
      record,
      ["items"]
    );

  if (
    Array.isArray(
      directItems
    )
  ) {
    return directItems.map(
      (item, index) =>
        normaliseItem(
          item,
          index
        )
    );
  }

  const boxes =
    getValue(
      record,
      ["boxes"]
    );

  if (
    Array.isArray(boxes)
  ) {
    const items:
      unknown[] = [];

    boxes.forEach(
      (rawBox) => {
        if (
          typeof rawBox !==
            "object" ||
          rawBox === null
        ) {
          return;
        }

        const box =
          rawBox as ApiRecord;

        const boxItems =
          getValue(
            box,
            ["items"]
          );

        if (
          Array.isArray(
            boxItems
          )
        ) {
          items.push(
            ...boxItems
          );
        }
      }
    );

    return items.map(
      (item, index) =>
        normaliseItem(
          item,
          index
        )
    );
  }

  return [];
}

function normaliseOrder(
  value: unknown,
  source: OrderSource
): OrderRecord | null {
  if (
    typeof value !==
      "object" ||
    value === null
  ) {
    return null;
  }

  const record =
    value as ApiRecord;

  const orderId =
    getOrderId(record);

  if (!orderId) {
    return null;
  }

  let items:
    OrderItem[] = [];

  try {
    items =
      extractItems(
        record
      );
  } catch {
    // Summary may not contain items.
  }

  return {
    orderId,
    source,

    status:
      source ===
      "External"
        ? "Available"
        : source ===
            "Imported"
          ? "Imported"
          : "Draft",

    items,
  };
}

function extractExternalOrders(
  payload: unknown
): OrderRecord[] {
  if (
    Array.isArray(
      payload
    )
  ) {
    return payload
      .map((record) =>
        normaliseOrder(
          record,
          "External"
        )
      )
      .filter(
        (
          order
        ): order is OrderRecord =>
          order !== null
      );
  }

  if (
    typeof payload !==
      "object" ||
    payload === null
  ) {
    return [];
  }

  const object =
    payload as ApiRecord;

  for (const key of [
    "orders",
    "data",
    "results",
  ]) {
    const value =
      object[key];

    if (
      Array.isArray(
        value
      )
    ) {
      return value
        .map((record) =>
          normaliseOrder(
            record,
            "External"
          )
        )
        .filter(
          (
            order
          ): order is OrderRecord =>
            order !== null
        );
    }
  }

  const order =
    normaliseOrder(
      object,
      "External"
    );

  return order
    ? [order]
    : [];
}

function mergeOrders(
  current:
    OrderRecord[],
  incoming:
    OrderRecord[]
) {
  const map =
    new Map<
      string,
      OrderRecord
    >();

  current.forEach(
    (order) => {
      map.set(
        order.orderId,
        order
      );
    }
  );

  incoming.forEach(
    (order) => {
      map.set(
        order.orderId,
        order
      );
    }
  );

  return Array.from(
    map.values()
  );
}

/* =====================================================
   CSV
   ===================================================== */

function parseCsvLine(
  line: string
) {
  const values:
    string[] = [];

  let current = "";
  let quoted = false;

  for (
    let index = 0;
    index <
    line.length;
    index++
  ) {
    const char =
      line[index];

    if (char === '"') {
      if (
        quoted &&
        line[
          index + 1
        ] === '"'
      ) {
        current += '"';
        index++;
      } else {
        quoted =
          !quoted;
      }

      continue;
    }

    if (
      char === "," &&
      !quoted
    ) {
      values.push(
        current.trim()
      );

      current = "";

      continue;
    }

    current += char;
  }

  values.push(
    current.trim()
  );

  return values;
}

function parseCsvOrders(
  content: string,
  fallbackOrderId:
    string
): OrderRecord[] {
  const lines =
    content
      .split(/\r?\n/)
      .filter(
        (line) =>
          line.trim()
            .length > 0
      );

  if (
    lines.length < 2
  ) {
    throw new Error(
      "The CSV does not contain any order items."
    );
  }

  const headers =
    parseCsvLine(
      lines[0]
    );

  const records =
    lines
      .slice(1)
      .map(
        (line) => {
          const values =
            parseCsvLine(
              line
            );

          const record:
            ApiRecord =
            {};

          headers.forEach(
            (
              header,
              index
            ) => {
              record[
                header
              ] =
                values[
                  index
                ] ??
                "";
            }
          );

          return record;
        }
      );

  const groups =
    new Map<
      string,
      ApiRecord[]
    >();

  records.forEach(
    (record) => {
      const csvOrderId =
        getOrderId(
          record
        );

      const orderId =
        csvOrderId ||
        fallbackOrderId.trim();

      if (!orderId) {
        throw new Error(
          "The CSV needs an OrderID column, or you must enter an Order ID before importing."
        );
      }

      const existing =
        groups.get(
          orderId
        ) ?? [];

      existing.push(
        record
      );

      groups.set(
        orderId,
        existing
      );
    }
  );

  return Array.from(
    groups.entries()
  ).map(
    ([
      orderId,
      items,
    ]) => ({
      orderId,

      source:
        "Imported" as const,

      status:
        "Imported" as const,

      items:
        items.map(
          (
            item,
            index
          ) =>
            normaliseItem(
              item,
              index
            )
        ),
    })
  );
}

/* =====================================================
   JSON
   ===================================================== */

function parseJsonOrders(
  content: string,
  fallbackOrderId:
    string
): OrderRecord[] {
  const parsed =
    JSON.parse(
      content
    );

  if (
    Array.isArray(
      parsed
    )
  ) {
    const looksLikeOrders =
      parsed.some(
        (record) =>
          typeof record ===
            "object" &&
          record !== null &&
          getOrderId(
            record as ApiRecord
          )
      );

    if (
      looksLikeOrders
    ) {
      return parsed
        .map((record) =>
          normaliseOrder(
            record,
            "Imported"
          )
        )
        .filter(
          (
            order
          ): order is OrderRecord =>
            order !== null
        )
        .map(
          (order) => ({
            ...order,
            status:
              "Imported",
          })
        );
    }

    const orderId =
      fallbackOrderId.trim();

    if (!orderId) {
      throw new Error(
        "Enter an Order ID before importing an item-array JSON file."
      );
    }

    return [
      {
        orderId,
        source:
          "Imported",
        status:
          "Imported",

        items:
          parsed.map(
            (
              item,
              index
            ) =>
              normaliseItem(
                item,
                index
              )
          ),
      },
    ];
  }

  const order =
    normaliseOrder(
      parsed,
      "Imported"
    );

  if (!order) {
    throw new Error(
      "The JSON does not contain a valid order."
    );
  }

  return [
    {
      ...order,
      status:
        "Imported",
    },
  ];
}

/* =====================================================
   COMPONENT
   ===================================================== */

export default function OrderForm({
  username,
}: OrderFormProps) {
  const [
    savedOrders,
    setSavedOrders,
  ] =
    useState<
      OrderRecord[]
    >([]);

  const [
    stagedOrders,
    setStagedOrders,
  ] =
    useState<
      OrderRecord[]
    >([]);

  const [
    selectedOrder,
    setSelectedOrder,
  ] =
    useState<
      OrderRecord | null
    >(null);

  const [
    selectedKind,
    setSelectedKind,
  ] =
    useState<
      SelectedKind
    >(null);

  const [
    composer,
    setComposer,
  ] =
    useState<
      ComposerMode
    >(null);

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    loadingExternal,
    setLoadingExternal,
  ] =
    useState(false);

  const [
    loadingSaved,
    setLoadingSaved,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  const [
    manualOrderId,
    setManualOrderId,
  ] =
    useState("");

  const [
    manualItems,
    setManualItems,
  ] = useState<
    OrderItem[]
  >([
    emptyItem(),
  ]);

  const [
    importOrderId,
    setImportOrderId,
  ] =
    useState("");

  const [
    importFileName,
    setImportFileName,
  ] =
    useState("");

  /* ===================================================
     LOAD SAVED ORDERS FROM MONGODB
     =================================================== */

  useEffect(() => {
    loadSavedOrders();
  }, []);

  async function loadSavedOrders() {
    setLoadingSaved(
      true
    );

    try {
      const response =
        await fetch(
          "/api/orders/saved",
          {
            cache:
              "no-store",
          }
        );

      if (!response.ok) {
        throw new Error(
          "Unable to retrieve saved orders."
        );
      }

      const data =
        await response.json();

      setSavedOrders(
        Array.isArray(
          data.orders
        )
          ? data.orders
          : []
      );
    } catch (
      loadError
    ) {
      console.error(
        "Failed to load saved orders:",
        loadError
      );

      setError(
        "Unable to load your saved orders."
      );
    } finally {
      setLoadingSaved(
        false
      );
    }
  }

  const allOrders =
    useMemo(
      () =>
        savedOrders,
      [savedOrders]
    );

  const visibleOrders =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return allOrders;
      }

      return allOrders.filter(
        (order) =>
          order.orderId
            .toLowerCase()
            .includes(
              query
            ) ||
          order.source
            .toLowerCase()
            .includes(
              query
            ) ||
          order.status
            .toLowerCase()
            .includes(
              query
            )
      );
    }, [
      allOrders,
      search,
    ]);

  const externalCount =
    allOrders.filter(
      (order) =>
        order.source ===
        "External"
    ).length;

  const localCount =
    allOrders.length -
    externalCount;

  /* ===================================================
     PERSIST ORDER
     =================================================== */

  async function persistOrder(
    order: OrderRecord,
    alreadySaved:
      boolean
  ) {
    const url =
      alreadySaved
        ? `/api/orders/saved/${encodeURIComponent(
            order.orderId
          )}`
        : "/api/orders/saved";

    const response =
      await fetch(
        url,
        {
          method:
            alreadySaved
              ? "PUT"
              : "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              order
            ),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Unable to save order."
      );
    }

    return data as OrderRecord;
  }

  /* ===================================================
     LOAD EXTERNAL
     =================================================== */

  async function loadExternalOrders() {
    setLoadingExternal(
      true
    );

    setError("");
    setSuccess("");

    try {
      const response =
        await fetch(
          "/api/orders",
          {
            cache:
              "no-store",
          }
        );

      if (!response.ok) {
        throw new Error(
          `Order source returned ${response.status}`
        );
      }

      const data =
        await response.json();

      const loaded =
        extractExternalOrders(
          data
        );

      const savedIds =
        new Set(
          savedOrders.map(
            (order) =>
              order.orderId
          )
        );

      const newOrders =
        loaded.filter(
          (order) =>
            !savedIds.has(
              order.orderId
            )
        );

      setStagedOrders(
        (current) =>
          mergeOrders(
            current,
            newOrders
          )
      );

      setSelectedOrder(
        null
      );

      setSelectedKind(
        null
      );

      const ignored =
        loaded.length -
        newOrders.length;

      setSuccess(
        `${newOrders.length} order${
          newOrders.length ===
          1
            ? ""
            : "s"
        } loaded for review${
          ignored > 0
            ? ` (${ignored} already saved).`
            : "."
        }`
      );
    } catch (
      loadError
    ) {
      console.error(
        "External order load failed:",
        loadError
      );

      setError(
        "Unable to load external orders."
      );
    } finally {
      setLoadingExternal(
        false
      );
    }
  }

  /* ===================================================
     SELECT STAGED
     =================================================== */

  async function selectLoadedOrder(
    order: OrderRecord
  ) {
    setError("");
    setSuccess("");

    if (
      order.source ===
        "External" &&
      order.items.length ===
        0
    ) {
      try {
        const response =
          await fetch(
            `/api/orders/${encodeURIComponent(
              order.orderId
            )}`,
            {
              cache:
                "no-store",
            }
          );

        if (
          response.ok
        ) {
          const data =
            await response.json();

          const fullOrder =
            normaliseOrder(
              data,
              "External"
            );

          if (
            fullOrder
          ) {
            setSelectedOrder(
              fullOrder
            );

            setSelectedKind(
              "staged"
            );

            setStagedOrders(
              (
                current
              ) =>
                mergeOrders(
                  current,
                  [
                    fullOrder,
                  ]
                )
            );

            return;
          }
        }
      } catch {
        // Use summary.
      }
    }

    setSelectedOrder({
      ...order,

      items:
        order.items.map(
          (item) => ({
            ...item,
          })
        ),
    });

    setSelectedKind(
      "staged"
    );
  }

  /* ===================================================
     OPEN SAVED
     =================================================== */

  function openSavedOrder(
    order: OrderRecord
  ) {
    setError("");
    setSuccess("");

    setSelectedOrder({
      ...order,

      items:
        order.items.map(
          (item) => ({
            ...item,
          })
        ),
    });

    setSelectedKind(
      "saved"
    );
  }

  function switchComposer(
    next:
      ComposerMode
  ) {
    setComposer(
      composer === next
        ? null
        : next
    );

    setError("");
    setSuccess("");
  }

  /* ===================================================
     MANUAL ORDER
     =================================================== */

  function updateManualItem(
    index: number,
    field:
      keyof OrderItem,
    value: string
  ) {
    setManualItems(
      (current) =>
        current.map(
          (
            item,
            itemIndex
          ) => {
            if (
              itemIndex !==
              index
            ) {
              return item;
            }

            if (
              field ===
                "Width" ||
              field ===
                "Length" ||
              field ===
                "Depth"
            ) {
              return {
                ...item,

                [field]:
                  value ===
                  ""
                    ? 0
                    : Number(
                        value
                      ),
              };
            }

            return {
              ...item,
              [field]:
                value,
            };
          }
        )
    );
  }

  function addManualItem() {
    setManualItems(
      (current) => [
        ...current,
        emptyItem(),
      ]
    );
  }

  function removeManualItem(
    index: number
  ) {
    if (
      manualItems.length ===
      1
    ) {
      return;
    }

    setManualItems(
      (current) =>
        current.filter(
          (
            _,
            itemIndex
          ) =>
            itemIndex !==
            index
        )
    );
  }

  async function createManualOrder() {
    setError("");
    setSuccess("");

    const orderId =
      manualOrderId.trim();

    if (!orderId) {
      setError(
        "Order ID is required."
      );

      return;
    }

    if (
      savedOrders.some(
        (order) =>
          order.orderId ===
          orderId
      )
    ) {
      setError(
        `Order ${orderId} already exists.`
      );

      return;
    }

    try {
      const items =
        manualItems.map(
          (
            item,
            index
          ) =>
            normaliseItem(
              item,
              index
            )
        );

      const order:
        OrderRecord = {
        orderId,
        source:
          "Manual",
        status:
          "Draft",
        items,
      };

      const saved =
        await persistOrder(
          order,
          false
        );

      setSavedOrders(
        (current) =>
          mergeOrders(
            current,
            [saved]
          )
      );

      setManualOrderId(
        ""
      );

      setManualItems([
        emptyItem(),
      ]);

      setComposer(null);

      setSelectedOrder(
        null
      );

      setSelectedKind(
        null
      );

      setSuccess(
        `Order ${orderId} saved successfully.`
      );
    } catch (
      createError
    ) {
      setError(
        createError instanceof
          Error
          ? createError.message
          : "Unable to create order."
      );
    }
  }

  /* ===================================================
     IMPORT
     =================================================== */

  async function handleImport(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0];

    if (!file) {
      return;
    }

    setError("");
    setSuccess("");

    setImportFileName(
      file.name
    );

    try {
      const content =
        await file.text();

      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase();

      let imported:
        OrderRecord[];

      if (
        extension ===
        "csv"
      ) {
        imported =
          parseCsvOrders(
            content,
            importOrderId
          );
      } else if (
        extension ===
        "json"
      ) {
        imported =
          parseJsonOrders(
            content,
            importOrderId
          );
      } else {
        throw new Error(
          "Only CSV and JSON files are supported."
        );
      }

      const savedIds =
        new Set(
          savedOrders.map(
            (order) =>
              order.orderId
          )
        );

      const newOrders =
        imported.filter(
          (order) =>
            !savedIds.has(
              order.orderId
            )
        );

      setStagedOrders(
        (current) =>
          mergeOrders(
            current,
            newOrders
          )
      );

      if (
        newOrders.length >
        0
      ) {
        setSelectedOrder({
          ...newOrders[0],

          items:
            newOrders[0].items.map(
              (item) => ({
                ...item,
              })
            ),
        });

        setSelectedKind(
          "staged"
        );
      }

      const ignored =
        imported.length -
        newOrders.length;

      setSuccess(
        `${newOrders.length} order${
          newOrders.length ===
          1
            ? ""
            : "s"
        } loaded for review${
          ignored > 0
            ? ` (${ignored} already saved).`
            : "."
        }`
      );

      setComposer(null);
      setImportOrderId(
        ""
      );
    } catch (
      importError
    ) {
      console.error(
        "Order import failed:",
        importError
      );

      setError(
        importError instanceof
          Error
          ? importError.message
          : "Unable to import the order file."
      );
    }

    event.target.value =
      "";
  }

  /* ===================================================
     EDIT ORDER
     =================================================== */

  function updateSelectedItem(
    index: number,
    field:
      keyof OrderItem,
    value: string
  ) {
    if (!selectedOrder) {
      return;
    }

    setSelectedOrder({
      ...selectedOrder,

      items:
        selectedOrder.items.map(
          (
            item,
            itemIndex
          ) => {
            if (
              itemIndex !==
              index
            ) {
              return item;
            }

            if (
              field ===
                "Width" ||
              field ===
                "Length" ||
              field ===
                "Depth"
            ) {
              return {
                ...item,

                [field]:
                  value ===
                  ""
                    ? 0
                    : Number(
                        value
                      ),
              };
            }

            return {
              ...item,
              [field]:
                value,
            };
          }
        ),
    });
  }

  /* ===================================================
     SAVE CHANGES
     =================================================== */

  async function saveSelectedOrder() {
    if (
      !selectedOrder
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const items =
        selectedOrder.items.map(
          (
            item,
            index
          ) =>
            normaliseItem(
              item,
              index
            )
        );

      const order:
        OrderRecord = {
        ...selectedOrder,
        items,
      };

      const alreadySaved =
        savedOrders.some(
          (existing) =>
            existing.orderId ===
            order.orderId
        );

      const saved =
        await persistOrder(
          order,
          alreadySaved
        );

      setSavedOrders(
        (current) =>
          mergeOrders(
            current,
            [saved]
          )
      );

      setStagedOrders(
        (current) =>
          current.filter(
            (staged) =>
              staged.orderId !==
              order.orderId
          )
      );

      setSelectedOrder(
        null
      );

      setSelectedKind(
        null
      );

      setSuccess(
        `Order ${order.orderId} saved successfully.`
      );
    } catch (
      saveError
    ) {
      setError(
        saveError instanceof
          Error
          ? saveError.message
          : "Unable to save changes."
      );
    }
  }

  /* ===================================================
     DELETE
     =================================================== */

  async function removeSavedOrder(
    orderId: string
  ) {
    setError("");
    setSuccess("");

    try {
      const response =
        await fetch(
          `/api/orders/saved/${encodeURIComponent(
            orderId
          )}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to remove order."
        );
      }

      setSavedOrders(
        (current) =>
          current.filter(
            (order) =>
              order.orderId !==
              orderId
          )
      );

      setSelectedOrder(
        null
      );

      setSelectedKind(
        null
      );

      setSuccess(
        `Order ${orderId} removed.`
      );
    } catch (
      deleteError
    ) {
      setError(
        deleteError instanceof
          Error
          ? deleteError.message
          : "Unable to remove order."
      );
    }
  }

  return (
    <div
      className={
        styles.page
      }
    >
      <nav
        className={
          styles.navbar
        }
      >
        <Link
          href="/"
          className={
            styles.brand
          }
        >
          <div
            className={
              styles.brandMark
            }
          >
            <span />
            <span />
            <span />
          </div>

          <div
            className={
              styles.brandText
            }
          >
            <strong>
              THOMAX
            </strong>

            <span>
              .wms · Perfect Fit
            </span>
          </div>
        </Link>

        <div
          className={
            styles.navLinks
          }
        >
          <Link href="/portal">
            Portal
          </Link>

          <Link
            href="/orders"
            className={
              styles.activeNav
            }
          >
            Orders
          </Link>

          <Link href="/visualiser">
            Visualiser
          </Link>

          <Link
            href="/account"
            className={
              styles.accountButton
            }
          >
            {username}
          </Link>
        </div>
      </nav>

      <main
        className={
          styles.main
        }
      >
        <header
          className={
            styles.orderHeader
          }
        >
          <div>
            <div
              className={
                styles.eyebrow
              }
            >
              <span
                className={
                  styles.liveDot
                }
              />

              ORDER DESK
            </div>

            <h1>
              Orders,
              <span>
                {" "}
                organised.
              </span>
            </h1>

            <p>
              Load, create,
              import and review
              packing orders
              from one
              workspace.
            </p>
          </div>

          <div
            className={
              styles.headerStats
            }
          >
            <div>
              <span>
                TOTAL
              </span>

              <strong>
                {
                  allOrders.length
                }
              </strong>
            </div>

            <div>
              <span>
                EXTERNAL
              </span>

              <strong>
                {
                  externalCount
                }
              </strong>
            </div>

            <div>
              <span>
                LOCAL
              </span>

              <strong>
                {
                  localCount
                }
              </strong>
            </div>
          </div>
        </header>

        <section
          className={
            styles.commandStrip
          }
        >
          <div
            className={
              styles.commandIntro
            }
          >
            <span>
              ADD ORDERS
            </span>

            <strong>
              Choose a source
            </strong>
          </div>

          <button
            type="button"
            className={
              styles.commandButton
            }
            onClick={
              loadExternalOrders
            }
            disabled={
              loadingExternal
            }
          >
            <span
              className={
                styles.commandNumber
              }
            >
              01
            </span>

            <div>
              <strong>
                {loadingExternal
                  ? "Loading..."
                  : "Load External Orders"}
              </strong>

              <small>
                Retrieve
                available orders
              </small>
            </div>

            <span
              className={
                styles.commandArrow
              }
            >
              ↗
            </span>
          </button>

          <button
            type="button"
            className={`${styles.commandButton} ${
              composer ===
              "manual"
                ? styles.commandButtonActive
                : ""
            }`}
            onClick={() =>
              switchComposer(
                "manual"
              )
            }
          >
            <span
              className={
                styles.commandNumber
              }
            >
              02
            </span>

            <div>
              <strong>
                Create Order
              </strong>

              <small>
                Enter an order
                manually
              </small>
            </div>

            <span
              className={
                styles.commandArrow
              }
            >
              +
            </span>
          </button>

          <button
            type="button"
            className={`${styles.commandButton} ${
              composer ===
              "import"
                ? styles.commandButtonActive
                : ""
            }`}
            onClick={() =>
              switchComposer(
                "import"
              )
            }
          >
            <span
              className={
                styles.commandNumber
              }
            >
              03
            </span>

            <div>
              <strong>
                Import Orders
              </strong>

              <small>
                JSON or CSV
              </small>
            </div>

            <span
              className={
                styles.commandArrow
              }
            >
              ↑
            </span>
          </button>
        </section>

        {error && (
          <div
            className={
              styles.error
            }
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className={
              styles.success
            }
          >
            {success}
          </div>
        )}

        {composer ===
          "manual" && (
          <section
            className={`${styles.composer} ${styles.manualComposer}`}
          >
            <div
              className={
                styles.manualComposerTop
              }
            >
              <div
                className={
                  styles.manualHero
                }
              >
                <div
                  className={
                    styles.manualHeroBadge
                  }
                >
                  <span
                    className={
                      styles.manualHeroDot
                    }
                  />

                  ORDER BUILDER
                </div>

                <h2>
                  Create an order
                </h2>

                <p>
                  Add an order ID,
                  enter the item
                  details and add
                  the order to your
                  queue.
                </p>
              </div>

              <div
                className={
                  styles.manualAside
                }
              >
                <div
                  className={
                    styles.manualAsideCard
                  }
                >
                  <span>
                    WORKFLOW
                  </span>

                  <strong>
                    Create → Save →
                    Review
                  </strong>

                  <small>
                    Created orders
                    are saved to
                    your workspace.
                  </small>
                </div>

                <button
                  type="button"
                  className={
                    styles.closeButton
                  }
                  onClick={() =>
                    setComposer(
                      null
                    )
                  }
                >
                  ×
                </button>
              </div>
            </div>

            <div
              className={
                styles.manualBody
              }
            >
              <div
                className={
                  styles.orderIdPanel
                }
              >
                <div
                  className={
                    styles.orderIdPanelHeader
                  }
                >
                  <span>
                    ORDER DETAILS
                  </span>

                  <strong>
                    Primary
                    information
                  </strong>
                </div>

                <label
                  className={
                    styles.orderIdField
                  }
                >
                  <span>
                    Order ID
                  </span>

                  <input
                    type="text"
                    value={
                      manualOrderId
                    }
                    onChange={(
                      event
                    ) =>
                      setManualOrderId(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="e.g. ORD-0022"
                  />
                </label>
              </div>

              <div
                className={
                  styles.manualItemsPanel
                }
              >
                <div
                  className={
                    styles.itemSectionHeader
                  }
                >
                  <div>
                    <span>
                      ITEMS
                    </span>

                    <h3>
                      Order
                      contents
                    </h3>
                  </div>

                  <button
                    type="button"
                    className={
                      styles.smallButton
                    }
                    onClick={
                      addManualItem
                    }
                  >
                    + Add item
                  </button>
                </div>

                <div
                  className={
                    styles.itemStack
                  }
                >
                  {manualItems.map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        className={
                          styles.itemEditor
                        }
                      >
                        <div
                          className={
                            styles.itemEditorHeader
                          }
                        >
                          <div>
                            <span>
                              ITEM{" "}
                              {String(
                                index +
                                  1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                            <strong>
                              Item{" "}
                              {index +
                                1}
                            </strong>
                          </div>

                          <div
                            className={
                              styles.itemEditorActions
                            }
                          >
                            <span
                              className={
                                styles.itemMiniBadge
                              }
                            >
                              Active
                            </span>

                            {manualItems.length >
                              1 && (
                              <button
                                type="button"
                                className={
                                  styles.removeButton
                                }
                                onClick={() =>
                                  removeManualItem(
                                    index
                                  )
                                }
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        <ItemFields
                          item={
                            item
                          }
                          onChange={(
                            field,
                            value
                          ) =>
                            updateManualItem(
                              index,
                              field,
                              value
                            )
                          }
                        />
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            <div
              className={
                styles.composerActions
              }
            >
              <div
                className={
                  styles.manualFooterNote
                }
              >
                <span>
                  READY TO ADD
                </span>

                <p>
                  This order will
                  be saved to your
                  order queue.
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.primaryButton
                }
                onClick={
                  createManualOrder
                }
              >
                Add to orders
                <span>→</span>
              </button>
            </div>
          </section>
        )}

        {composer ===
          "import" && (
          <section
            className={
              styles.composer
            }
          >
            <div
              className={
                styles.composerHeader
              }
            >
              <div>
                <span>
                  FILE IMPORT
                </span>

                <h2>
                  Import orders
                </h2>

                <p>
                  Select a CSV or
                  JSON order file.
                </p>
              </div>

              <button
                type="button"
                className={
                  styles.closeButton
                }
                onClick={() =>
                  setComposer(
                    null
                  )
                }
              >
                ×
              </button>
            </div>

            <label
              className={
                styles.orderIdField
              }
            >
              <span>
                Order ID
                (optional)
              </span>

              <input
                type="text"
                value={
                  importOrderId
                }
                onChange={(
                  event
                ) =>
                  setImportOrderId(
                    event.target
                      .value
                  )
                }
                placeholder="Only needed if the file does not contain an Order ID"
              />
            </label>

            <label
              className={
                styles.dropZone
              }
            >
              <input
                type="file"
                accept=".json,.csv,application/json,text/csv"
                onChange={
                  handleImport
                }
              />

              <div
                className={
                  styles.uploadMark
                }
              >
                ↑
              </div>

              <strong>
                Select order
                file
              </strong>

              <span>
                CSV or JSON
              </span>

              {importFileName && (
                <small>
                  {
                    importFileName
                  }
                </small>
              )}
            </label>
          </section>
        )}

        {stagedOrders.length >
          0 && (
          <section
            className={
              styles.queuePanel
            }
            style={{
              marginTop:
                "28px",
            }}
          >
            <div
              className={
                styles.queueHeader
              }
            >
              <div>
                <span>
                  LOADED ORDERS
                </span>

                <h2>
                  Ready for
                  review
                </h2>
              </div>

              <div
                className={
                  styles.orderCount
                }
              >
                {
                  stagedOrders.length
                }
              </div>
            </div>

            <div
              className={
                styles.queueColumns
              }
            >
              <span>
                ORDER
              </span>
              <span>
                SOURCE
              </span>
              <span>
                ITEMS
              </span>
              <span>
                STATUS
              </span>
              <span />
            </div>

            <div
              className={
                styles.orderList
              }
            >
              {stagedOrders.map(
                (order) => (
                  <button
                    key={
                      order.orderId
                    }
                    type="button"
                    className={`${styles.orderRow} ${
                      selectedOrder?.orderId ===
                      order.orderId
                        ? styles.orderRowActive
                        : ""
                    }`}
                    onClick={() =>
                      selectLoadedOrder(
                        order
                      )
                    }
                  >
                    <div
                      className={
                        styles.orderIdentity
                      }
                    >
                      <span
                        className={
                          styles.orderMarker
                        }
                      />

                      <strong>
                        {
                          order.orderId
                        }
                      </strong>
                    </div>

                    <span
                      className={`${styles.sourcePill} ${
                        order.source ===
                        "External"
                          ? styles.externalPill
                          : styles.importedPill
                      }`}
                    >
                      {
                        order.source
                      }
                    </span>

                    <span
                      className={
                        styles.itemCount
                      }
                    >
                      {
                        order.items
                          .length
                      }
                    </span>

                    <span
                      className={
                        styles.statusText
                      }
                    >
                      <i />
                      Review
                    </span>

                    <span
                      className={
                        styles.openArrow
                      }
                    >
                      →
                    </span>
                  </button>
                )
              )}
            </div>
          </section>
        )}

        <section
          className={
            styles.workspace
          }
        >
          <div
            className={
              styles.queuePanel
            }
          >
            <div
              className={
                styles.queueHeader
              }
            >
              <div>
                <span>
                  YOUR ORDERS
                </span>

                <h2>
                  Order queue
                </h2>
              </div>

              <div
                className={
                  styles.orderCount
                }
              >
                {
                  visibleOrders.length
                }
              </div>
            </div>

            <div
              className={
                styles.searchBar
              }
            >
              <span>⌕</span>

              <input
                type="text"
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Search orders..."
              />
            </div>

            <div
              className={
                styles.queueColumns
              }
            >
              <span>
                ORDER
              </span>
              <span>
                SOURCE
              </span>
              <span>
                ITEMS
              </span>
              <span>
                STATUS
              </span>
              <span />
            </div>

            <div
              className={
                styles.orderList
              }
            >
              {loadingSaved ? (
                <div
                  className={
                    styles.emptyQueue
                  }
                >
                  <strong>
                    Loading
                    orders...
                  </strong>
                </div>
              ) : visibleOrders.length ===
                0 ? (
                <div
                  className={
                    styles.emptyQueue
                  }
                >
                  <div>
                    00
                  </div>

                  <strong>
                    No saved
                    orders
                  </strong>

                  <p>
                    Review an
                    order and save
                    it to add it
                    here.
                  </p>
                </div>
              ) : (
                visibleOrders.map(
                  (order) => (
                    <button
                      key={
                        order.orderId
                      }
                      type="button"
                      className={`${styles.orderRow} ${
                        selectedOrder?.orderId ===
                          order.orderId &&
                        selectedKind ===
                          "saved"
                          ? styles.orderRowActive
                          : ""
                      }`}
                      onClick={() =>
                        openSavedOrder(
                          order
                        )
                      }
                    >
                      <div
                        className={
                          styles.orderIdentity
                        }
                      >
                        <span
                          className={
                            styles.orderMarker
                          }
                        />

                        <strong>
                          {
                            order.orderId
                          }
                        </strong>
                      </div>

                      <span
                        className={`${styles.sourcePill} ${
                          order.source ===
                          "External"
                            ? styles.externalPill
                            : order.source ===
                                "Manual"
                              ? styles.manualPill
                              : styles.importedPill
                        }`}
                      >
                        {
                          order.source
                        }
                      </span>

                      <span
                        className={
                          styles.itemCount
                        }
                      >
                        {
                          order.items
                            .length
                        }
                      </span>

                      <span
                        className={
                          styles.statusText
                        }
                      >
                        <i />

                        {
                          order.status
                        }
                      </span>

                      <span
                        className={
                          styles.openArrow
                        }
                      >
                        →
                      </span>
                    </button>
                  )
                )
              )}
            </div>
          </div>

          <aside
            className={
              styles.inspector
            }
          >
            {!selectedOrder ? (
              <div
                className={
                  styles.noSelection
                }
              >
                <div
                  className={
                    styles.noSelectionMark
                  }
                >
                  ≡
                </div>

                <span>
                  ORDER DETAILS
                </span>

                <h2>
                  Select an
                  order
                </h2>

                <p>
                  Choose a
                  loaded or
                  saved order to
                  review its
                  information.
                </p>
              </div>
            ) : (
              <>
                <div
                  className={
                    styles.inspectorHeader
                  }
                >
                  <div>
                    <span>
                      SELECTED ORDER
                    </span>

                    <h2>
                      {
                        selectedOrder.orderId
                      }
                    </h2>
                  </div>

                  <span
                    className={`${styles.sourcePill} ${
                      selectedOrder.source ===
                      "External"
                        ? styles.externalPill
                        : selectedOrder.source ===
                            "Manual"
                          ? styles.manualPill
                          : styles.importedPill
                    }`}
                  >
                    {
                      selectedOrder.source
                    }
                  </span>
                </div>

                <div
                  className={
                    styles.inspectorMeta
                  }
                >
                  <div>
                    <span>
                      ITEMS
                    </span>

                    <strong>
                      {
                        selectedOrder
                          .items
                          .length
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      STATUS
                    </span>

                    <strong>
                      {
                        selectedOrder.status
                      }
                    </strong>
                  </div>
                </div>

                <div
                  className={
                    styles.inspectorItems
                  }
                >
                  {selectedOrder
                    .items
                    .length ===
                  0 ? (
                    <div
                      className={
                        styles.noItems
                      }
                    >
                      No item
                      information
                      is currently
                      available.
                    </div>
                  ) : (
                    selectedOrder.items.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          key={`${item.ItemCode}-${index}`}
                          className={
                            styles.inspectorItem
                          }
                        >
                          <div
                            className={
                              styles.inspectorItemHeader
                            }
                          >
                            <span>
                              {String(
                                index +
                                  1
                              ).padStart(
                                2,
                                "0"
                              )}
                            </span>

                            <div>
                              <strong>
                                {
                                  item.ItemReference
                                }
                              </strong>

                              <small>
                                {
                                  item.ItemCode
                                }
                              </small>
                            </div>
                          </div>

                          <ItemFields
                            item={
                              item
                            }
                            onChange={(
                              field,
                              value
                            ) =>
                              updateSelectedItem(
                                index,
                                field,
                                value
                              )
                            }
                          />
                        </div>
                      )
                    )
                  )}
                </div>

                <div
                  className={
                    styles.inspectorActions
                  }
                >
                  {selectedKind ===
                    "saved" && (
                    <button
                      type="button"
                      className={
                        styles.removeOrderButton
                      }
                      onClick={() =>
                        removeSavedOrder(
                          selectedOrder.orderId
                        )
                      }
                    >
                      Remove
                    </button>
                  )}

                  <button
                    type="button"
                    className={
                      styles.primaryButton
                    }
                    onClick={
                      saveSelectedOrder
                    }
                  >
                    Save changes
                    <span>
                      →
                    </span>
                  </button>
                </div>
              </>
            )}
          </aside>
        </section>
      </main>

      <footer
        className={
          styles.footer
        }
      >
        <div>
          <strong>
            THOMAX .WMS
          </strong>

          <span>
            Perfect Fit
          </span>
        </div>

        <div
          className={
            styles.footerRight
          }
        >
          <span
            className={
              styles.footerDot
            }
          >
            ●
          </span>

          <span>
            Signed in as{" "}
            {username}
          </span>
        </div>
      </footer>
    </div>
  );
}

/* =====================================================
   ITEM FIELDS
   ===================================================== */

type ItemFieldsProps = {
  item:
    OrderItem;

  onChange: (
    field:
      keyof OrderItem,
    value: string
  ) => void;
};

function ItemFields({
  item,
  onChange,
}: ItemFieldsProps) {
  return (
    <div
      className={
        styles.itemGrid
      }
    >
      <label
        className={
          styles.field
        }
      >
        <span>
          Item code
        </span>

        <input
          type="text"
          value={
            item.ItemCode
          }
          onChange={(
            event
          ) =>
            onChange(
              "ItemCode",
              event.target
                .value
            )
          }
          placeholder="ITM-001"
        />
      </label>

      <label
        className={
          styles.field
        }
      >
        <span>
          Item reference
        </span>

        <input
          type="text"
          value={
            item.ItemReference
          }
          onChange={(
            event
          ) =>
            onChange(
              "ItemReference",
              event.target
                .value
            )
          }
          placeholder="Widget A"
        />
      </label>

      <label
        className={
          styles.field
        }
      >
        <span>
          Box group
        </span>

        <input
          type="text"
          value={
            item.BoxGroup ??
            ""
          }
          onChange={(
            event
          ) =>
            onChange(
              "BoxGroup",
              event.target
                .value
            )
          }
          placeholder="Optional"
        />
      </label>

      <label
        className={
          styles.field
        }
      >
        <span>
          Width
        </span>

        <input
          type="number"
          min="0"
          value={
            item.Width ||
            ""
          }
          onChange={(
            event
          ) =>
            onChange(
              "Width",
              event.target
                .value
            )
          }
        />
      </label>

      <label
        className={
          styles.field
        }
      >
        <span>
          Length
        </span>

        <input
          type="number"
          min="0"
          value={
            item.Length ||
            ""
          }
          onChange={(
            event
          ) =>
            onChange(
              "Length",
              event.target
                .value
            )
          }
        />
      </label>

      <label
        className={
          styles.field
        }
      >
        <span>
          Depth
        </span>

        <input
          type="number"
          min="0"
          value={
            item.Depth ||
            ""
          }
          onChange={(
            event
          ) =>
            onChange(
              "Depth",
              event.target
                .value
            )
          }
        />
      </label>
    </div>
  );
}