"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

import styles from "./order.module.css";

type ItemForm = {
  reference: string;
  quantity: string;
  width: string;
  height: string;
  depth: string;
  weight: string;
};

type OrderFormProps = {
  username: string;
};

const emptyItem = (): ItemForm => ({
  reference: "",
  quantity: "1",
  width: "",
  height: "",
  depth: "",
  weight: "",
});

export default function OrderForm({ username }: OrderFormProps) {
  const [orderReference, setOrderReference] = useState("");
  const [destination, setDestination] = useState("");
  const [sortingLocation, setSortingLocation] = useState("");

  const [items, setItems] = useState<ItemForm[]>([
    emptyItem(),
  ]);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function updateItem(
    index: number,
    field: keyof ItemForm,
    value: string
  ) {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, [field]: value }
          : item
      )
    );
  }

  function addItem() {
    setItems((currentItems) => [
      ...currentItems,
      emptyItem(),
    ]);
  }

  function removeItem(index: number) {
    if (items.length === 1) {
      return;
    }

    setItems((currentItems) =>
      currentItems.filter(
        (_, itemIndex) => itemIndex !== index
      )
    );
  }

  function validateForm() {
    if (!orderReference.trim()) {
      return "Order reference is required.";
    }

    if (!destination.trim()) {
      return "Destination is required.";
    }

    if (!sortingLocation.trim()) {
      return "Sorting location is required.";
    }

    if (items.length === 0) {
      return "At least one item is required.";
    }

    for (let index = 0; index < items.length; index++) {
      const item = items[index];

      if (!item.reference.trim()) {
        return `Item ${index + 1} requires a reference.`;
      }

      const quantity = Number(item.quantity);
      const width = Number(item.width);
      const height = Number(item.height);
      const depth = Number(item.depth);
      const weight = Number(item.weight);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return `Item ${index + 1} requires a valid quantity.`;
      }

      if (
        width <= 0 ||
        height <= 0 ||
        depth <= 0 ||
        weight <= 0
      ) {
        return `Item ${
          index + 1
        } requires valid dimensions and weight.`;
      }
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          orderReference: orderReference.trim(),
          destination: destination.trim(),
          sortingLocation: sortingLocation.trim(),

          items: items.map((item) => ({
            reference: item.reference.trim(),
            quantity: Number(item.quantity),

            dimensions: {
              width: Number(item.width),
              height: Number(item.height),
              depth: Number(item.depth),
            },

            weight: Number(item.weight),
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "Unable to submit the order."
        );

        return;
      }

      setSuccess(
        `Order ${orderReference} submitted successfully.`
      );

      setOrderReference("");
      setDestination("");
      setSortingLocation("");
      setItems([emptyItem()]);
    } catch (error) {
      console.error(
        "Order submission failed:",
        error
      );

      setError(
        "Something went wrong while submitting the order."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>
              Perfect Fit · Portal
            </span>

            <h1>Submit a new order</h1>

            <p>
              Signed in as {username}. Enter the
              information required for this packing
              request.
            </p>
          </div>

          <Link href="/" className={styles.backLink}>
            ← Portal
          </Link>
        </header>

        <form
          className={styles.form}
          onSubmit={handleSubmit}
        >
          <section className={styles.section}>
            <h2>Order details</h2>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>Order reference</span>

                <input
                  type="text"
                  value={orderReference}
                  onChange={(event) =>
                    setOrderReference(
                      event.target.value
                    )
                  }
                  placeholder="e.g. ORD-1001"
                  disabled={loading}
                />
              </label>

              <label className={styles.field}>
                <span>Destination</span>

                <input
                  type="text"
                  value={destination}
                  onChange={(event) =>
                    setDestination(event.target.value)
                  }
                  placeholder="e.g. Sydney Warehouse"
                  disabled={loading}
                />
              </label>

              <label className={styles.field}>
                <span>Sorting location</span>

                <input
                  type="text"
                  value={sortingLocation}
                  onChange={(event) =>
                    setSortingLocation(
                      event.target.value
                    )
                  }
                  placeholder="e.g. Lane 4"
                  disabled={loading}
                />
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Items</h2>

                <p>
                  Add the items contained in this
                  order.
                </p>
              </div>

              <button
                type="button"
                className={styles.secondaryButton}
                onClick={addItem}
                disabled={loading}
              >
                + Add item
              </button>
            </div>

            <div className={styles.items}>
              {items.map((item, index) => (
                <div
                  key={index}
                  className={styles.itemCard}
                >
                  <div
                    className={styles.itemHeading}
                  >
                    <h3>Item {index + 1}</h3>

                    {items.length > 1 && (
                      <button
                        type="button"
                        className={
                          styles.removeButton
                        }
                        onClick={() =>
                          removeItem(index)
                        }
                        disabled={loading}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div
                    className={styles.itemGrid}
                  >
                    <label
                      className={styles.field}
                    >
                      <span>Item reference</span>

                      <input
                        type="text"
                        value={item.reference}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "reference",
                            event.target.value
                          )
                        }
                        placeholder="ITEM-001"
                        disabled={loading}
                      />
                    </label>

                    <label
                      className={styles.field}
                    >
                      <span>Quantity</span>

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "quantity",
                            event.target.value
                          )
                        }
                        disabled={loading}
                      />
                    </label>

                    <label
                      className={styles.field}
                    >
                      <span>Width</span>

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.width}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "width",
                            event.target.value
                          )
                        }
                        disabled={loading}
                      />
                    </label>

                    <label
                      className={styles.field}
                    >
                      <span>Height</span>

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.height}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "height",
                            event.target.value
                          )
                        }
                        disabled={loading}
                      />
                    </label>

                    <label
                      className={styles.field}
                    >
                      <span>Depth</span>

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.depth}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "depth",
                            event.target.value
                          )
                        }
                        disabled={loading}
                      />
                    </label>

                    <label
                      className={styles.field}
                    >
                      <span>Weight</span>

                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={item.weight}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "weight",
                            event.target.value
                          )
                        }
                        disabled={loading}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {error && (
            <div
              className={styles.error}
              role="alert"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              className={styles.success}
              role="status"
            >
              {success}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading
                ? "Submitting..."
                : "Submit order"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}