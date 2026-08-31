# Archive: the Unity checkpoint

## What this is

`_source/unity-checkpoint/` holds the Unity project files that were in the master
folder when this build started. They are kept, not deleted, and they are not part of
the running game. Impact Theory is a Three.js project. Nothing in this folder is
imported, built, linted or tested by the live code.

## What is in it

| Contents | Count |
|---|---|
| C# scripts under `Assets/Scripts` and `Assets/Tests` | 61 |
| Unity `.meta` sidecars | 257 |
| Assembly definitions (`.asmdef`) | 9 |
| Unity scene (`Assets/Scenes/Gameplay.unity`) | 1 |
| ShaderLab shaders under `Assets/Resources/Shaders` | 2 |
| WebGL template `index.html` and its CSS | 1 template |
| Background PNGs under `Assets/Resources/Backgrounds` | 2 |

The two background PNGs are named `NCD_RetroArcade_Background_v1.png` and `v2.png`.
They belong to a different project of the owner's and are not used here. They were
moved with everything else rather than deleted.

## Where the same code lives under version control

The C# in this folder is a checkpoint copy. The maintained original is the separate
live project at `H:\Marcelo\Programming\Games\IT`, whose git remote is
`https://github.com/NCD01/Impact-Theory.git`, the form **without** the underscore.
That repository was at `v0.14` when this was written.

Note that the brief for this build referred to that project as `Games\Impact`. No such
folder exists. The folder is called `IT`. See `docs/DECISIONS.md`, decision D-001.

## What moved, and what did not

Moved into `_source/unity-checkpoint/Assets/`, all with `git mv` so that history
follows the files:

`Scripts`, `Tests`, `Scenes`, `WebGLTemplates`, `Resources`, `Generated`,
`Materials`, `Physics`, plus every `.meta` and `.asmdef` file that was under `Assets`.

Left in place, because they are this build's asset home:

`Assets/Art`, `Assets/Audio`, `Assets/Data`, `Assets/Reference`.

`Generated`, `Materials` and `Physics` were not named in the brief. They were moved
because each contained nothing but a `.gitkeep` and each is a Unity folder convention
with no meaning to a Three.js build. `Resources` was moved because Unity treats that
folder name specially and its contents are two ShaderLab shaders and another
project's art.

## How to move it back

From the repository root:

    git mv _source/unity-checkpoint/Assets/Scripts Assets/Scripts
    git mv _source/unity-checkpoint/Assets/Tests Assets/Tests
    git mv _source/unity-checkpoint/Assets/Scenes Assets/Scenes
    git mv _source/unity-checkpoint/Assets/WebGLTemplates Assets/WebGLTemplates
    git mv _source/unity-checkpoint/Assets/Resources Assets/Resources

and then move the `.meta` and `.asmdef` files back to the matching paths under
`Assets/`. Every file's history is intact, so `git log --follow` on any of them
reaches back through the move to the original backup commit.

**This would still not give you an openable Unity project.** The master folder has
never contained `ProjectSettings/` or `Packages/`, which Unity requires. That was
true before this build started and is not something this build changed. To open the
C# in Unity, use the `IT` project instead, which is a complete Unity project.
