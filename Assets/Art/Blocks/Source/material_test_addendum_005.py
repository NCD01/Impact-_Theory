"""Create the Addendum 005 four-piece material approval pack.

The script changes materials and preview transforms only. Production FBX files,
mesh vertices, topology, dimensions, and pivots remain unchanged.
"""

from __future__ import annotations

import hashlib
import json
import math
from collections import defaultdict, deque
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
BLOCKS_DIR = SCRIPT_DIR.parent
TEST_DIR = BLOCKS_DIR / "StyleTests" / "Material_System_005"
TEST_IDS = ["B02_MEDIUM_BLOCK", "S04_WEDGE", "A04_ROLLER", "A05_MECHANICAL_STABILIZER"]

PALETTE_HEX = {
    "wood_dark": "#5A321C",
    "wood_honey": "#B96E32",
    "wood_light": "#D9A05A",
    "stone_dark": "#87847D",
    "stone_mid": "#B3AFA5",
    "stone_light": "#D1CCC0",
    "rubber_dark": "#101820",
    "rubber_light": "#25313B",
    "deep_teal": "#168A91",
    "steel_dark": "#4E5B66",
    "steel_light": "#B2BAC0",
    "painted_navy": "#24364A",
    "painted_navy_light": "#2E4057",
    "structural_blue": "#1F78D1",
    "structural_blue_light": "#2D8CFF",
    "warm_orange": "#F28A2E",
    "golden_yellow": "#D9A73A",
}

