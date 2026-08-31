"""Generate the Impact Theory V1 structural block library in Blender.

Run with Blender 4.5+:
    blender --background --python generate_v1_blocks.py
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
BLOCKS_DIR = SCRIPT_DIR.parent
PREVIEW_DIR = BLOCKS_DIR / "Previews"
BEVEL_WIDTH = 0.04
BEVEL_SEGMENTS = 2


PIECES = [
    {"id": "B01_SMALL_BLOCK", "name": "Small Block", "category": "BASIC", "width": 1.0, "height": 1.0, "depth": 1.0, "pivot": "center-bottom"},
    {"id": "B02_MEDIUM_BLOCK", "name": "Medium Block", "category": "BASIC", "width": 2.0, "height": 1.0, "depth": 1.0, "pivot": "center-bottom"},
    {"id": "B03_LONG_BEAM", "name": "Long Beam", "category": "BASIC", "width": 4.0, "height": 1.0, "depth": 1.0, "pivot": "center-bottom"},
    {"id": "B04_TALL_BLOCK", "name": "Tall Block", "category": "BASIC", "width": 1.0, "height": 3.0, "depth": 1.0, "pivot": "center-bottom"},
    {"id": "B05_LARGE_BLOCK", "name": "Large Block", "category": "BASIC", "width": 2.0, "height": 2.0, "depth": 1.0, "pivot": "center-bottom"},
    {"id": "S01_ROUND_COLUMN", "name": "Round Column", "category": "SUPPORT", "width": 1.0, "height": 3.0, "depth": 1.0, "pivot": "center-bottom"},
    {"id": "S02_SHORT_COLUMN", "name": "Short Column", "category": "SUPPORT", "width": 1.0, "height": 2.0, "depth": 1.0, "pivot": "center-bottom"},
    {"id": "S03_WIDE_FOOTING", "name": "Wide Footing", "category": "SUPPORT", "width": 3.0, "height": 0.5, "depth": 1.0, "pivot": "center-bottom"},
    {"id": "S04_WEDGE", "name": "Wedge", "category": "SUPPORT", "width": 2.0, "height": 1.0, "depth": 1.0, "pivot": "center-bottom"},
    {"id": "S05_ARCH", "name": "Arch", "category": "SUPPORT", "width": 3.0, "height": 2.0, "depth": 1.0, "pivot": "center-bottom"},
    {"id": "A01_T_BLOCK", "name": "T-Block", "category": "ADVANCED", "width": 3.0, "height": 2.0, "depth": 1.0, "pivot": "center-bottom"},
    {"id": "A02_L_BLOCK", "name": "L-Block", "category": "ADVANCED", "width": 2.0, "height": 2.0, "depth": 1.0, "pivot": "center-bottom"},
    {"id": "A03_CROSS_BEAM", "name": "Cross Beam", "category": "ADVANCED", "width": 3.0, "height": 3.0, "depth": 1.0, "pivot": "geometric-center"},
    {"id": "A04_ROLLER", "name": "Roller", "category": "ADVANCED", "width": 2.0, "height": 1.0, "depth": 1.0, "pivot": "geometric-center"},
    {"id": "A05_MECHANICAL_STABILIZER", "name": "Mechanical Stabilizer", "category": "ADVANCED", "width": 3.0, "height": 2.0, "depth": 1.0, "pivot": "center-bottom"},
]


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"


def make_material(name: str, rgba: tuple[float, float, float, float], metallic: float, roughness: float):
    material = bpy.data.materials.new(name)
    material.diffuse_color = rgba
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = rgba
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    return material


def apply_bevel(obj: bpy.types.Object, width: float = BEVEL_WIDTH, segments: int = BEVEL_SEGMENTS) -> None:
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    modifier = obj.modifiers.new(name="Structural Edge Chamfer", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = math.radians(20.0)
    modifier.harden_normals = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    for edge in obj.data.edges:
        try:
            edge.use_edge_sharp = edge.calc_face_angle(0.0) > math.radians(65.0)
        except (ValueError, AttributeError):
            pass


def finish_object(obj: bpy.types.Object, material, piece: dict) -> bpy.types.Object:
    obj.name = piece["id"]
    obj.data.name = f'{piece["id"]}_MESH'
    if not obj.data.materials:
        obj.data.materials.append(material)
    obj["asset_id"] = piece["id"]
    obj["display_name"] = piece["name"]
    obj["category"] = piece["category"]
    obj["dimensions_su"] = f'{piece["width"]} x {piece["height"]} x {piece["depth"]}'
    obj["pivot"] = piece["pivot"]
    obj["structural_unit_meters"] = 1.0
    return obj


def create_box(piece: dict, material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))
    obj = bpy.context.object
    obj.dimensions = (piece["width"], piece["depth"], piece["height"])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for vertex in obj.data.vertices:
        vertex.co.z += piece["height"] / 2.0
    apply_bevel(obj)
    return finish_object(obj, material, piece)


def create_profile_prism(piece: dict, outline: list[tuple[float, float]], material) -> bpy.types.Object:
    """Extrude a counter-clockwise X/Z outline through the standard Y depth."""
    depth = piece["depth"]
    count = len(outline)
    vertices = [(x, -depth / 2.0, z) for x, z in outline]
    vertices += [(x, depth / 2.0, z) for x, z in outline]
    faces = [tuple(range(count)), tuple(reversed(range(count, count * 2)))]
    for index in range(count):
        following = (index + 1) % count
        faces.append((index, count + index, count + following, following))
    mesh = bpy.data.meshes.new(f'{piece["id"]}_MESH')
    mesh.from_pydata(vertices, [], faces)
    mesh.validate(verbose=False)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(piece["id"], mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    apply_bevel(obj)
    return finish_object(obj, material, piece)


def create_vertical_cylinder(piece: dict, material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=piece["width"] / 2.0, depth=piece["height"], location=(0.0, 0.0, 0.0))
    obj = bpy.context.object
    for vertex in obj.data.vertices:
        vertex.co.z += piece["height"] / 2.0
    apply_bevel(obj, width=0.035, segments=2)
    return finish_object(obj, material, piece)


def create_roller(piece: dict, material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=piece["height"] / 2.0, depth=piece["width"], location=(0.0, 0.0, 0.0), rotation=(0.0, math.radians(90.0), 0.0))
    obj = bpy.context.object
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    apply_bevel(obj, width=0.035, segments=2)
    return finish_object(obj, material, piece)


def create_wedge(piece: dict, material) -> bpy.types.Object:
    return create_profile_prism(piece, [(-1.0, 0.0), (1.0, 0.0), (-1.0, 1.0)], material)


def add_component_box(name: str, dimensions: tuple[float, float, float], center: tuple[float, float, float], material, bevel: float = 0.025):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    apply_bevel(obj, width=bevel, segments=2)
    return obj


def add_component_beam(name: str, start: tuple[float, float], end: tuple[float, float], thickness: float, depth: float, material):
    dx = end[0] - start[0]
    dz = end[1] - start[1]
    length = math.hypot(dx, dz)
    center = ((start[0] + end[0]) / 2.0, 0.0, (start[1] + end[1]) / 2.0)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=center, rotation=(0.0, -math.atan2(dz, dx), 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (length, depth, thickness)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    apply_bevel(obj, width=0.018, segments=2)
    return obj


def add_component_cylinder(name: str, radius: float, length: float, location: tuple[float, float, float], material, axis: str = "Z"):
    rotation = (0.0, 0.0, 0.0)
    if axis == "Y":
        rotation = (math.radians(90.0), 0.0, 0.0)
    elif axis == "X":
        rotation = (0.0, math.radians(90.0), 0.0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=length, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(material)
    apply_bevel(obj, width=min(0.015, radius * 0.25), segments=2)
    return obj


def create_mechanical_stabilizer(piece: dict, primary_material, accent_material) -> bpy.types.Object:
    components = []
    components.append(add_component_box("Top_Header", (3.0, 0.92, 0.35), (0.0, 0.0, 1.825), primary_material))
    components.append(add_component_box("Left_Upright", (0.34, 0.78, 1.55), (-1.15, 0.0, 0.875), primary_material))
    components.append(add_component_box("Right_Upright", (0.34, 0.78, 1.55), (1.15, 0.0, 0.875), primary_material))
    components.append(add_component_box("Left_Foot", (0.70, 1.0, 0.20), (-1.15, 0.0, 0.10), primary_material))
    components.append(add_component_box("Right_Foot", (0.70, 1.0, 0.20), (1.15, 0.0, 0.10), primary_material))
    components.append(add_component_beam("Left_Brace", (-1.03, 0.48), (-0.35, 1.62), 0.18, 0.50, primary_material))
    components.append(add_component_beam("Right_Brace", (1.03, 0.48), (0.35, 1.62), 0.18, 0.50, primary_material))

    for side, x in (("Left", -0.66), ("Right", 0.66)):
        components.append(add_component_cylinder(f"{side}_Piston_Body", 0.13, 0.62, (x, 0.0, 0.56), accent_material))
        components.append(add_component_cylinder(f"{side}_Piston_Rod", 0.07, 0.72, (x, 0.0, 1.22), accent_material))
        components.append(add_component_cylinder(f"{side}_Top_Bolt", 0.09, 0.06, (x, -0.47, 1.58), accent_material, axis="Y"))
        components.append(add_component_cylinder(f"{side}_Base_Bolt", 0.09, 0.06, (x, -0.47, 0.24), accent_material, axis="Y"))

    bpy.ops.object.select_all(action="DESELECT")
    for component in components:
        component.select_set(True)
    bpy.context.view_layer.objects.active = components[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR", center="MEDIAN")
    return finish_object(obj, primary_material, piece)


def build_piece(piece: dict, primary_material, accent_material) -> bpy.types.Object:
    piece_id = piece["id"]
    if piece_id in {"B01_SMALL_BLOCK", "B02_MEDIUM_BLOCK", "B03_LONG_BEAM", "B04_TALL_BLOCK", "B05_LARGE_BLOCK", "S02_SHORT_COLUMN", "S03_WIDE_FOOTING"}:
        return create_box(piece, primary_material)
    if piece_id == "S01_ROUND_COLUMN":
        return create_vertical_cylinder(piece, primary_material)
    if piece_id == "S04_WEDGE":
        return create_wedge(piece, primary_material)
    if piece_id == "S05_ARCH":
        outline = [(-1.5, 0.0), (-0.5, 0.0), (-0.5, 1.0), (0.5, 1.0), (0.5, 0.0), (1.5, 0.0), (1.5, 2.0), (-1.5, 2.0)]
        return create_profile_prism(piece, outline, primary_material)
    if piece_id == "A01_T_BLOCK":
        outline = [(-0.5, 0.0), (0.5, 0.0), (0.5, 1.0), (1.5, 1.0), (1.5, 2.0), (-1.5, 2.0), (-1.5, 1.0), (-0.5, 1.0)]
        return create_profile_prism(piece, outline, primary_material)
    if piece_id == "A02_L_BLOCK":
        outline = [(-1.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0), (0.0, 2.0), (-1.0, 2.0)]
        return create_profile_prism(piece, outline, primary_material)
    if piece_id == "A03_CROSS_BEAM":
        outline = [(-0.5, -1.5), (0.5, -1.5), (0.5, -0.5), (1.5, -0.5), (1.5, 0.5), (0.5, 0.5), (0.5, 1.5), (-0.5, 1.5), (-0.5, 0.5), (-1.5, 0.5), (-1.5, -0.5), (-0.5, -0.5)]
        return create_profile_prism(piece, outline, primary_material)
    if piece_id == "A04_ROLLER":
        return create_roller(piece, primary_material)
    if piece_id == "A05_MECHANICAL_STABILIZER":
        return create_mechanical_stabilizer(piece, primary_material, accent_material)
    raise ValueError(f"Unhandled piece: {piece_id}")


def local_bounds(obj: bpy.types.Object):
    points = [vertex.co for vertex in obj.data.vertices]
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


def normalize_object_bounds(obj: bpy.types.Object, piece: dict) -> None:
    """Preserve exact gameplay bounds after chamfering acute or concave edges."""
    minimum, maximum = local_bounds(obj)
    center = (minimum + maximum) / 2.0
    actual_width = maximum.x - minimum.x
    actual_depth = maximum.y - minimum.y
    actual_height = maximum.z - minimum.z
    scale_x = piece["width"] / actual_width
    scale_y = piece["depth"] / actual_depth
    scale_z = piece["height"] / actual_height

    for vertex in obj.data.vertices:
        vertex.co.x = (vertex.co.x - center.x) * scale_x
        vertex.co.y = (vertex.co.y - center.y) * scale_y
        if piece["pivot"] == "center-bottom":
            vertex.co.z = (vertex.co.z - minimum.z) * scale_z
        else:
            vertex.co.z = (vertex.co.z - center.z) * scale_z
    obj.data.update()


def validate_source_object(obj: bpy.types.Object, piece: dict) -> None:
    minimum, maximum = local_bounds(obj)
    actual = (maximum.x - minimum.x, maximum.z - minimum.z, maximum.y - minimum.y)
    expected = (piece["width"], piece["height"], piece["depth"])
    for axis, actual_value, expected_value in zip("WHD", actual, expected):
        if abs(actual_value - expected_value) > 0.001:
            raise RuntimeError(f'{piece["id"]} {axis} is {actual_value:.6f}, expected {expected_value:.6f}')
    if piece["pivot"] == "center-bottom":
        if abs(minimum.z) > 0.001 or abs((minimum.x + maximum.x) / 2.0) > 0.001 or abs((minimum.y + maximum.y) / 2.0) > 0.001:
            raise RuntimeError(f'{piece["id"]} does not have a center-bottom pivot')
    else:
        center = (minimum + maximum) / 2.0
        if center.length > 0.001:
            raise RuntimeError(f'{piece["id"]} does not have a geometric-center pivot')


def export_fbx(obj: bpy.types.Object, destination: Path) -> None:
    original_location = obj.location.copy()
    obj.location = (0.0, 0.0, 0.0)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.fbx(
        filepath=str(destination),
        use_selection=True,
        object_types={"MESH"},
        use_mesh_modifiers=True,
        use_custom_props=True,
        add_leaf_bones=False,
        bake_anim=False,
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_NONE",
        axis_forward="-Z",
        axis_up="Y",
        mesh_smooth_type="FACE",
        use_triangles=True,
        path_mode="AUTO",
    )
    obj.location = original_location


def look_at(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def setup_preview_scene():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "Preview_Camera"
    camera.data.type = "ORTHO"
    camera.data.lens = 50
    scene.camera = camera

    lights = []
    for name, energy, size in (("Key", 850.0, 5.0), ("Fill", 500.0, 4.0), ("Rim", 700.0, 3.0)):
        light_data = bpy.data.lights.new(name=name, type="AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        bpy.context.collection.objects.link(light)
        lights.append(light)
    return camera, lights


def render_preview(obj: bpy.types.Object, piece: dict, all_piece_objects: list[bpy.types.Object], camera, lights) -> None:
    original_location = obj.location.copy()
    obj.location = (0.0, 0.0, 0.0)
    for other in all_piece_objects:
        other.hide_render = other != obj

    minimum, maximum = local_bounds(obj)
    center = (minimum + maximum) / 2.0
    extent = max(piece["width"], piece["height"], piece["depth"])
    camera.data.ortho_scale = max(2.0, extent * 1.55)
    camera.location = center + Vector((extent * 1.65, -extent * 2.15, extent * 1.35))
    look_at(camera, center)

    light_positions = [
        center + Vector((extent * 2.5, -extent * 2.5, extent * 3.5)),
        center + Vector((-extent * 2.5, -extent * 1.2, extent * 1.8)),
        center + Vector((0.0, extent * 2.8, extent * 2.5)),
    ]
    for light, position in zip(lights, light_positions):
        light.location = position
        light.data.size = extent * 1.4
        look_at(light, center)

    bpy.context.scene.render.filepath = str(PREVIEW_DIR / f'{piece["id"]}.png')
    bpy.ops.render.render(write_still=True)
    obj.location = original_location


def write_manifest() -> None:
    manifest_pieces = []
    for piece in PIECES:
        item = dict(piece)
        item["unit"] = "SU"
        item["model_filename"] = f'{piece["id"]}.fbx'
        item["preview_filename"] = f'Previews/{piece["id"]}.png'
        manifest_pieces.append(item)

    manifest = {
        "library": "Impact Theory V1 Structural Block Library",
        "version": 1,
        "structural_unit_meters": 1.0,
        "orientation": {"up": "Y", "width": "X", "depth": "Z"},
        "piece_count": len(manifest_pieces),
        "pieces": manifest_pieces,
    }
    (BLOCKS_DIR / "block_asset_manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    fields = ["id", "name", "category", "width", "height", "depth", "unit", "pivot", "model_filename", "preview_filename"]
    with (BLOCKS_DIR / "block_asset_manifest.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows({field: item[field] for field in fields} for item in manifest_pieces)


def write_readme() -> None:
    text = """# Impact Theory V1 Structural Blocks

