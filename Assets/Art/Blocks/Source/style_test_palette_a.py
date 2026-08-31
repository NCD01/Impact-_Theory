"""Create the four-piece Palette A visual style test without changing geometry."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
BLOCKS_DIR = SCRIPT_DIR.parent
TEST_DIR = BLOCKS_DIR / "StyleTests" / "Palette_A"
TEST_IDS = ["B02_MEDIUM_BLOCK", "S04_WEDGE", "A04_ROLLER", "A05_MECHANICAL_STABILIZER"]

COLORS = {
    "cobalt_blue": (0.025, 0.22, 0.82, 1.0),
    "warm_orange": (1.0, 0.26, 0.025, 1.0),
    "signal_yellow": (1.0, 0.72, 0.025, 1.0),
    "navy": (0.025, 0.075, 0.18, 1.0),
    "steel_blue": (0.12, 0.34, 0.49, 1.0),
    "dark_teal": (0.0, 0.32, 0.34, 1.0),
    "cream": (0.93, 0.89, 0.76, 1.0),
    "graphite": (0.035, 0.045, 0.065, 1.0),
    "metal_gray": (0.19, 0.22, 0.27, 1.0),
    "electric_green": (0.16, 1.0, 0.27, 1.0),
    "fuchsia": (1.0, 0.025, 0.47, 1.0),
}


def geometry_hash(obj: bpy.types.Object) -> str:
    payload = {
        "vertices": [[round(v.co.x, 7), round(v.co.y, 7), round(v.co.z, 7)] for v in obj.data.vertices],
        "edges": [[int(i) for i in edge.vertices] for edge in obj.data.edges],
        "polygons": [[int(i) for i in polygon.vertices] for polygon in obj.data.polygons],
    }
    return hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode("utf-8")).hexdigest()


def set_input(shader, input_name: str, value) -> None:
    socket = shader.inputs.get(input_name)
    if socket is not None:
        socket.default_value = value


def make_molded_material(
    name: str,
    base_color: tuple[float, float, float, float],
    *,
    metallic: float = 0.04,
    roughness: float = 0.23,
    band_color: tuple[float, float, float, float] | None = None,
    band_axis: str = "X",
    band_min: float = 0.45,
    band_max: float = 0.55,
):
    material = bpy.data.materials.new(name)
    material.diffuse_color = base_color
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = nodes.get("Principled BSDF")
    set_input(shader, "Base Color", base_color)
    set_input(shader, "Metallic", metallic)
    set_input(shader, "Roughness", roughness)
    set_input(shader, "Coat Weight", 0.32)
    set_input(shader, "Coat Roughness", 0.16)

    if band_color is not None:
        coordinates = nodes.new("ShaderNodeTexCoord")
        coordinates.name = f"{band_axis}_Band_Coordinates"
        separate = nodes.new("ShaderNodeSeparateXYZ")
        greater = nodes.new("ShaderNodeMath")
        greater.operation = "GREATER_THAN"
        greater.inputs[1].default_value = band_min
        less = nodes.new("ShaderNodeMath")
        less.operation = "LESS_THAN"
        less.inputs[1].default_value = band_max
        multiply = nodes.new("ShaderNodeMath")
        multiply.operation = "MULTIPLY"
        mix = nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MIX"
        mix.inputs[1].default_value = base_color
        mix.inputs[2].default_value = band_color
        links.new(coordinates.outputs["Generated"], separate.inputs[0])
        links.new(separate.outputs[band_axis], greater.inputs[0])
        links.new(separate.outputs[band_axis], less.inputs[0])
        links.new(greater.outputs[0], multiply.inputs[0])
        links.new(less.outputs[0], multiply.inputs[1])
        links.new(multiply.outputs[0], mix.inputs[0])
        links.new(mix.outputs[0], shader.inputs["Base Color"])
    return material


def assign_materials(obj: bpy.types.Object, materials: list, chooser) -> None:
    obj.data.materials.clear()
    for material in materials:
        obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = chooser(polygon)
    obj.data.update()


def style_basic(obj: bpy.types.Object) -> dict:
    cobalt = make_molded_material(
        "TEST_BASIC_Cobalt_Molded",
        COLORS["cobalt_blue"],
        band_color=COLORS["signal_yellow"],
        band_axis="X",
        band_min=0.46,
        band_max=0.54,
    )
    orange = make_molded_material("TEST_BASIC_Warm_Orange_Endcaps", COLORS["warm_orange"], roughness=0.2)
    assign_materials(obj, [cobalt, orange], lambda polygon: 1 if abs(polygon.normal.x) > 0.86 else 0)
    return {
        "body": "cobalt blue semi-gloss molded finish",
        "detail": "warm-orange end caps with a narrow signal-yellow center band",
    }


def style_wedge(obj: bpy.types.Object) -> dict:
    navy = make_molded_material("TEST_SUPPORT_Navy_Molded", COLORS["navy"], roughness=0.26)
    steel = make_molded_material("TEST_SUPPORT_Steel_Blue_Sides", COLORS["steel_blue"], roughness=0.25)
    slope = make_molded_material(
        "TEST_SUPPORT_Cream_Slope",
        COLORS["cream"],
        roughness=0.3,
        band_color=COLORS["dark_teal"],
        band_axis="X",
        band_min=0.72,
        band_max=0.82,
    )

    def choose(polygon):
        normal = polygon.normal
        if normal.z > 0.52 and abs(normal.x) > 0.12:
            return 2
        if abs(normal.y) > 0.76:
            return 1
        return 0

    assign_materials(obj, [navy, steel, slope], choose)
    return {
        "body": "navy and steel-blue technical molded finish",
        "detail": "cream slope face with a dark-teal directional band",
    }


def style_roller(obj: bpy.types.Object) -> dict:
    body = make_molded_material(
        "TEST_ADVANCED_Graphite_Roller",
        COLORS["graphite"],
        metallic=0.34,
        roughness=0.2,
        band_color=COLORS["electric_green"],
        band_axis="X",
        band_min=0.42,
        band_max=0.58,
    )
    endcaps = make_molded_material("TEST_ADVANCED_Fuchsia_Endcaps", COLORS["fuchsia"], metallic=0.12, roughness=0.19)
    assign_materials(obj, [body, endcaps], lambda polygon: 1 if abs(polygon.normal.x) > 0.82 else 0)
    return {
        "body": "semi-metallic graphite molded finish",
        "detail": "electric-green mobility band and high-readability fuchsia end caps",
    }


def style_stabilizer(obj: bpy.types.Object) -> dict:
    original_accent_indices = {
        index for index, slot in enumerate(obj.material_slots) if slot.material and "Accent" in slot.material.name
    }
    body = make_molded_material(
        "TEST_STABILIZER_Graphite_Frame",
        COLORS["graphite"],
        metallic=0.46,
        roughness=0.19,
        band_color=COLORS["electric_green"],
        band_axis="X",
        band_min=0.475,
        band_max=0.525,
    )
    technical = make_molded_material("TEST_STABILIZER_Electric_Green_Technical", COLORS["electric_green"], metallic=0.28, roughness=0.17)
    bolt = make_molded_material("TEST_STABILIZER_Fuchsia_Bolts", COLORS["fuchsia"], metallic=0.2, roughness=0.17)
    pad = make_molded_material("TEST_STABILIZER_Cream_Support_Pads", COLORS["cream"], metallic=0.08, roughness=0.27)

    original_indices = [polygon.material_index for polygon in obj.data.polygons]
    obj.data.materials.clear()
    for material in (body, technical, bolt, pad):
        obj.data.materials.append(material)
    for polygon, original_index in zip(obj.data.polygons, original_indices):
        center = polygon.center
        normal = polygon.normal
        if original_index in original_accent_indices:
            polygon.material_index = 2 if normal.y < -0.72 and center.y < -0.40 else 1
        elif normal.z > 0.75 and center.z < 0.24:
            polygon.material_index = 3
        else:
            polygon.material_index = 0
    obj.data.update()
    return {
        "body": "dark graphite semi-metallic structural frame",
        "detail": "electric-green pistons, fuchsia bolt faces, cream support pads, and a narrow header signal band",
    }


def local_bounds(obj: bpy.types.Object):
    points = [vertex.co for vertex in obj.data.vertices]
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_render_scene():
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
    scene.render.film_transparent = True
    scene.render.image_settings.compression = 25
    scene.view_settings.look = "AgX - Medium High Contrast"

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "Style_Test_Camera"
    camera.data.type = "ORTHO"
    scene.camera = camera

    lights = []
    light_specs = [
        ("Style_Key", 980.0, 5.0),
        ("Style_Fill", 600.0, 4.0),
        ("Style_Rim", 840.0, 3.0),
    ]
    for name, energy, size in light_specs:
        light_data = bpy.data.lights.new(name=name, type="AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        bpy.context.collection.objects.link(light)
        lights.append(light)
    return camera, lights


def render_preview(obj: bpy.types.Object, all_meshes: list[bpy.types.Object], camera, lights) -> dict:
    original_location = obj.location.copy()
    obj.location = (0.0, 0.0, 0.0)
    for other in all_meshes:
        other.hide_render = other != obj

    minimum, maximum = local_bounds(obj)
    center = (minimum + maximum) / 2.0
    extent = max(maximum.x - minimum.x, maximum.z - minimum.z, maximum.y - minimum.y)
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

    destination = TEST_DIR / f"{obj.name}_STYLE_TEST_A.png"
    bpy.context.scene.render.filepath = str(destination)
    bpy.ops.render.render(write_still=True)
    image = bpy.data.images.load(str(destination), check_existing=False)
    pixels = image.pixels[:]
    alpha = pixels[3::4]
    result = {
        "preview": destination.name,
        "size_pixels": [int(image.size[0]), int(image.size[1])],
        "alpha_range": [round(min(alpha), 6), round(max(alpha), 6)],
    }
    bpy.data.images.remove(image)
    obj.location = original_location
    return result


def rgba_to_hex(rgba) -> str:
    return "#" + "".join(f"{round(channel * 255):02X}" for channel in rgba[:3])


def main() -> None:
    TEST_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((BLOCKS_DIR / "block_asset_manifest.json").read_text(encoding="utf-8"))
    manifest_by_id = {piece["id"]: piece for piece in manifest["pieces"]}
    objects_by_id = {obj.name: obj for obj in bpy.context.scene.objects if obj.type == "MESH"}
    selected = [objects_by_id[piece_id] for piece_id in TEST_IDS]
    geometry_before = {obj.name: geometry_hash(obj) for obj in selected}

    treatments = {
        "B02_MEDIUM_BLOCK": style_basic(objects_by_id["B02_MEDIUM_BLOCK"]),
        "S04_WEDGE": style_wedge(objects_by_id["S04_WEDGE"]),
        "A04_ROLLER": style_roller(objects_by_id["A04_ROLLER"]),
        "A05_MECHANICAL_STABILIZER": style_stabilizer(objects_by_id["A05_MECHANICAL_STABILIZER"]),
    }

    camera, lights = setup_render_scene()
    all_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    results = []
    for obj in selected:
        piece = manifest_by_id[obj.name]
        geometry_after = geometry_hash(obj)
        if geometry_after != geometry_before[obj.name]:
            raise RuntimeError(f"Geometry changed during style test: {obj.name}")
        minimum, maximum = local_bounds(obj)
        dimensions = {
            "width": round(maximum.x - minimum.x, 6),
            "height": round(maximum.z - minimum.z, 6),
            "depth": round(maximum.y - minimum.y, 6),
        }
        expected = {key: float(piece[key]) for key in ("width", "height", "depth")}
        if dimensions != expected:
            raise RuntimeError(f"Dimensions changed during style test: {obj.name}")
        if piece["pivot"] == "center-bottom":
            pivot_error = max(abs(minimum.z), abs((minimum.x + maximum.x) / 2.0), abs((minimum.y + maximum.y) / 2.0))
        else:
            pivot_error = ((minimum + maximum) / 2.0).length
        if pivot_error > 0.001:
            raise RuntimeError(f"Pivot changed during style test: {obj.name}")
        preview = render_preview(obj, all_meshes, camera, lights)
        if preview["size_pixels"] != [512, 512] or preview["alpha_range"][0] > 0.001 or preview["alpha_range"][1] < 0.999:
            raise RuntimeError(f"Invalid preview output: {obj.name}")
        results.append({
            "id": obj.name,
            "category": piece["category"],
            "geometry_preserved": True,
            "dimensions_su": dimensions,
            "pivot": piece["pivot"],
            "pivot_error_su": round(pivot_error, 8),
            "treatment": treatments[obj.name],
            **preview,
        })

    report = {
        "test_name": "Impact Theory V1 Palette A",
        "status": "AWAITING_APPROVAL",
        "scope": "Four-piece visual style test only; production FBX assets are unchanged.",
        "material_language": "Semi-gloss premium molded construction toy with controlled category palettes.",
        "palette": {name: rgba_to_hex(value) for name, value in COLORS.items()},
        "pieces": results,
    }
    (TEST_DIR / "style_test_report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(TEST_DIR / "V1_STYLE_TEST_PALETTE_A.blend"), compress=True)
    print("Created Palette A style test for four pieces; production assets unchanged.")


if __name__ == "__main__":
    main()
