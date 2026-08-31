"""Validate V2 materialized variants while proving V1 remains unchanged."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
BLOCKS_DIR = SCRIPT_DIR.parent
VARIANTS_DIR = BLOCKS_DIR / "MaterialVariants" / "V2"
BASE_MANIFEST = BLOCKS_DIR / "block_asset_manifest.json"
BASE_VALIDATION = BLOCKS_DIR / "validation_report.json"
VARIANT_MANIFEST = VARIANTS_DIR / "material_variant_manifest_v2.json"
REPORT_PATH = VARIANTS_DIR / "validation_report_v2.json"
TOLERANCE = 0.002


def digest(path: Path) -> str:
    value = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def bounds_relative_to_origin(obj: bpy.types.Object):
    origin = obj.matrix_world.translation
    points = [(obj.matrix_world @ vertex.co) - origin for vertex in obj.data.vertices]
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return minimum, maximum


def validate_variant(entry: dict, piece: dict) -> dict:
    clear_scene()
    path = BLOCKS_DIR / entry["model_filename"]
    with path.open("rb") as handle:
        if not handle.read(21).startswith(b"Kaydara FBX Binary"):
            raise RuntimeError(f"Not a binary FBX: {path}")
    bpy.ops.import_scene.fbx(filepath=str(path), use_custom_normals=True)
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(meshes) != 1:
        raise RuntimeError(f'{entry["variant_id"]}: expected one mesh object, got {len(meshes)}')
    obj = meshes[0]
    minimum, maximum = bounds_relative_to_origin(obj)
    dimensions = {
        "width": maximum.x - minimum.x,
        "height": maximum.z - minimum.z,
        "depth": maximum.y - minimum.y,
    }
    for field in ("width", "height", "depth"):
        if abs(dimensions[field] - float(piece[field])) > TOLERANCE:
            raise RuntimeError(f'{entry["variant_id"]}: invalid {field} {dimensions[field]:.6f}')
    if piece["pivot"] == "center-bottom":
        pivot_error = max(abs(minimum.z), abs((minimum.x + maximum.x) / 2.0), abs((minimum.y + maximum.y) / 2.0))
    else:
        pivot_error = ((minimum + maximum) / 2.0).length
    if pivot_error > TOLERANCE:
        raise RuntimeError(f'{entry["variant_id"]}: pivot error {pivot_error:.6f}')
    material_names = [slot.material.name for slot in obj.material_slots if slot.material]
    if not material_names:
        raise RuntimeError(f'{entry["variant_id"]}: no imported material slots')
    return {
        "variant_id": entry["variant_id"],
        "status": "PASS",
        "model_filename": entry["model_filename"],
        "sha256": digest(path),
        "file_size_bytes": path.stat().st_size,
        "mesh_object_count": 1,
        "vertex_count": len(obj.data.vertices),
        "triangle_count": sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons),
        "dimensions_su": {key: round(value, 6) for key, value in dimensions.items()},
        "pivot": piece["pivot"],
        "pivot_error_su": round(pivot_error, 8),
        "imported_material_slots": material_names,
    }


def validate_preview(path: Path) -> dict:
    image = bpy.data.images.load(str(path), check_existing=False)
    pixels = image.pixels[:]
    alpha = pixels[3::4]
    result = {
        "filename": str(path.relative_to(BLOCKS_DIR)).replace("\\", "/"),
        "size_pixels": [int(image.size[0]), int(image.size[1])],
        "alpha_range": [round(min(alpha), 6), round(max(alpha), 6)],
    }
    bpy.data.images.remove(image)
    if result["size_pixels"] != [512, 512] or result["alpha_range"] != [0.0, 1.0]:
        raise RuntimeError(f"Invalid preview: {path}")
    return result


def main() -> None:
    base_manifest = json.loads(BASE_MANIFEST.read_text(encoding="utf-8"))
    pieces = {piece["id"]: piece for piece in base_manifest["pieces"]}
    base_validation = json.loads(BASE_VALIDATION.read_text(encoding="utf-8"))
    expected_v1_hashes = {piece["model_filename"]: piece["sha256"] for piece in base_validation["pieces"]}
    current_v1_hashes = {filename: digest(BLOCKS_DIR / filename) for filename in expected_v1_hashes}
    if current_v1_hashes != expected_v1_hashes:
        raise RuntimeError("One or more V1 geometry FBX files changed")

    variants = json.loads(VARIANT_MANIFEST.read_text(encoding="utf-8"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    variant_results = [validate_variant(entry, pieces[entry["geometry_id"]]) for entry in variants["variants"]]

    preview_paths = []
    for preview_set in variants["preview_sets"]:
        preview_paths.extend(BLOCKS_DIR / preview["filename"] for preview in preview_set["previews"])
    if len(preview_paths) != 40 or len(set(preview_paths)) != 40:
        raise RuntimeError(f"Expected 40 unique V2 previews, got {len(set(preview_paths))}")
    preview_results = [validate_preview(path) for path in preview_paths]

    report = {
        "library": "Impact Theory V2 Material System",
        "status": "PASS",
        "v1_geometry_fbx_unchanged": True,
        "v1_geometry_count": len(current_v1_hashes),
        "v2_variant_fbx_count": len(variant_results),
        "v2_preview_count": len(preview_results),
        "tolerance_su": TOLERANCE,
        "checks": ["V1 SHA-256 preservation", "binary V2 FBX", "clean re-import", "single mesh object", "dimensions", "pivots", "material slots", "512x512 RGBA transparency"],
        "variants": variant_results,
        "previews": preview_results,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("V2 validation PASS: 15 variants, 40 previews, V1 unchanged.")


if __name__ == "__main__":
    main()
