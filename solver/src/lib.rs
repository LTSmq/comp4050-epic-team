pub mod api;
pub mod constraints;
pub mod models;
pub mod packer;
pub mod solver;
pub mod types;

// Existing public/API model types.
pub use models::*;

// Legacy solver retained for regression comparisons and existing tests.
pub use solver::Solver;

// Primary packing engine.
pub use packer::{Packer, PackerConfig, PackerError, PackingSolution, UnpackedItem};
