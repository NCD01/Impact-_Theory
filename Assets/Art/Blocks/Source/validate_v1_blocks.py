"""Re-import and validate every exported Impact Theory V1 FBX asset."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
BLOCKS_DIR = SCRIPT_DIR.parent
MANIFEST_PATH = BLOCKS_DIR / "block_asset_manifest.json"
REPORT_PATH = BLOCKS_DIR / "validation_report.json"
TOLERANCE = 0.002


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for mesh in list(bpy.data.meshes):
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def imported_mesh_bounds(obj: bpy.types.Object):
    origin = obj.matrix_world.translation
    points = [(obj.matrix_world @ vertex.co) - origin for vertex in obj.data.vertices]
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return minimum, maximum


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_piece(piece: dict) -> dict:
    clear_scene()
    fbx_path = BLOCKS_DIR / piece["model_filename"]
    bpy.ops.import_scene.fbx(filepath=str(fbx_path), use_custom_normals=True)
    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if len(mesh_objects) != 1:
        raise RuntimeError(f'{piece["id"]}: expected one imported mesh object, got {len(mesh_objects)}')

    obj = mesh_objects[0]
    minimum, maximum = imported_mesh_bounds(obj)
    actual = {
        "width": maximum.x - minimum.x,
        "height": maximum.z - minimum.z,
        "depth": maximum.y - minimum.y,
    }
    for field in ("width", "height", "depth"):
        if abs(actual[field] - float(piece[field])) > TOLERANCE:
            raise RuntimeError(f'{piece["id"]}: imported {field} is {actual[field]:.6f}, expected {piece[field]:.6f}')

    if piece["pivot"] == "center-bottom":
        pivot_error = max(abs(minimum.z), abs((minimum.x + maximum.x) / 2.0), abs((minimum.y + maximum.y) / 2.0))
    else:
        pivot_error = ((minimum + maximum) / 2.0).length
    if pivot_error > TOLERANCE:
        raise RuntimeError(f'{piece["id"]}: imported pivot error is {pivot_error:.6f}')

    triangle_count = sum(max(1, len(poly.vertices) - 2) for poly in obj.data.polygons)
    with fbx_path.open("rb") as handle:
        signature = handle.read(21)
    if not signature.startswith(b"Kaydara FBX Binary"):
        raise RuntimeError(f'{piece["id"]}: FBX is not a binary FBX file')

    preview_path = BLOCKS_DIR / piece["preview_filename"]
    image = bpy.data.images.load(str(preview_path), check_existing=False)
    image_pixels = image.pixels[:]
    alpha_values = image_pixels[3::4]
    preview_size = [int(image.size[0]), int(image.size[1])]
    alpha_range = [min(alpha_values), max(alpha_values)]
    bpy.data.images.remove(image)
    if preview_size != [512, 512] or alpha_range[0] > 0.001 or alpha_range[1] < 0.999:
        raise RuntimeError(f'{piece["id"]}: preview is not a 512x512 RGBA image with transparency')

    return {
        "id": piece["id"],
        "status": "PASS",
        "model_filename": piece["model_filename"],
        "file_size_bytes": fbx_path.stat().st_size,
        "sha256": sha256(fbx_path),
        "mesh_object_count": len(mesh_objects),
        "vertex_count": len(obj.data.vertices),
        "triangle_count": triangle_count,
        "imported_dimensions_su": {key: round(value, 6) for key, value in actual.items()},
        "pivot": piece["pivot"],
        "pivot_error_su": round(pivot_error, 8),
        "preview_filename": piece["preview_filename"],
        "preview_size_pixels": preview_size,
        "preview_alpha_range": [round(value, 6) for value in alpha_range],
    }


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    results = [validate_piece(piece) for piece in manifest["pieces"]]
    report = {
        "library": manifest["library"],
        "validation_status": "PASS",
        "validated_piece_count": len(results),
        "tolerance_su": TOLERANCE,
        "checks": ["binary FBX", "single mesh object", "dimensions", "pivot", "clean re-import", "512x512 RGBA preview transparency"],
        "pieces": results,
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Validated {len(results)} FBX assets: PASS")


if __name__ == "__main__":
    main()
