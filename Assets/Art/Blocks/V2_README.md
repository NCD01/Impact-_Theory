# Impact Theory V2 Materialized Block Library

V2 adds the approved recognizable-material art direction while preserving every V1 asset.

## Locations

- V2 materialized FBX variants: `MaterialVariants/V2/`
- V2 primary previews: `Previews/V2/`
- V2 additional orientation views: `Previews/V2/Views/`
- Reusable material library: `../Materials/V2/V2_MATERIAL_LIBRARY.blend`
- Materialized block source: `Source/V2_BLOCK_LIBRARY_MATERIALIZED.blend`
- V2 variant manifest: `MaterialVariants/V2/material_variant_manifest_v2.json`
- V2 validation report: `MaterialVariants/V2/validation_report_v2.json`

## Material Architecture

Geometry and material identity remain separate. The original 15 V1 FBX files are the geometry sources and were not modified. V2 showcase files demonstrate reusable Wood, Brick, Stone, Concrete, Steel, Painted Steel, and Rubber material families.

No physics values were created or changed during this art pass.

## Validation

- 15 V2 materialized FBX variants
- 40 transparent 512 × 512 previews
- Exact V1 dimensions and pivots retained
- One mesh object per imported FBX
- V1 SHA-256 hashes unchanged
