use serde::{Deserialize, Serialize};

use crate::models::{BoxType, Item, PackedBox};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]

pub struct PackingRequest
{
    pub items: Vec<Item>,
    pub box_types: Vec<BoxType>,
    /// The caller's own name for this order. We hand it straight back on the
    /// response and put it on both copies we send out.
    ///
    /// The reason it exists is the shape of the Sprint 1 data flow. An order
    /// reaches the solver from the portal, but the finished solution goes
    /// directly to the visualiser. So the visualiser ends up holding a solution
    /// for an order it never sent, and without something like this it has no way
    /// of telling which order that solution belongs to.
    ///
    /// The solver treats it as a label and nothing more. It is never read,
    /// stored, or checked for being unique. If a request arrives without one,
    /// the solver makes one up rather than sending out a solution nobody can
    /// identify.
    #[serde(default)]
    pub order_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "PascalCase")]

pub struct PackingResponse
{
    pub order_id: String,
    pub packed_boxes: Vec<PackedBox>,
    /// The items the solver could not fit into any carton.
    ///
    /// Almost always empty, and always present even when it is empty, so a
    /// reader can count it without checking whether the key is there.
    ///
    /// It exists because a single item that fits nowhere used to sink the whole
    /// answer. The solver now packs what it can and lists the rest here, so an
    /// order with one oversized line still comes back with its other cartons and
    /// still reaches the visualiser and the portal. Anything in this list needs a
    /// person to deal with: a bigger carton type, a split shipment, or a word
    /// with whoever sent the order.
    pub unpacked_items: Vec<Item>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "PascalCase")]

pub struct ErrorResponse
{
    pub error: String,
}
