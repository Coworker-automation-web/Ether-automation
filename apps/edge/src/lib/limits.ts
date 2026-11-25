/**
 * D1 caps a row at about 2 MB, and R2 is not available, so snapshot and upload bytes live in
 * D1 child tables with this per-row cap (headroom below the platform limit). Revisit if R2 returns.
 */
export const MAX_BLOB_BYTES = 1_800_000;
