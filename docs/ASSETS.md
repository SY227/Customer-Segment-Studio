# Asset Notes

This correction pass removes the earlier misuse of preview/contact-sheet imagery from the live canvas.

## No longer used in the canvas

The following kinds of files are explicitly **not** used for characters or room rendering:
- `contents.png`
- sample collage renders
- preview/contact-sheet images
- black character-sheet style images
- accessory sheets used as fake character stand-ins

## Live character assets actually used

Source folder:
- `KayKit_Adventurers_2.0_EXTRA/Characters/gltf/`

Copied into deployment:
- `public/assets/models/characters/Knight.glb`
- `public/assets/models/characters/Ranger.glb`
- `public/assets/models/characters/Mage.glb`
- `public/assets/models/characters/Barbarian.glb`
- `public/assets/models/characters/Barbarian_Large.glb`
- `public/assets/models/characters/Druid.glb`
- `public/assets/models/characters/barbarian_texture_alt_C.png`
- `public/assets/models/characters/Engineer.glb`
- `public/assets/models/characters/Rogue.glb`
- `public/assets/models/characters/Rogue_Hooded.glb`

Segment mapping:
- Champions → `Knight.glb`
- Loyal Core → `Ranger.glb`
- New Momentum → `Druid.glb`
- At-Risk VIPs → `Barbarian.glb`
- Warming Up → `Engineer.glb`
- Drifting Occasionals → `Rogue.glb`
- Sleeping Giants → `Barbarian.glb` + `barbarian_texture_alt_C.png`
- Cold Repeaters → `Mage.glb`
- Long-tail Dormant → `Rogue_Hooded.glb`

## Live room / prop assets actually used

Source folders:
- `Low_Poly_Dungeon_Asset_Pack_v1.3/Assets/Environment/`
- `Low_Poly_Dungeon_Asset_Pack_v1.3/Assets/Props/`
- `Low_Poly_Dungeon_Asset_Pack_v1.3/Textures/`

Copied into deployment:
- `public/assets/models/dungeon/Ground_Tiles_Large.fbx`
- `public/assets/models/dungeon/Wall.fbx`
- `public/assets/models/dungeon/Wall_Window.fbx`
- `public/assets/models/dungeon/Wall_Door.fbx`
- `public/assets/models/dungeon/Pillar.fbx`
- `public/assets/models/dungeon/Rug_4_Way.fbx`
- `public/assets/models/dungeon/Torch_Holder.fbx`
- `public/assets/models/dungeon/Bookshelf_1.fbx`
- `public/assets/models/dungeon/Bookshelf_2.fbx`
- `public/assets/models/dungeon/Wooden_Shelf.fbx`
- `public/assets/models/dungeon/Wooden_Table.fbx`
- `public/assets/models/dungeon/Wooden_Table_Small.fbx`
- `public/assets/models/dungeon/Wooden_Barrel.fbx`
- `public/assets/models/dungeon/Wooden_Box.fbx`
- `public/assets/models/dungeon/Wooden_Chest.fbx`
- `public/assets/models/dungeon/Book_Pile_Large.fbx`
- `public/assets/models/dungeon/Book_Pile_Small.fbx`
- `public/assets/models/dungeon/Blue_Potion.fbx`
- `public/assets/models/dungeon/Green_Potion.fbx`
- `public/assets/models/dungeon/Red_Potion.fbx`
- `public/assets/models/dungeon/Quill.fbx`
- `public/assets/models/dungeon/Lectern.fbx`
- `public/assets/models/dungeon/Candles.fbx`
- `public/assets/models/dungeon/Chandelier.fbx`
- `public/assets/models/dungeon/Texture.png`

## Rendering approach used in the app

- The merchant room is rendered in a real 3D canvas.
- Characters are loaded from the real KayKit `.glb` model files.
- Environment and prop meshes are loaded from the real dungeon `.fbx` model files.
- If a live asset fails to load, the canvas reports the exact file path in the UI instead of silently swapping to the wrong asset.

## Animation note

- The currently used KayKit character `.glb` files do not expose embedded animation clips in this project build.
- The local pack also does not include usable local animation files beyond an external free-animations link.
- The canvas therefore uses a fallback roaming treatment: slower motion, facing correction, idle bob, light body lean, and shorter paths to avoid obvious statue-sliding.

## License / reference files

- `docs/licenses/kaykit-adventurers-license.txt`
- `docs/licenses/low-poly-dungeon-info.txt`
