use serde::{Deserialize, Serialize};

use crate::models::{BoxType, Item, PackedBox};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]

pub struct PackingRequest
{
    pub items: Vec<Item>,
    pub box_types: Vec<BoxType>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "PascalCase")]

pub struct PackingResponse 
{
    pub packed_boxes: Vec<PackedBox>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "PascalCase")]

pub struct ErrorResponse 
{
    pub error: String,
}