This directory contains the 15 FBX game assets for the Version 1 structural kit.

- Scale: 1 Structural Unit (SU) = 1 meter
- Model axes: X = width, Y = up, Z = depth
- Standard depth: 1 SU
- Normal pivot: center-bottom
- Exceptions: A03 Cross Beam and A04 Roller use geometric-center pivots
- Materials are temporary and intentionally simple
- Physics, colliders, and procedural-generator values are intentionally not included

`block_asset_manifest.json` is the authoritative machine-readable manifest. The CSV is provided for quick inspection. Transparent previews are under `Previews/`, and the reproducible Blender source is under `Source/`.
"""
    (BLOCKS_DIR / "README.md").write_text(text, encoding="utf-8")


def main() -> None:
    BLOCKS_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    reset_scene()
    primary_material = make_material("V1_Structural_BlueGray", (0.18, 0.42, 0.58, 1.0), metallic=0.18, roughness=0.3)
    accent_material = make_material("V1_Mechanical_Accent", (0.075, 0.095, 0.12, 1.0), metallic=0.7, roughness=0.22)

    objects = []
    for piece in PIECES:
        obj = build_piece(piece, primary_material, accent_material)
        normalize_object_bounds(obj, piece)
        validate_source_object(obj, piece)
        objects.append(obj)

    for obj, piece in zip(objects, PIECES):
        export_fbx(obj, BLOCKS_DIR / f'{piece["id"]}.fbx')

    camera, lights = setup_preview_scene()
    for obj, piece in zip(objects, PIECES):
        render_preview(obj, piece, objects, camera, lights)

    for index, obj in enumerate(objects):
        column = index % 5
        row = index // 5
        obj.location = ((column - 2) * 5.5, row * 4.5, 0.0)
        obj.hide_render = False

    write_manifest()
    write_readme()
    bpy.ops.wm.save_as_mainfile(filepath=str(SCRIPT_DIR / "V1_BLOCK_LIBRARY.blend"), compress=True)
    print(f"Generated {len(objects)} FBX models and previews in {BLOCKS_DIR}")


if __name__ == "__main__":
    main()
