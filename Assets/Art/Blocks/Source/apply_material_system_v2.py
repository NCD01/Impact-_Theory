"""Create the approved V2 material system without overwriting V1 assets."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
BLOCKS_DIR = SCRIPT_DIR.parent
ART_DIR = BLOCKS_DIR.parent
MATERIALS_DIR = ART_DIR / "Materials" / "V2"
VARIANTS_DIR = BLOCKS_DIR / "MaterialVariants" / "V2"
PREVIEWS_DIR = BLOCKS_DIR / "Previews" / "V2"
VIEWS_DIR = PREVIEWS_DIR / "Views"

sys.path.insert(0, str(SCRIPT_DIR))
import material_test_addendum_005 as base


VIEW_SPECS = {
    "B01_SMALL_BLOCK": [{"name": "STANDARD_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"}],
    "B02_MEDIUM_BLOCK": [
        {"name": "STANDARD_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "UPRIGHT", "rotation": (0, -90, 0), "camera": "THREE_QUARTER"},
        {"name": "SIDEWAYS", "rotation": (0, 0, 0), "camera": "FRONT"},
    ],
    "B03_LONG_BEAM": [
        {"name": "STANDARD_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "UPRIGHT", "rotation": (0, -90, 0), "camera": "THREE_QUARTER"},
        {"name": "END_VIEW", "rotation": (0, 0, 0), "camera": "SIDE"},
    ],
    "B04_TALL_BLOCK": [
        {"name": "STANDING", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "SIDEWAYS", "rotation": (0, 90, 0), "camera": "THREE_QUARTER"},
    ],
    "B05_LARGE_BLOCK": [
        {"name": "STANDARD_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "SIDE_VIEW", "rotation": (0, 0, 0), "camera": "SIDE"},
    ],
    "S01_ROUND_COLUMN": [
        {"name": "STANDING", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "HORIZONTAL", "rotation": (0, 90, 0), "camera": "THREE_QUARTER"},
    ],
    "S02_SHORT_COLUMN": [
        {"name": "STANDING", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "SIDEWAYS", "rotation": (0, 90, 0), "camera": "THREE_QUARTER"},
    ],
    "S03_WIDE_FOOTING": [
        {"name": "STANDARD_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "UPRIGHT", "rotation": (0, -90, 0), "camera": "THREE_QUARTER"},
    ],
    "S04_WEDGE": [
        {"name": "SLOPE_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "OPPOSITE_SIDE", "rotation": (0, 0, 180), "camera": "THREE_QUARTER"},
        {"name": "SIDE_PROFILE", "rotation": (0, 0, 0), "camera": "FRONT"},
    ],
    "S05_ARCH": [
        {"name": "ARCHITECTURAL_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "FRONT", "rotation": (0, 0, 0), "camera": "FRONT"},
        {"name": "LAID_DOWN", "rotation": (90, 0, 0), "camera": "THREE_QUARTER"},
    ],
    "A01_T_BLOCK": [
        {"name": "STANDARD_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "ROTATED", "rotation": (0, 0, 90), "camera": "THREE_QUARTER"},
        {"name": "FRONT", "rotation": (0, 0, 0), "camera": "FRONT"},
    ],
    "A02_L_BLOCK": [
        {"name": "STANDARD_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "ROTATED", "rotation": (0, 0, 90), "camera": "THREE_QUARTER"},
        {"name": "FRONT", "rotation": (0, 0, 0), "camera": "FRONT"},
    ],
    "A03_CROSS_BEAM": [
        {"name": "STANDARD_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "ROTATED", "rotation": (0, 0, 45), "camera": "THREE_QUARTER"},
        {"name": "FRONT", "rotation": (0, 0, 0), "camera": "FRONT"},
    ],
    "A04_ROLLER": [
        {"name": "HORIZONTAL_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "END_VIEW", "rotation": (0, 0, 0), "camera": "SIDE"},
        {"name": "ALTERNATE_ANGLE", "rotation": (0, 0, 38), "camera": "THREE_QUARTER"},
    ],
    "A05_MECHANICAL_STABILIZER": [
        {"name": "STANDING", "rotation": (0, 0, 0), "camera": "LOW_THREE_QUARTER"},
        {"name": "LAID_DOWN", "rotation": (90, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "FRONT", "rotation": (0, 0, 0), "camera": "FRONT"},
        {"name": "SIDE", "rotation": (0, 0, 0), "camera": "SIDE"},
        {"name": "THREE_QUARTER", "rotation": (0, 0, 0), "camera": "HIGH_THREE_QUARTER"},
    ],
}


SHOWCASE_VARIANTS = {
    "B01_SMALL_BLOCK": ("B01_SMALL_BLOCK_WOOD_V2", ["MAT_WOOD"]),
    "B02_MEDIUM_BLOCK": ("B02_MEDIUM_BLOCK_WOOD_V2", ["MAT_WOOD"]),
    "B03_LONG_BEAM": ("B03_LONG_BEAM_PAINTED_STEEL_V2", ["MAT_PAINTED_STEEL_ORANGE", "MAT_STEEL"]),
    "B04_TALL_BLOCK": ("B04_TALL_BLOCK_BRICK_V2", ["MAT_BRICK"]),
    "B05_LARGE_BLOCK": ("B05_LARGE_BLOCK_CONCRETE_V2", ["MAT_CONCRETE"]),
    "S01_ROUND_COLUMN": ("S01_ROUND_COLUMN_STEEL_V2", ["MAT_STEEL", "MAT_PAINTED_STEEL_COBALT"]),
    "S02_SHORT_COLUMN": ("S02_SHORT_COLUMN_CONCRETE_V2", ["MAT_CONCRETE"]),
    "S03_WIDE_FOOTING": ("S03_WIDE_FOOTING_STONE_V2", ["MAT_STONE"]),
    "S04_WEDGE": ("S04_WEDGE_STONE_V2", ["MAT_STONE", "MAT_STONE_CUT_FACE"]),
    "S05_ARCH": ("S05_ARCH_BRICK_V2", ["MAT_BRICK"]),
    "A01_T_BLOCK": ("A01_T_BLOCK_PAINTED_STEEL_V2", ["MAT_PAINTED_STEEL_NAVY", "MAT_PAINTED_STEEL_ORANGE"]),
    "A02_L_BLOCK": ("A02_L_BLOCK_PAINTED_STEEL_V2", ["MAT_PAINTED_STEEL_COBALT", "MAT_PAINTED_STEEL_SUPPORT_YELLOW"]),
    "A03_CROSS_BEAM": ("A03_CROSS_BEAM_STEEL_V2", ["MAT_STEEL", "MAT_PAINTED_STEEL_ORANGE"]),
    "A04_ROLLER": ("A04_ROLLER_RUBBER_STEEL_V2", ["MAT_RUBBER", "MAT_STEEL"]),
    "A05_MECHANICAL_STABILIZER": ("A05_MECHANICAL_STABILIZER_PAINTED_STEEL_V2", ["MAT_PAINTED_STEEL_NAVY", "MAT_PAINTED_STEEL_COBALT", "MAT_PAINTED_STEEL_ORANGE", "MAT_STEEL", "MAT_PAINTED_STEEL_SUPPORT_YELLOW"]),
}


def make_brick():
    material, shader = base.new_material("MAT_BRICK", metallic=0.0, roughness=0.46, coat=0.07)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    coordinates = nodes.new("ShaderNodeTexCoord")
    separate = nodes.new("ShaderNodeSeparateXYZ")
    combine = nodes.new("ShaderNodeCombineXYZ")
    brick = nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.5
    brick.offset_frequency = 2
    brick.squash = 1.0
    brick.squash_frequency = 2
    brick.inputs["Color1"].default_value = base.color("#A94732")
    brick.inputs["Color2"].default_value = base.color("#C35D41")
    brick.inputs["Mortar"].default_value = base.color("#CDBA9A")
    brick.inputs["Scale"].default_value = 7.0
    brick.inputs["Mortar Size"].default_value = 0.025
    brick.inputs["Mortar Smooth"].default_value = 0.012
    brick.inputs["Brick Width"].default_value = 0.56
    brick.inputs["Row Height"].default_value = 0.27
    links.new(coordinates.outputs["Generated"], separate.inputs[0])
    links.new(separate.outputs["X"], combine.inputs["X"])
    links.new(separate.outputs["Z"], combine.inputs["Y"])
    links.new(separate.outputs["Y"], combine.inputs["Z"])
    links.new(combine.outputs[0], brick.inputs["Vector"])
    links.new(brick.outputs["Color"], shader.inputs["Base Color"])
    base.add_bump(material, brick.outputs["Fac"], shader, strength=0.18, distance=0.016)
    material.diffuse_color = base.color("#B5523B")
    return material


def make_concrete():
    material, shader = base.new_material("MAT_CONCRETE", metallic=0.0, roughness=0.53, coat=0.04)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    coordinates = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 10.0
    noise.inputs["Detail"].default_value = 4.2
    noise.inputs["Roughness"].default_value = 0.7
    links.new(coordinates.outputs["Generated"], noise.inputs["Vector"])
    ramp = base.add_color_ramp(material, noise.outputs["Fac"], [(0.18, "#727678"), (0.52, "#989B9B"), (0.82, "#B7B8B5")])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    base.add_bump(material, noise.outputs["Fac"], shader, strength=0.15, distance=0.018)
    material.diffuse_color = base.color("#989B9B")
    return material


def prepare_materials():
    materials = {
        "MAT_WOOD": base.make_wood_body(),
        "MAT_WOOD_END_GRAIN": base.make_wood_endgrain(),
        "MAT_BRICK": make_brick(),
        "MAT_STONE": base.make_stone("MAT_STONE"),
        "MAT_STONE_CUT_FACE": base.make_stone("MAT_STONE_CUT_FACE", lightened=True),
        "MAT_CONCRETE": make_concrete(),
        "MAT_STEEL": base.make_metal("MAT_STEEL"),
        "MAT_RUBBER": base.make_rubber(),
        "MAT_PAINTED_STEEL_NAVY": base.make_painted_steel("MAT_PAINTED_STEEL_NAVY", base.PALETTE_HEX["painted_navy"], base.PALETTE_HEX["painted_navy_light"]),
        "MAT_PAINTED_STEEL_COBALT": base.make_painted_steel("MAT_PAINTED_STEEL_COBALT", base.PALETTE_HEX["structural_blue"], base.PALETTE_HEX["structural_blue_light"], roughness=0.25),
        "MAT_PAINTED_STEEL_ORANGE": base.make_painted_steel("MAT_PAINTED_STEEL_ORANGE", "#C9651D", base.PALETTE_HEX["warm_orange"], roughness=0.24),
        "MAT_PAINTED_STEEL_SUPPORT_YELLOW": base.make_painted_steel("MAT_PAINTED_STEEL_SUPPORT_YELLOW", "#A7791D", base.PALETTE_HEX["golden_yellow"], roughness=0.27),
    }
    diffuse = {
        "MAT_WOOD": "#B96E32",
        "MAT_WOOD_END_GRAIN": "#B66B30",
        "MAT_STONE": "#B3AFA5",
        "MAT_STONE_CUT_FACE": "#D1CCC0",
        "MAT_STEEL": "#7D8992",
        "MAT_RUBBER": "#18222B",
        "MAT_PAINTED_STEEL_NAVY": "#24364A",
        "MAT_PAINTED_STEEL_COBALT": "#1F78D1",
        "MAT_PAINTED_STEEL_ORANGE": "#F28A2E",
        "MAT_PAINTED_STEEL_SUPPORT_YELLOW": "#D9A73A",
    }
    for name, hex_color in diffuse.items():
        materials[name].diffuse_color = base.color(hex_color)
    for material in materials.values():
        material.use_fake_user = True
        try:
            material.asset_mark()
        except (AttributeError, RuntimeError):
            pass
    return materials


def set_materials(obj, materials, names, chooser=None):
    obj.data.materials.clear()
    for name in names:
        obj.data.materials.append(materials[name])
    for polygon in obj.data.polygons:
        polygon.material_index = chooser(polygon) if chooser else 0
    obj.data.update()


def apply_stabilizer_materials(obj, materials):
    names = ["MAT_PAINTED_STEEL_NAVY", "MAT_PAINTED_STEEL_COBALT", "MAT_PAINTED_STEEL_ORANGE", "MAT_STEEL", "MAT_PAINTED_STEEL_SUPPORT_YELLOW"]
    set_materials(obj, materials, names)
    for component in base.connected_polygon_components(obj):
        minimum, maximum = base.component_bounds(obj, component)
        dimensions = maximum - minimum
        center = (minimum + maximum) / 2.0
        if dimensions.y < 0.10 and center.y < -0.35:
            component_material = 3
        elif dimensions.x < 0.18 and dimensions.z > 0.60 and abs(center.x) < 0.85:
            component_material = 3
        elif dimensions.x < 0.31 and dimensions.z > 0.50 and abs(center.x) < 0.85:
            component_material = 2
        elif dimensions.x > 0.55 and dimensions.z > 0.80 and dimensions.z > dimensions.x:
            component_material = 1
        else:
            component_material = 0
        for polygon_index in component:
            polygon = obj.data.polygons[polygon_index]
            polygon.material_index = 4 if maximum.z < 0.22 and polygon.normal.z > 0.58 else component_material
    obj.data.update()


def apply_showcase_materials(objects, materials):
    set_materials(objects["B01_SMALL_BLOCK"], materials, ["MAT_WOOD", "MAT_WOOD_END_GRAIN"], lambda p: 1 if abs(p.normal.x) > 0.82 else 0)
    set_materials(objects["B02_MEDIUM_BLOCK"], materials, ["MAT_WOOD", "MAT_WOOD_END_GRAIN"], lambda p: 1 if abs(p.normal.x) > 0.82 else 0)
    set_materials(objects["B03_LONG_BEAM"], materials, ["MAT_PAINTED_STEEL_ORANGE", "MAT_STEEL"], lambda p: 1 if abs(p.normal.x) > 0.82 else 0)
    set_materials(objects["B04_TALL_BLOCK"], materials, ["MAT_BRICK"])
    set_materials(objects["B05_LARGE_BLOCK"], materials, ["MAT_CONCRETE"])
    set_materials(objects["S01_ROUND_COLUMN"], materials, ["MAT_STEEL", "MAT_PAINTED_STEEL_COBALT"], lambda p: 1 if abs(p.normal.z) > 0.82 else 0)
    set_materials(objects["S02_SHORT_COLUMN"], materials, ["MAT_CONCRETE"])
    set_materials(objects["S03_WIDE_FOOTING"], materials, ["MAT_STONE"])
    set_materials(objects["S04_WEDGE"], materials, ["MAT_STONE", "MAT_STONE_CUT_FACE"], lambda p: 1 if p.normal.z > 0.50 and abs(p.normal.x) > 0.12 else 0)
    set_materials(objects["S05_ARCH"], materials, ["MAT_BRICK"])
    set_materials(objects["A01_T_BLOCK"], materials, ["MAT_PAINTED_STEEL_NAVY", "MAT_PAINTED_STEEL_ORANGE"], lambda p: 1 if p.normal.z > 0.72 else 0)
    set_materials(objects["A02_L_BLOCK"], materials, ["MAT_PAINTED_STEEL_COBALT", "MAT_PAINTED_STEEL_SUPPORT_YELLOW"], lambda p: 1 if p.normal.z > 0.72 else 0)
    set_materials(objects["A03_CROSS_BEAM"], materials, ["MAT_STEEL", "MAT_PAINTED_STEEL_ORANGE"], lambda p: 1 if max(abs(p.center.x), abs(p.center.z)) > 1.28 else 0)
    set_materials(objects["A04_ROLLER"], materials, ["MAT_RUBBER", "MAT_STEEL"], lambda p: 1 if abs(p.normal.x) > 0.82 else 0)
    apply_stabilizer_materials(objects["A05_MECHANICAL_STABILIZER"], materials)


def export_variant(obj, destination: Path):
    original_location = obj.location.copy()
    original_rotation = obj.rotation_euler.copy()
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
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
    obj.rotation_euler = original_rotation


def setup_preview_scene():
    for obj in list(bpy.context.scene.objects):
        if obj.type in {"CAMERA", "LIGHT"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 25
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("V2_Material_Preview_World")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.035, 0.045, 0.06, 1.0)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.28

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "V1_Material_Preview_Camera"
    camera.data.type = "ORTHO"
    scene.camera = camera
    lights = []
    for name, energy, size in (("V1_Key", 1050.0, 5.0), ("V1_Fill", 560.0, 4.0), ("V1_Rim", 900.0, 3.0)):
        data = bpy.data.lights.new(name=name, type="AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        light = bpy.data.objects.new(name, data)
        light["v2_base_energy"] = energy
        bpy.context.collection.objects.link(light)
        lights.append(light)
    return camera, lights


def camera_direction(kind: str) -> Vector:
    return {
        "THREE_QUARTER": Vector((1.65, -2.15, 1.35)),
        "LOW_THREE_QUARTER": Vector((1.8, -2.4, 0.9)),
        "HIGH_THREE_QUARTER": Vector((1.7, -2.2, 1.85)),
        "FRONT": Vector((0.0, -3.4, 0.08)),
        "SIDE": Vector((3.4, 0.0, 0.08)),
    }[kind]


def render_preview(obj, view, destination: Path, all_meshes, camera, lights):
    original_location = obj.location.copy()
    original_rotation = obj.rotation_euler.copy()
    obj.location = (0, 0, 0)
    obj.rotation_euler = tuple(math.radians(value) for value in view["rotation"])
    bpy.context.view_layer.update()
    for other in all_meshes:
        other.hide_render = other != obj

    minimum, maximum = base.world_bounds(obj)
    center = (minimum + maximum) / 2.0
    extents = maximum - minimum
    extent = max(extents.x, extents.y, extents.z)
    if view["camera"] == "SIDE":
        frame_extent = max(extents.y, extents.z)
    elif view["camera"] == "FRONT":
        frame_extent = max(extents.x, extents.z)
    else:
        frame_extent = extent
    camera.data.ortho_scale = max(1.55, frame_extent * 1.58)
    direction = camera_direction(view["camera"])
    camera.location = center + direction.normalized() * extent * 3.4
    base.look_at(camera, center)
    positions = [
        center + Vector((extent * 2.4, -extent * 2.4, extent * 3.2)),
        center + Vector((-extent * 2.2, -extent * 1.0, extent * 1.6)),
        center + Vector((0.0, extent * 2.7, extent * 2.3)),
    ]
    for light, position in zip(lights, positions):
        light.location = position
        light.data.size = extent * 1.35
        light.data.energy = float(light["v2_base_energy"]) * (extent / 2.0) ** 2
        base.look_at(light, center)

    bpy.context.scene.render.filepath = str(destination)
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(str(destination), check_existing=False)
    pixels = image.pixels[:]
    alpha = pixels[3::4]
    result = {"filename": str(destination.relative_to(BLOCKS_DIR)).replace("\\", "/"), "view": view["name"], "size_pixels": [int(image.size[0]), int(image.size[1])], "alpha_range": [round(min(alpha), 6), round(max(alpha), 6)]}
    bpy.data.images.remove(image)
    if result["size_pixels"] != [512, 512] or result["alpha_range"] != [0.0, 1.0]:
        raise RuntimeError(f"Invalid preview: {destination}")
    obj.location = original_location
    obj.rotation_euler = original_rotation
    bpy.context.view_layer.update()
    return result


def main():
    MATERIALS_DIR.mkdir(parents=True, exist_ok=True)
    VARIANTS_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)
    VIEWS_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((BLOCKS_DIR / "block_asset_manifest.json").read_text(encoding="utf-8"))
    manifest_by_id = {piece["id"]: piece for piece in manifest["pieces"]}
    objects = {obj.name: obj for obj in bpy.context.scene.objects if obj.type == "MESH"}
    hashes_before = {piece_id: base.geometry_hash(objects[piece_id]) for piece_id in SHOWCASE_VARIANTS}
    materials = prepare_materials()
    apply_showcase_materials(objects, materials)

    variant_entries = []
    for piece_id, (variant_id, material_ids) in SHOWCASE_VARIANTS.items():
        obj = objects[piece_id]
        if base.geometry_hash(obj) != hashes_before[piece_id]:
            raise RuntimeError(f"Geometry changed while applying materials: {piece_id}")
        obj["showcase_variant_id"] = variant_id
        obj["material_families"] = ",".join(material_ids)
        destination = VARIANTS_DIR / f"{variant_id}.fbx"
        export_variant(obj, destination)
        variant_entries.append({
            "geometry_id": piece_id,
            "variant_id": variant_id,
            "materials": material_ids,
            "model_filename": str(destination.relative_to(BLOCKS_DIR)).replace("\\", "/"),
            "geometry_source_filename": manifest_by_id[piece_id]["model_filename"],
        })

    camera, lights = setup_preview_scene()
    all_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    preview_entries = []
    for piece_id in SHOWCASE_VARIANTS:
        obj = objects[piece_id]
        piece_previews = []
        for index, view in enumerate(VIEW_SPECS[piece_id]):
            destination = PREVIEWS_DIR / f"{piece_id}.png" if index == 0 else VIEWS_DIR / f'{piece_id}_{view["name"]}.png'
            piece_previews.append(render_preview(obj, view, destination, all_meshes, camera, lights))
        preview_entries.append({"geometry_id": piece_id, "primary_preview": piece_previews[0]["filename"], "previews": piece_previews})

    for piece_id, expected_hash in hashes_before.items():
        integrity = base.validate_geometry(objects[piece_id], manifest_by_id[piece_id], expected_hash)
        if not integrity["geometry_preserved"]:
            raise RuntimeError(f"Geometry integrity failed: {piece_id}")

    material_family_entries = [
        {"id": "MAT_WOOD", "family": "Wood", "character": "Warm honey wood with directional grain and end grain."},
        {"id": "MAT_BRICK", "family": "Brick", "character": "Clean terracotta masonry with simplified light mortar joints."},
        {"id": "MAT_STONE", "family": "Stone", "character": "Warm light stone with restrained tonal and surface variation."},
        {"id": "MAT_CONCRETE", "family": "Concrete", "character": "Neutral structural gray with fine clean aggregate variation."},
        {"id": "MAT_STEEL", "family": "Steel", "character": "Blue-gray metallic response with subtle clean variation."},
        {"id": "MAT_PAINTED_STEEL", "family": "Painted Steel", "character": "Reusable navy, cobalt, orange, and golden-yellow engineered coatings."},
        {"id": "MAT_RUBBER", "family": "Rubber", "character": "Dark navy-black soft finish with restrained fine texture."},
    ]
    material_manifest = {
        "library": "Impact Theory V2 Material Library",
        "version": 2,
        "architecture": "Geometry and material identity are separate. Every single-material family is compatible with every standardized geometry; mixed-material variants use multiple slots.",
        "physics_values": "Not defined in this art pass.",
        "families": material_family_entries,
        "showcase_variants": variant_entries,
    }
    (MATERIALS_DIR / "material_library_manifest_v2.json").write_text(json.dumps(material_manifest, indent=2) + "\n", encoding="utf-8")
    variant_manifest = {
        "library": "Impact Theory V2 Materialized Showcase Variants",
        "version": 2,
        "base_geometry_count": 15,
        "variant_count": len(variant_entries),
        "production_geometry_fbx_unchanged": True,
        "variants": variant_entries,
        "preview_render_count": sum(len(item["previews"]) for item in preview_entries),
        "preview_sets": preview_entries,
    }
    (VARIANTS_DIR / "material_variant_manifest_v2.json").write_text(json.dumps(variant_manifest, indent=2) + "\n", encoding="utf-8")
    report = {
        "status": "PASS",
        "geometry_preserved": True,
        "pieces_processed": len(variant_entries),
        "materialized_variant_fbx_count": len(variant_entries),
        "preview_render_count": variant_manifest["preview_render_count"],
        "checks": ["geometry hashes", "dimensions", "pivots", "512x512 RGBA transparency", "material/geometry separation"],
    }
    (VARIANTS_DIR / "material_pass_report_v2.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    bpy.ops.wm.save_as_mainfile(filepath=str(SCRIPT_DIR / "V2_BLOCK_LIBRARY_MATERIALIZED.blend"), compress=True)
    material_datablocks = set(materials.values())
    bpy.data.libraries.write(str(MATERIALS_DIR / "V2_MATERIAL_LIBRARY.blend"), material_datablocks, fake_user=True, compress=True)
    print(f"Created V2 materials for 15 pieces and rendered {variant_manifest['preview_render_count']} previews without overwriting V1.")


if __name__ == "__main__":
    main()