VIEW_SPECS = {
    "B02_MEDIUM_BLOCK": [
        {"name": "STANDARD_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "UPRIGHT", "rotation": (0, -90, 0), "camera": "THREE_QUARTER"},
        {"name": "SIDEWAYS", "rotation": (0, 0, 0), "camera": "FRONT"},
    ],
    "S04_WEDGE": [
        {"name": "SLOPE_PERSPECTIVE", "rotation": (0, 0, 0), "camera": "THREE_QUARTER"},
        {"name": "OPPOSITE_SIDE", "rotation": (0, 0, 180), "camera": "THREE_QUARTER"},
        {"name": "SIDE_PROFILE", "rotation": (0, 0, 0), "camera": "FRONT"},
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


def srgb_channel_to_linear(value: float) -> float:
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def color(hex_color: str) -> tuple[float, float, float, float]:
    value = hex_color.lstrip("#")
    srgb = [int(value[index:index + 2], 16) / 255.0 for index in (0, 2, 4)]
    return tuple(srgb_channel_to_linear(channel) for channel in srgb) + (1.0,)


def geometry_hash(obj: bpy.types.Object) -> str:
    payload = {
        "vertices": [[round(v.co.x, 7), round(v.co.y, 7), round(v.co.z, 7)] for v in obj.data.vertices],
        "edges": [[int(i) for i in edge.vertices] for edge in obj.data.edges],
        "polygons": [[int(i) for i in polygon.vertices] for polygon in obj.data.polygons],
    }
    return hashlib.sha256(json.dumps(payload, separators=(",", ":")).encode("utf-8")).hexdigest()


def set_shader_input(shader, name: str, value) -> None:
    socket = shader.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def new_material(name: str, metallic: float, roughness: float, coat: float = 0.16):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    set_shader_input(shader, "Metallic", metallic)
    set_shader_input(shader, "Roughness", roughness)
    set_shader_input(shader, "Coat Weight", coat)
    set_shader_input(shader, "Coat Roughness", min(0.28, roughness))
    return material, shader


def add_color_ramp(material, source_socket, stops):
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements.remove(ramp.color_ramp.elements[1])
    first = ramp.color_ramp.elements[0]
    first.position = stops[0][0]
    first.color = color(stops[0][1])
    for position, hex_color in stops[1:]:
        element = ramp.color_ramp.elements.new(position)
        element.color = color(hex_color)
    links.new(source_socket, ramp.inputs[0])
    return ramp


def add_bump(material, source_socket, shader, strength: float, distance: float):
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    links.new(source_socket, bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])


def make_wood_body():
    material, shader = new_material("MAT_WOOD", metallic=0.0, roughness=0.31, coat=0.22)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    coordinates = nodes.new("ShaderNodeTexCoord")
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (0.7, 5.0, 5.0)
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.7
    noise.inputs["Detail"].default_value = 4.0
    noise.inputs["Roughness"].default_value = 0.62
    noise.inputs["Distortion"].default_value = 0.28
    links.new(coordinates.outputs["Generated"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    ramp = add_color_ramp(material, noise.outputs["Fac"], [(0.22, PALETTE_HEX["wood_dark"]), (0.50, PALETTE_HEX["wood_honey"]), (0.78, PALETTE_HEX["wood_light"])])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    add_bump(material, noise.outputs["Fac"], shader, strength=0.13, distance=0.018)
    return material


def make_wood_endgrain():
    material, shader = new_material("MAT_WOOD_END_GRAIN", metallic=0.0, roughness=0.33, coat=0.2)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    coordinates = nodes.new("ShaderNodeTexCoord")
    wave = nodes.new("ShaderNodeTexWave")
    wave.wave_type = "RINGS"
    wave.rings_direction = "X"
    wave.inputs["Scale"].default_value = 4.5
    wave.inputs["Distortion"].default_value = 2.4
    wave.inputs["Detail"].default_value = 3.0
    wave.inputs["Detail Scale"].default_value = 1.7
    links.new(coordinates.outputs["Generated"], wave.inputs["Vector"])
    ramp = add_color_ramp(material, wave.outputs["Fac"], [(0.24, "#7D451F"), (0.52, "#B66B30"), (0.76, "#D39A53")])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    add_bump(material, wave.outputs["Fac"], shader, strength=0.1, distance=0.014)
    return material


def make_stone(name: str, lightened: bool = False):
    material, shader = new_material(name, metallic=0.0, roughness=0.49 if not lightened else 0.44, coat=0.06)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    coordinates = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 5.5 if not lightened else 7.0
    noise.inputs["Detail"].default_value = 4.0
    noise.inputs["Roughness"].default_value = 0.68
    links.new(coordinates.outputs["Generated"], noise.inputs["Vector"])
    stops = (
        [(0.20, PALETTE_HEX["stone_dark"]), (0.52, PALETTE_HEX["stone_mid"]), (0.80, PALETTE_HEX["stone_light"])]
        if not lightened else
        [(0.18, PALETTE_HEX["stone_mid"]), (0.50, PALETTE_HEX["stone_light"]), (0.82, "#E1DDD4")]
    )
    ramp = add_color_ramp(material, noise.outputs["Fac"], stops)
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    add_bump(material, noise.outputs["Fac"], shader, strength=0.16, distance=0.022)
    return material


def make_rubber():
    material, shader = new_material("MAT_RUBBER", metallic=0.0, roughness=0.57, coat=0.04)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    coordinates = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 19.0
    noise.inputs["Detail"].default_value = 2.2
    noise.inputs["Roughness"].default_value = 0.55
    links.new(coordinates.outputs["Generated"], noise.inputs["Vector"])
    rubber_ramp = add_color_ramp(material, noise.outputs["Fac"], [(0.22, PALETTE_HEX["rubber_dark"]), (0.78, PALETTE_HEX["rubber_light"])])

    separate = nodes.new("ShaderNodeSeparateXYZ")
    greater = nodes.new("ShaderNodeMath")
    greater.operation = "GREATER_THAN"
    greater.inputs[1].default_value = 0.43
    less = nodes.new("ShaderNodeMath")
    less.operation = "LESS_THAN"
    less.inputs[1].default_value = 0.57
    mask = nodes.new("ShaderNodeMath")
    mask.operation = "MULTIPLY"
    mix = nodes.new("ShaderNodeMixRGB")
    mix.inputs[2].default_value = color(PALETTE_HEX["deep_teal"])
    links.new(coordinates.outputs["Generated"], separate.inputs[0])
    links.new(separate.outputs["X"], greater.inputs[0])
    links.new(separate.outputs["X"], less.inputs[0])
    links.new(greater.outputs[0], mask.inputs[0])
    links.new(less.outputs[0], mask.inputs[1])
    links.new(mask.outputs[0], mix.inputs[0])
    links.new(rubber_ramp.outputs["Color"], mix.inputs[1])
    links.new(mix.outputs[0], shader.inputs["Base Color"])
    add_bump(material, noise.outputs["Fac"], shader, strength=0.11, distance=0.012)
    return material


def make_metal(name: str = "MAT_STEEL"):
    material, shader = new_material(name, metallic=0.82, roughness=0.24, coat=0.06)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    coordinates = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 5.0
    noise.inputs["Detail"].default_value = 2.0
    noise.inputs["Roughness"].default_value = 0.42
    links.new(coordinates.outputs["Generated"], noise.inputs["Vector"])
    ramp = add_color_ramp(material, noise.outputs["Fac"], [(0.18, PALETTE_HEX["steel_dark"]), (0.52, "#7D8992"), (0.82, PALETTE_HEX["steel_light"])])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    add_bump(material, noise.outputs["Fac"], shader, strength=0.055, distance=0.009)
    return material


def make_painted_steel(name: str, dark_hex: str, light_hex: str, roughness: float = 0.28):
    material, shader = new_material(name, metallic=0.34, roughness=roughness, coat=0.24)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    coordinates = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 7.0
    noise.inputs["Detail"].default_value = 2.2
    noise.inputs["Roughness"].default_value = 0.48
    links.new(coordinates.outputs["Generated"], noise.inputs["Vector"])
    ramp = add_color_ramp(material, noise.outputs["Fac"], [(0.18, dark_hex), (0.82, light_hex)])
    links.new(ramp.outputs["Color"], shader.inputs["Base Color"])
    add_bump(material, noise.outputs["Fac"], shader, strength=0.045, distance=0.008)
    return material


def assign_materials(obj: bpy.types.Object, materials: list, chooser) -> None:
    obj.data.materials.clear()
    for material in materials:
        obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.material_index = chooser(polygon)
    obj.data.update()


def style_medium_block(obj: bpy.types.Object) -> dict:
    wood = make_wood_body()
    endgrain = make_wood_endgrain()
    assign_materials(obj, [wood, endgrain], lambda polygon: 1 if abs(polygon.normal.x) > 0.82 else 0)
    return {"geometry": obj.name, "material_family": "MAT_WOOD", "treatment": "Honey-toned wood with restrained directional grain, end grain, subtle bump, and a polished game-art finish."}


def style_wedge(obj: bpy.types.Object) -> dict:
    stone = make_stone("MAT_STONE_CONCRETE")
    cut_face = make_stone("MAT_STONE_CONCRETE_CUT_FACE", lightened=True)
    assign_materials(obj, [stone, cut_face], lambda polygon: 1 if polygon.normal.z > 0.50 and abs(polygon.normal.x) > 0.12 else 0)
    return {"geometry": obj.name, "material_family": "MAT_STONE_CONCRETE", "treatment": "Warm light stone/concrete with clean tonal variation, fine surface character, and a lighter cut slope face for orientation."}


def style_roller(obj: bpy.types.Object) -> dict:
    rubber = make_rubber()
    steel = make_metal("MAT_STEEL_ROLLER_HUB")
    assign_materials(obj, [rubber, steel], lambda polygon: 1 if abs(polygon.normal.x) > 0.82 else 0)
    return {"geometry": obj.name, "material_family": "MAT_RUBBER + MAT_STEEL", "treatment": "Dark textured rubber body, restrained teal traction band, and metallic steel end caps."}


def connected_polygon_components(obj: bpy.types.Object):
    vertex_to_polygons = defaultdict(list)
    for polygon in obj.data.polygons:
        for vertex_index in polygon.vertices:
            vertex_to_polygons[vertex_index].append(polygon.index)
    adjacency = defaultdict(set)
    for polygon_indices in vertex_to_polygons.values():
        for polygon_index in polygon_indices:
            adjacency[polygon_index].update(polygon_indices)

    remaining = set(range(len(obj.data.polygons)))
    components = []
    while remaining:
        start = remaining.pop()
        queue = deque([start])
        component = {start}
        while queue:
            current = queue.popleft()
            for neighbor in adjacency[current]:
                if neighbor in remaining:
                    remaining.remove(neighbor)
                    component.add(neighbor)
                    queue.append(neighbor)
        components.append(component)
    return components


def component_bounds(obj: bpy.types.Object, polygon_indices: set[int]):
    vertex_indices = {vertex for polygon_index in polygon_indices for vertex in obj.data.polygons[polygon_index].vertices}
    points = [obj.data.vertices[index].co for index in vertex_indices]
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return minimum, maximum


def style_stabilizer(obj: bpy.types.Object) -> dict:
    body = make_painted_steel("MAT_PAINTED_STEEL_NAVY", PALETTE_HEX["painted_navy"], PALETTE_HEX["painted_navy_light"])
    braces = make_painted_steel("MAT_PAINTED_STEEL_COBALT", PALETTE_HEX["structural_blue"], PALETTE_HEX["structural_blue_light"], roughness=0.25)
    mechanical = make_painted_steel("MAT_PAINTED_STEEL_ORANGE", "#C9651D", PALETTE_HEX["warm_orange"], roughness=0.24)
    hardware = make_metal("MAT_STEEL_HARDWARE")
    support = make_painted_steel("MAT_PAINTED_STEEL_SUPPORT_YELLOW", "#A7791D", PALETTE_HEX["golden_yellow"], roughness=0.27)
    materials = [body, braces, mechanical, hardware, support]
    obj.data.materials.clear()
    for material in materials:
        obj.data.materials.append(material)

    for component in connected_polygon_components(obj):
        minimum, maximum = component_bounds(obj, component)
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
            if maximum.z < 0.22 and polygon.normal.z > 0.58:
                polygon.material_index = 4
            else:
                polygon.material_index = component_material
    obj.data.update()
    return {
        "geometry": obj.name,
        "material_family": "MAT_PAINTED_STEEL + MAT_STEEL_HARDWARE",
        "treatment": "Dark navy painted-steel frame, cobalt braces, warm-orange piston bodies, bare-steel rods and hardware, and golden support pads.",
    }


def local_bounds(obj: bpy.types.Object):
    points = [vertex.co for vertex in obj.data.vertices]
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return minimum, maximum


def world_bounds(obj: bpy.types.Object):
    points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
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
    scene.render.image_settings.compression = 25
    scene.render.film_transparent = True
    scene.view_settings.look = "AgX - Medium High Contrast"

    bpy.ops.object.camera_add()
    camera = bpy.context.object
    camera.name = "Material_Test_Camera"
    camera.data.type = "ORTHO"
    scene.camera = camera

    lights = []
    for name, energy, size in (("Material_Key", 1050.0, 5.0), ("Material_Fill", 540.0, 4.0), ("Material_Rim", 900.0, 3.0)):
        light_data = bpy.data.lights.new(name=name, type="AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new(name, light_data)
        bpy.context.collection.objects.link(light)
        lights.append(light)
    return camera, lights


def camera_direction(camera_kind: str) -> Vector:
    return {
        "THREE_QUARTER": Vector((1.65, -2.15, 1.35)),
        "LOW_THREE_QUARTER": Vector((1.8, -2.4, 0.9)),
        "HIGH_THREE_QUARTER": Vector((1.7, -2.2, 1.85)),
        "FRONT": Vector((0.0, -3.4, 0.08)),
        "SIDE": Vector((3.4, 0.0, 0.08)),
    }[camera_kind]


def render_view(obj: bpy.types.Object, view: dict, all_meshes: list[bpy.types.Object], camera, lights) -> dict:
    original_location = obj.location.copy()
    original_rotation = obj.rotation_euler.copy()
    obj.location = (0.0, 0.0, 0.0)
    obj.rotation_euler = tuple(math.radians(value) for value in view["rotation"])
    bpy.context.view_layer.update()
    for other in all_meshes:
        other.hide_render = other != obj

    minimum, maximum = world_bounds(obj)
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
    look_at(camera, center)

    light_positions = [
        center + Vector((extent * 2.4, -extent * 2.4, extent * 3.2)),
        center + Vector((-extent * 2.2, -extent * 1.0, extent * 1.6)),
        center + Vector((0.0, extent * 2.7, extent * 2.3)),
    ]
    for light, position in zip(lights, light_positions):
        light.location = position
        light.data.size = extent * 1.35
        look_at(light, center)

    destination = TEST_DIR / f'{obj.name}_{view["name"]}.png'
    bpy.context.scene.render.filepath = str(destination)
    bpy.ops.render.render(write_still=True)

    image = bpy.data.images.load(str(destination), check_existing=False)
    pixels = image.pixels[:]
    alpha = pixels[3::4]
    validation = {
        "filename": destination.name,
        "view": view["name"],
        "size_pixels": [int(image.size[0]), int(image.size[1])],
        "alpha_range": [round(min(alpha), 6), round(max(alpha), 6)],
    }
    bpy.data.images.remove(image)
    if validation["size_pixels"] != [512, 512] or validation["alpha_range"][0] > 0.001 or validation["alpha_range"][1] < 0.999:
        raise RuntimeError(f"Invalid preview: {destination.name}")

    obj.location = original_location
    obj.rotation_euler = original_rotation
    bpy.context.view_layer.update()
    return validation


def validate_geometry(obj: bpy.types.Object, piece: dict, original_hash: str) -> dict:
    if geometry_hash(obj) != original_hash:
        raise RuntimeError(f"Geometry changed: {obj.name}")
    minimum, maximum = local_bounds(obj)
    dimensions = {
        "width": round(maximum.x - minimum.x, 6),
        "height": round(maximum.z - minimum.z, 6),
        "depth": round(maximum.y - minimum.y, 6),
    }
    expected = {key: float(piece[key]) for key in ("width", "height", "depth")}
    if dimensions != expected:
        raise RuntimeError(f"Dimensions changed: {obj.name} ({dimensions} != {expected})")
    if piece["pivot"] == "center-bottom":
        pivot_error = max(abs(minimum.z), abs((minimum.x + maximum.x) / 2.0), abs((minimum.y + maximum.y) / 2.0))
    else:
        pivot_error = ((minimum + maximum) / 2.0).length
    if pivot_error > 0.001:
        raise RuntimeError(f"Pivot changed: {obj.name}")
    return {"geometry_preserved": True, "dimensions_su": dimensions, "pivot": piece["pivot"], "pivot_error_su": round(pivot_error, 8)}


def main() -> None:
    TEST_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((BLOCKS_DIR / "block_asset_manifest.json").read_text(encoding="utf-8"))
    manifest_by_id = {piece["id"]: piece for piece in manifest["pieces"]}
    objects_by_id = {obj.name: obj for obj in bpy.context.scene.objects if obj.type == "MESH"}
    selected = [objects_by_id[piece_id] for piece_id in TEST_IDS]
    hashes_before = {obj.name: geometry_hash(obj) for obj in selected}

    material_assignments = {
        "B02_MEDIUM_BLOCK": style_medium_block(objects_by_id["B02_MEDIUM_BLOCK"]),
        "S04_WEDGE": style_wedge(objects_by_id["S04_WEDGE"]),
        "A04_ROLLER": style_roller(objects_by_id["A04_ROLLER"]),
        "A05_MECHANICAL_STABILIZER": style_stabilizer(objects_by_id["A05_MECHANICAL_STABILIZER"]),
    }

    camera, lights = setup_render_scene()
    all_meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    results = []
    for obj in selected:
        integrity = validate_geometry(obj, manifest_by_id[obj.name], hashes_before[obj.name])
        previews = [render_view(obj, view, all_meshes, camera, lights) for view in VIEW_SPECS[obj.name]]
        results.append({
            "id": obj.name,
            **material_assignments[obj.name],
            **integrity,
            "preview_count": len(previews),
            "previews": previews,
        })

    report = {
        "test_name": "Impact Theory Material System – Addendum 005",
        "status": "AWAITING_APPROVAL",
        "scope": "Four-piece material and multi-view approval pack only; production FBX assets and remaining 11 pieces are unchanged.",
        "architecture": "Geometry identity and material identity remain separate. Materials are reusable MAT_* assets in the test Blender file.",
        "palette_hex_srgb": PALETTE_HEX,
        "preview_count": sum(result["preview_count"] for result in results),
        "pieces": results,
    }
    (TEST_DIR / "material_test_report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(TEST_DIR / "MATERIAL_SYSTEM_005_TEST.blend"), compress=True)
    print(f'Created {report["preview_count"]} validated approval previews; production assets unchanged.')


if __name__ == "__main__":
    main()
