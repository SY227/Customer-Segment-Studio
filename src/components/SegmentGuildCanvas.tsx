"use client";

import { useEffect, useRef, useState } from "react";
import type { SegmentGuildRecord, SegmentKey } from "@/data/segmentGuildData";

interface SegmentGuildCanvasProps {
  segments: SegmentGuildRecord[];
  selectedKey: SegmentKey;
  onSelect: (key: SegmentKey) => void;
  conversationPaused?: boolean;
}

interface RigJoint {
  bone: any;
  baseX: number;
  baseY: number;
  baseZ: number;
  baseQuaternion: any;
}

interface ProceduralRig {
  upperLegL?: RigJoint;
  upperLegR?: RigJoint;
  lowerLegL?: RigJoint;
  lowerLegR?: RigJoint;
  upperArmL?: RigJoint;
  upperArmR?: RigJoint;
  lowerArmL?: RigJoint;
  lowerArmR?: RigJoint;
  handL?: RigJoint;
  handR?: RigJoint;
  armMeshL?: RigJoint;
  armMeshR?: RigJoint;
  chest?: RigJoint;
  head?: RigJoint;
  hips?: RigJoint;
}

interface CharacterEntry {
  segment: SegmentGuildRecord;
  group: any;
  actor: any;
  visualArmL?: any;
  visualArmR?: any;
  bubbleAnchor: any;
  mixer?: any;
  walkAction?: any;
  idleAction?: any;
  fallbackAction?: any;
  proceduralRig?: ProceduralRig;
  baseX: number;
  baseZ: number;
  amplitudeX: number;
  amplitudeZ: number;
  phase: number;
  speed: number;
  bobSpeed: number;
  bobAmount: number;
  turnRate: number;
  strideBoost: number;
  lateralSway: number;
  pathPhaseA: number;
  pathPhaseB: number;
  pathPhaseC: number;
  pathRotation: number;
  crossDrift: number;
  sideBias: number;
  depthBias: number;
  roamPulse: number;
  personalSpace: number;
  lingerPhase: number;
  lingerRate: number;
  lingerStrength: number;
  arcDrift: number;
  lastX: number;
  lastZ: number;
  lastMoveX: number;
  lastMoveZ: number;
}

const CHARACTER_FORWARD_OFFSET = 0;
const CHARACTER_VISUAL_SCALE = 1.64;

function getCanvasMotionProfile(segment: SegmentGuildRecord) {
  switch (segment.label) {
    case "Best Customers":
      return { bobSpeed: 1.92, bobAmount: 0.031, turnRate: 7.2, strideBoost: 1.02, lateralSway: 0.016 };
    case "At-Risk VIPs":
      return { bobSpeed: 1.7, bobAmount: 0.027, turnRate: 6.4, strideBoost: 0.96, lateralSway: 0.013 };
    case "New Buyers":
      return { bobSpeed: 2.06, bobAmount: 0.033, turnRate: 7.5, strideBoost: 1.07, lateralSway: 0.018 };
    case "Occasional Buyers":
      return { bobSpeed: 1.98, bobAmount: 0.032, turnRate: 7.1, strideBoost: 1.05, lateralSway: 0.017 };
    case "Dormant VIPs":
      return { bobSpeed: 1.58, bobAmount: 0.025, turnRate: 5.9, strideBoost: 0.92, lateralSway: 0.011 };
    case "Inactive Customers":
      return { bobSpeed: 1.88, bobAmount: 0.03, turnRate: 6.7, strideBoost: 1, lateralSway: 0.015 };
    default:
      return { bobSpeed: 1.84, bobAmount: 0.03, turnRate: 6.9, strideBoost: 1.01, lateralSway: 0.015 };
  }
}

function lerpAngle(current: number, target: number, factor: number) {
  const delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  return current + delta * factor;
}

export function SegmentGuildCanvas({ segments, selectedKey, onSelect, conversationPaused = false }: SegmentGuildCanvasProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const selectedKeyRef = useRef<SegmentKey>(selectedKey);
  const bubbleKeyRef = useRef<SegmentKey>(selectedKey);
  const [bubbleKey, setBubbleKey] = useState<SegmentKey>(selectedKey);
  const [loadIssues, setLoadIssues] = useState<string[]>([]);

  useEffect(() => {
    selectedKeyRef.current = selectedKey;
    bubbleKeyRef.current = selectedKey;
    setBubbleKey(selectedKey);
  }, [selectedKey]);

  useEffect(() => {
    if (conversationPaused) return;

    const interval = window.setInterval(() => {
      const currentKey = bubbleKeyRef.current;
      const currentIndex = segments.findIndex((segment) => segment.key === currentKey);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % segments.length : 0;
      const nextKey = segments[nextIndex]?.key ?? segments[0].key;
      bubbleKeyRef.current = nextKey;
      setBubbleKey(nextKey);
      onSelect(nextKey);
    }, 4800);

    return () => window.clearInterval(interval);
  }, [conversationPaused, onSelect, segments]);

  useEffect(() => {
    let disposed = false;
    let animationFrame = 0;
    let cleanupScene: (() => void) | null = null;

    if (!viewportRef.current) return;

    setLoadIssues([]);

    const reportIssue = (assetPath: string, error: unknown) => {
      console.error(`Segment Guild asset failed to load: ${assetPath}`, error);
      setLoadIssues((current) => (current.includes(assetPath) ? current : [...current, assetPath]));
    };

    const initScene = async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
      const { clone } = await import("three/examples/jsm/utils/SkeletonUtils.js");

      if (disposed || !viewportRef.current) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x233140);
      scene.fog = new THREE.Fog(0x2a3949, 46, 72);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      viewportRef.current.innerHTML = "";
      viewportRef.current.appendChild(renderer.domElement);

      const camera = new THREE.OrthographicCamera(-10, 10, 8, -8, 0.1, 100);
      camera.position.set(12.0, 10.8, 10.7);
      camera.lookAt(0, 1.92, 0.88);

      scene.add(new THREE.AmbientLight(0xf6ead0, 1.3));
      scene.add(new THREE.HemisphereLight(0xf9e4b6, 0x37485b, 1.34));

      const keyLight = new THREE.DirectionalLight(0xffedc5, 1.75);
      keyLight.position.set(6, 9, 5);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xa9c6ee, 0.68);
      fillLight.position.set(-8, 6, -4);
      scene.add(fillLight);

      const lanternLeft = new THREE.PointLight(0xffc977, 1.55, 18, 2);
      lanternLeft.position.set(-5.6, 3.4, -4.1);
      scene.add(lanternLeft);

      const lanternRight = new THREE.PointLight(0xffc977, 1.45, 18, 2);
      lanternRight.position.set(5.6, 3.4, -4.1);
      scene.add(lanternRight);

      const chandelierLight = new THREE.PointLight(0xffdf9f, 1.7, 22, 2);
      chandelierLight.position.set(0, 4.8, -0.4);
      scene.add(chandelierLight);

      const loadingManager = new THREE.LoadingManager();
      loadingManager.setURLModifier((assetUrl) => (assetUrl.includes("Texture.png") ? "/assets/models/dungeon/Texture.png" : assetUrl));

      const textureLoader = new THREE.TextureLoader(loadingManager);
      const dungeonTexture = await new Promise<InstanceType<typeof THREE.Texture>>((resolve, reject) => {
        textureLoader.load("/assets/models/dungeon/Texture.png", resolve, undefined, reject);
      }).catch((error) => {
        reportIssue("/assets/models/dungeon/Texture.png", error);
        return null;
      });

      if (disposed || !dungeonTexture) {
        renderer.dispose();
        return;
      }

      dungeonTexture.colorSpace = THREE.SRGBColorSpace;
      dungeonTexture.magFilter = THREE.NearestFilter;
      dungeonTexture.minFilter = THREE.NearestMipmapNearestFilter;
      dungeonTexture.wrapS = THREE.RepeatWrapping;
      dungeonTexture.wrapT = THREE.RepeatWrapping;

      const gltfLoader = new GLTFLoader(loadingManager);
      const fbxLoader = new FBXLoader(loadingManager);
      const textureOverrideCache = new Map<string, any>();

      const loadGlb = (assetPath: string) =>
        new Promise<any>((resolve, reject) => {
          gltfLoader.load(assetPath, resolve, undefined, reject);
        });

      const loadFbx = (assetPath: string) =>
        new Promise<any>((resolve, reject) => {
          fbxLoader.load(assetPath, resolve, undefined, reject);
        });

      const loadTextureOverride = async (assetPath: string) => {
        if (textureOverrideCache.has(assetPath)) return textureOverrideCache.get(assetPath);
        const texture = await new Promise<any>((resolve, reject) => {
          textureLoader.load(assetPath, resolve, undefined, reject);
        });
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestMipmapNearestFilter;
        textureOverrideCache.set(assetPath, texture);
        return texture;
      };

      const fitObjectToHeight = (object: any, targetHeight: number) => {
        const bounds = new THREE.Box3().setFromObject(object);
        const size = bounds.getSize(new THREE.Vector3());
        const scale = targetHeight / Math.max(size.y, 0.0001);
        object.scale.multiplyScalar(scale);

        const adjusted = new THREE.Box3().setFromObject(object);
        const center = adjusted.getCenter(new THREE.Vector3());
        object.position.x -= center.x;
        object.position.z -= center.z;
        object.position.y -= adjusted.min.y;
      };

      const fitObjectToMaxDimension = (object: any, targetMaxDimension: number) => {
        const bounds = new THREE.Box3().setFromObject(object);
        const size = bounds.getSize(new THREE.Vector3());
        const largest = Math.max(size.x, size.y, size.z, 0.0001);
        object.scale.multiplyScalar(targetMaxDimension / largest);

        const adjusted = new THREE.Box3().setFromObject(object);
        const center = adjusted.getCenter(new THREE.Vector3());
        object.position.x -= center.x;
        object.position.z -= center.z;
        object.position.y -= adjusted.min.y;
      };

      const makeDungeonMaterial = (color: number, roughness = 0.88) =>
        new THREE.MeshStandardMaterial({
          color,
          map: dungeonTexture,
          roughness,
          metalness: 0.03,
        });

      const applyDungeonMaterial = (object: any, color: number, roughness = 0.88) => {
        object.traverse((child: any) => {
          if (!child.isMesh) return;
          child.material = makeDungeonMaterial(color, roughness);
          child.castShadow = false;
          child.receiveShadow = false;
        });
      };

      const applyCharacterMaterial = (object: any, overrideTexture?: any) => {
        object.traverse((child: any) => {
          if (!child.isMesh) return;
          child.frustumCulled = false;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material: any) => {
            if (overrideTexture) {
              material.map = overrideTexture;
            }
            if (material.map) {
              material.map.colorSpace = THREE.SRGBColorSpace;
              material.map.magFilter = THREE.NearestFilter;
              material.map.minFilter = THREE.NearestMipmapNearestFilter;
              material.map.needsUpdate = true;
            }
            material.roughness = 0.9;
            material.metalness = 0.02;
            material.needsUpdate = true;
          });
        });
      };

      const makeJoint = (bone: any): RigJoint => ({
        bone,
        baseX: bone.rotation.x,
        baseY: bone.rotation.y,
        baseZ: bone.rotation.z,
        baseQuaternion: bone.quaternion.clone(),
      });

      const captureRigJoint = (root: any, patterns: RegExp[]) => {
        let found: any = null;
        root.traverse((node: any) => {
          if (found || !node.isBone) return;
          const name = String(node.name ?? "").toLowerCase();
          if (patterns.some((pattern) => pattern.test(name))) {
            found = node;
          }
        });
        return found ? makeJoint(found) : undefined;
      };

      const captureNamedNode = (root: any, patterns: RegExp[]) => {
        let found: any = null;
        root.traverse((node: any) => {
          if (found) return;
          const name = String(node.name ?? "");
          if (patterns.some((pattern) => pattern.test(name))) {
            found = node;
          }
        });
        return found ? makeJoint(found) : undefined;
      };

      const buildProceduralRig = (root: any): ProceduralRig => ({
        upperLegL: captureRigJoint(root, [/upperleg\.l/i, /thigh\.l/i, /leg_upper\.l/i]),
        upperLegR: captureRigJoint(root, [/upperleg\.r/i, /thigh\.r/i, /leg_upper\.r/i]),
        lowerLegL: captureRigJoint(root, [/lowerleg\.l/i, /calf\.l/i, /leg_lower\.l/i]),
        lowerLegR: captureRigJoint(root, [/lowerleg\.r/i, /calf\.r/i, /leg_lower\.r/i]),
        upperArmL: captureRigJoint(root, [/upperarm\.l/i, /arm_upper\.l/i]),
        upperArmR: captureRigJoint(root, [/upperarm\.r/i, /arm_upper\.r/i]),
        lowerArmL: captureRigJoint(root, [/lowerarm\.l/i, /forearm\.l/i, /arm_lower\.l/i]),
        lowerArmR: captureRigJoint(root, [/lowerarm\.r/i, /forearm\.r/i, /arm_lower\.r/i]),
        handL: captureRigJoint(root, [/hand\.l/i, /wrist\.l/i]),
        handR: captureRigJoint(root, [/hand\.r/i, /wrist\.r/i]),
        armMeshL: captureNamedNode(root, [/_ArmLeft$/i, /ArmLeft$/i]),
        armMeshR: captureNamedNode(root, [/_ArmRight$/i, /ArmRight$/i]),
        chest: captureRigJoint(root, [/chest/i, /spine/i]),
        head: captureRigJoint(root, [/head/i]),
        hips: captureRigJoint(root, [/hips/i, /pelvis/i]),
      });

      const createVisualArm = (side: "left" | "right", scaleFactor: number) => {
        const sideSign = side === "left" ? -1 : 1;
        const shoulder = new THREE.Group();
        shoulder.position.set(sideSign * 0.25 * scaleFactor, 0.78 * scaleFactor, -0.01 * scaleFactor);

        const upperPivot = new THREE.Group();
        shoulder.add(upperPivot);

        const upperMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.12 * scaleFactor, 0.34 * scaleFactor, 0.12 * scaleFactor),
          new THREE.MeshStandardMaterial({ color: 0x7f6347, roughness: 0.94, metalness: 0.02 }),
        );
        upperMesh.position.set(0, -0.17 * scaleFactor, 0);
        upperPivot.add(upperMesh);

        const lowerPivot = new THREE.Group();
        lowerPivot.position.set(0, -0.31 * scaleFactor, 0);
        upperPivot.add(lowerPivot);

        const lowerMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.1 * scaleFactor, 0.28 * scaleFactor, 0.1 * scaleFactor),
          new THREE.MeshStandardMaterial({ color: 0x86694d, roughness: 0.94, metalness: 0.02 }),
        );
        lowerMesh.position.set(0, -0.14 * scaleFactor, 0);
        lowerPivot.add(lowerMesh);

        const handPivot = new THREE.Group();
        handPivot.position.set(0, -0.26 * scaleFactor, 0);
        lowerPivot.add(handPivot);

        const handMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.08 * scaleFactor, 0.1 * scaleFactor, 0.08 * scaleFactor),
          new THREE.MeshStandardMaterial({ color: 0xc7a07a, roughness: 0.95, metalness: 0.01 }),
        );
        handMesh.position.set(0, -0.05 * scaleFactor, 0);
        handPivot.add(handMesh);

        return { shoulder, upperPivot, lowerPivot, handPivot };
      };

      const fallbackRoom = new THREE.Group();
      scene.add(fallbackRoom);

      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(24.8, 0.35, 17.6),
        new THREE.MeshStandardMaterial({ color: 0x9a7652, roughness: 0.95, metalness: 0.01 }),
      );
      floor.position.set(0, -0.18, 0);
      fallbackRoom.add(floor);

      const leftBackColumn = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 6.6, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x566575, roughness: 0.92, metalness: 0.02 }),
      );
      leftBackColumn.position.set(-7.3, 3, -5.6);
      fallbackRoom.add(leftBackColumn);

      const rightBackColumn = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 6.6, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x566575, roughness: 0.92, metalness: 0.02 }),
      );
      rightBackColumn.position.set(7.3, 3, -5.6);
      fallbackRoom.add(rightBackColumn);

      const centerBackColumnL = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 5.8, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x5d6c7b, roughness: 0.92, metalness: 0.02 }),
      );
      centerBackColumnL.position.set(-2.9, 2.7, -5.4);
      fallbackRoom.add(centerBackColumnL);

      const centerBackColumnR = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 5.8, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x5d6c7b, roughness: 0.92, metalness: 0.02 }),
      );
      centerBackColumnR.position.set(2.9, 2.7, -5.4);
      fallbackRoom.add(centerBackColumnR);

      const rearBeam = new THREE.Mesh(
        new THREE.BoxGeometry(13.8, 0.46, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x7a5d40, roughness: 0.9, metalness: 0.02 }),
      );
      rearBeam.position.set(0, 5.4, -5.3);
      fallbackRoom.add(rearBeam);

      const rearCounterLeft = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 1.1, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x785b3d, roughness: 0.91, metalness: 0.02 }),
      );
      rearCounterLeft.position.set(-4.5, 0.55, -4.15);
      fallbackRoom.add(rearCounterLeft);

      const rearCounterCenter = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 1.12, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x785b3d, roughness: 0.91, metalness: 0.02 }),
      );
      rearCounterCenter.position.set(0, 0.56, -4.05);
      fallbackRoom.add(rearCounterCenter);

      const rearCounterRight = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 1.1, 1.1),
        new THREE.MeshStandardMaterial({ color: 0x785b3d, roughness: 0.91, metalness: 0.02 }),
      );
      rearCounterRight.position.set(4.5, 0.55, -4.15);
      fallbackRoom.add(rearCounterRight);

      const leftRearShelf = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 3.2, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x73593e, roughness: 0.91, metalness: 0.02 }),
      );
      leftRearShelf.position.set(-6.15, 1.6, -3.7);
      fallbackRoom.add(leftRearShelf);

      const rightRearShelf = new THREE.Mesh(
        new THREE.BoxGeometry(2.3, 3.2, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x73593e, roughness: 0.91, metalness: 0.02 }),
      );
      rightRearShelf.position.set(6.15, 1.6, -3.7);
      fallbackRoom.add(rightRearShelf);


      const dungeonAssets = [
        { key: "ground", path: "/assets/models/dungeon/Ground_Tiles_Large.fbx", max: 7.6, color: 0x8a755d },
        { key: "pillar", path: "/assets/models/dungeon/Pillar.fbx", max: 2.1, color: 0x647281 },
        { key: "rug", path: "/assets/models/dungeon/Rug_4_Way.fbx", max: 3.5, color: 0x9c5062 },
        { key: "torchHolder", path: "/assets/models/dungeon/Torch_Holder.fbx", max: 1.25, color: 0xc69b5e },
        { key: "bookshelf1", path: "/assets/models/dungeon/Bookshelf_1.fbx", max: 2.2, color: 0x7b5e3e },
        { key: "bookshelf2", path: "/assets/models/dungeon/Bookshelf_2.fbx", max: 2.2, color: 0x7b5e3e },
        { key: "woodenShelf", path: "/assets/models/dungeon/Wooden_Shelf.fbx", max: 1.9, color: 0x7a5c3d },
        { key: "table", path: "/assets/models/dungeon/Wooden_Table.fbx", max: 1.9, color: 0x7e5f3d },
        { key: "smallTable", path: "/assets/models/dungeon/Wooden_Table_Small.fbx", max: 1.2, color: 0x7e5f3d },
        { key: "barrel", path: "/assets/models/dungeon/Wooden_Barrel.fbx", max: 0.92, color: 0x70553a },
        { key: "box", path: "/assets/models/dungeon/Wooden_Box.fbx", max: 0.88, color: 0x73563c },
        { key: "chest", path: "/assets/models/dungeon/Wooden_Chest.fbx", max: 1.02, color: 0x7e603e },
        { key: "bookLarge", path: "/assets/models/dungeon/Book_Pile_Large.fbx", max: 0.82, color: 0x8a704d },
        { key: "bookSmall", path: "/assets/models/dungeon/Book_Pile_Small.fbx", max: 0.62, color: 0x8a704d },
        { key: "bluePotion", path: "/assets/models/dungeon/Blue_Potion.fbx", max: 0.4, color: 0x5b8fd0 },
        { key: "greenPotion", path: "/assets/models/dungeon/Green_Potion.fbx", max: 0.4, color: 0x61a86e },
        { key: "redPotion", path: "/assets/models/dungeon/Red_Potion.fbx", max: 0.4, color: 0xd16763 },
        { key: "quill", path: "/assets/models/dungeon/Quill.fbx", max: 0.34, color: 0xd3c4a3 },
        { key: "lectern", path: "/assets/models/dungeon/Lectern.fbx", max: 1.1, color: 0x7c5f40 },
        { key: "candles", path: "/assets/models/dungeon/Candles.fbx", max: 0.6, color: 0xf1d6a0 },
        { key: "chandelier", path: "/assets/models/dungeon/Chandelier.fbx", max: 1.9, color: 0xd1a763 },
      ] as const;

      const dungeonTemplates = new Map<string, any>();
      await Promise.all(
        dungeonAssets.map(async (asset) => {
          try {
            const model = await loadFbx(asset.path);
            applyDungeonMaterial(model, asset.color);
            fitObjectToMaxDimension(model, asset.max);
            dungeonTemplates.set(asset.key, model);
          } catch (error) {
            reportIssue(asset.path, error);
          }
        }),
      );

      const roomGroup = new THREE.Group();
      scene.add(roomGroup);

      const addDungeonClone = (key: string, position: [number, number, number], rotationY = 0, scale = 1) => {
        const template = dungeonTemplates.get(key);
        if (!template) return null;
        const instance = template.clone(true);
        instance.position.set(position[0], position[1], position[2]);
        instance.rotation.y = rotationY;
        instance.scale.multiplyScalar(scale);
        roomGroup.add(instance);
        return instance;
      };

      addDungeonClone("pillar", [-6.85, 0, -5.15], 0, 1.28);
      addDungeonClone("pillar", [6.85, 0, -5.15], 0, 1.28);
      addDungeonClone("pillar", [-2.9, 0, -5.1], 0, 1.1);
      addDungeonClone("pillar", [2.9, 0, -5.1], 0, 1.1);
      addDungeonClone("torchHolder", [-5.9, 2.55, -4.6], Math.PI / 2, 1.12);
      addDungeonClone("torchHolder", [5.9, 2.55, -4.6], -Math.PI / 2, 1.12);
      addDungeonClone("bookshelf1", [-6.0, 0, -3.75], 0.02, 1.02);
      addDungeonClone("bookshelf2", [6.0, 0, -3.75], -0.02, 1.02);
      addDungeonClone("woodenShelf", [-9.1, 0, 0.9], Math.PI / 2, 1.02);
      addDungeonClone("woodenShelf", [9.1, 0, 0.9], -Math.PI / 2, 1.02);
      addDungeonClone("table", [-4.8, 0, -4.2], 0, 0.9);
      addDungeonClone("table", [4.8, 0, -4.2], 0, 0.9);
      addDungeonClone("lectern", [-6.5, 0, -2.45], 0.18, 1.02);
      addDungeonClone("lectern", [6.5, 0, -2.45], -0.18, 1.02);
      addDungeonClone("candles", [-6.28, 1.1, -2.18], 0, 1.08);
      addDungeonClone("candles", [6.28, 1.1, -2.18], 0, 1.08);
      addDungeonClone("chandelier", [0, 4.7, -0.35], 0, 1.14);
      addDungeonClone("quill", [-6.32, 1.18, -2.05], 0.3, 1);
      addDungeonClone("bookSmall", [-6.9, 1.26, -2.28], 0.22, 0.82);
      addDungeonClone("bookSmall", [6.9, 1.26, -2.28], -0.22, 0.82);
      addDungeonClone("bookLarge", [-5.85, 1.14, -3.74], 0.08, 0.88);
      addDungeonClone("bookLarge", [5.85, 1.14, -3.74], -0.08, 0.88);
      addDungeonClone("bluePotion", [-5.55, 1.36, -3.42], 0, 0.9);
      addDungeonClone("redPotion", [5.55, 1.36, -3.42], 0, 0.9);
      addDungeonClone("bookSmall", [6.18, 1.42, -3.22], 0.16, 0.72);
      addDungeonClone("bookSmall", [5.78, 1.44, -3.04], -0.12, 0.7);
      addDungeonClone("greenPotion", [6.02, 1.46, -3.56], 0, 0.72);
      addDungeonClone("quill", [6.28, 1.18, -2.05], -0.3, 1);
      addDungeonClone("bookSmall", [-4.7, 1.02, -4.02], 0.14, 0.76);
      addDungeonClone("bookSmall", [4.7, 1.02, -4.02], -0.14, 0.76);
      addDungeonClone("greenPotion", [-4.38, 1.08, -3.84], 0, 0.8);
      addDungeonClone("redPotion", [4.38, 1.08, -3.84], 0, 0.8);
      addDungeonClone("bookLarge", [-5.08, 1.12, -4.12], 0.1, 0.82);
      addDungeonClone("bookSmall", [-5.48, 1.14, -3.9], -0.16, 0.72);
      addDungeonClone("candles", [-4.18, 1.08, -4.04], 0, 0.66);
      addDungeonClone("bluePotion", [-5.74, 1.1, -4.02], 0, 0.74);
      addDungeonClone("bookLarge", [-0.62, 1.12, -4.08], -0.08, 0.86);
      addDungeonClone("bookSmall", [0.12, 1.15, -3.88], 0.16, 0.76);
      addDungeonClone("candles", [0.82, 1.1, -3.96], 0, 0.72);
      addDungeonClone("quill", [-0.08, 1.18, -3.82], 0.22, 0.92);
      addDungeonClone("bluePotion", [1.14, 1.12, -4.1], 0, 0.76);
      addDungeonClone("bookSmall", [-0.92, 1.14, -3.88], -0.14, 0.72);
      addDungeonClone("greenPotion", [0.46, 1.1, -4.08], 0, 0.7);
      addDungeonClone("bookLarge", [5.02, 1.12, -4.1], -0.1, 0.82);
      addDungeonClone("bookSmall", [5.48, 1.15, -3.92], 0.12, 0.72);
      addDungeonClone("candles", [4.18, 1.08, -4.04], 0, 0.66);

      const characterEntries: CharacterEntry[] = [];
      const planeX = 16.4;
      const planeZ = 10.4;

      await Promise.all(
        segments.map(async (segment) => {
          try {
            const gltf = await loadGlb(segment.asset);
            const root = clone(gltf.scene);
            const overrideTexture = segment.textureOverride ? await loadTextureOverride(segment.textureOverride) : undefined;
            applyCharacterMaterial(root, overrideTexture);
            fitObjectToHeight(root, segment.characterHeight * CHARACTER_VISUAL_SCALE);
            root.rotation.y = 0;

            const mixer = gltf.animations?.length ? new THREE.AnimationMixer(root) : undefined;
            const clips = Array.isArray(gltf.animations) ? gltf.animations : [];
            const walkClip = clips.find((clip: any) => /walk|walking|run|move/i.test(clip.name ?? ""));
            const idleClip = clips.find((clip: any) => /idle|breath|stand/i.test(clip.name ?? ""));
            const fallbackClip = !walkClip && !idleClip && clips[0] ? clips[0] : undefined;

            const walkAction = mixer && walkClip ? mixer.clipAction(walkClip) : undefined;
            const idleAction = mixer && idleClip ? mixer.clipAction(idleClip) : undefined;
            const fallbackAction = mixer && fallbackClip ? mixer.clipAction(fallbackClip) : undefined;

            [walkAction, idleAction, fallbackAction].forEach((action) => {
              if (!action) return;
              action.play();
              action.enabled = true;
              action.setLoop(THREE.LoopRepeat, Infinity);
            });

            if (walkAction && idleAction) {
              walkAction.weight = 0;
              idleAction.weight = 1;
            }

            const actor = new THREE.Group();
            actor.add(root);

            const rig = buildProceduralRig(root);
            if (rig.armMeshL?.bone) rig.armMeshL.bone.visible = false;
            if (rig.armMeshR?.bone) rig.armMeshR.bone.visible = false;

            const armScale = Math.max(0.9, segment.characterHeight / 1.1);
            const visualArmL = createVisualArm("left", armScale);
            const visualArmR = createVisualArm("right", armScale);
            actor.add(visualArmL.shoulder);
            actor.add(visualArmR.shoulder);

            const characterGroup = new THREE.Group();
            const bubbleAnchor = new THREE.Object3D();
            bubbleAnchor.position.set(0, segment.characterHeight * CHARACTER_VISUAL_SCALE + 0.28, 0);

            characterGroup.add(actor);
            characterGroup.add(bubbleAnchor);
            characterGroup.userData.segmentKey = segment.key;
            actor.traverse((child: any) => {
              child.userData.segmentKey = segment.key;
            });

            const baseX = (segment.roomX / 100 - 0.5) * planeX;
            const baseZ = (segment.roomY / 100 - 0.5) * planeZ;
            characterGroup.position.set(baseX, 0, baseZ);
            scene.add(characterGroup);

            const motion = getCanvasMotionProfile(segment);
            const motionSeed = segment.priorityRank * 0.73 + segment.roomX * 0.041 + segment.roomY * 0.029;

            characterEntries.push({
              segment,
              group: characterGroup,
              actor,
              visualArmL,
              visualArmR,
              bubbleAnchor,
              mixer,
              walkAction,
              idleAction,
              fallbackAction,
              proceduralRig: rig,
              baseX,
              baseZ,
              amplitudeX: Math.max(1.16, Math.abs(segment.driftX) / 8.4),
              amplitudeZ: Math.max(0.92, Math.abs(segment.driftY) / 8.8),
              phase: segment.walkDelayMs / 1500,
              speed: 5600 / segment.walkDurationMs,
              bobSpeed: motion.bobSpeed,
              bobAmount: motion.bobAmount,
              turnRate: motion.turnRate,
              strideBoost: motion.strideBoost,
              lateralSway: motion.lateralSway,
              pathPhaseA: motionSeed * 1.3,
              pathPhaseB: motionSeed * 1.9 + 0.7,
              pathPhaseC: motionSeed * 2.4 + 1.1,
              pathRotation: Math.sin(motionSeed * 1.08) * 0.42,
              crossDrift: 0.2 + ((Math.sin(motionSeed * 1.2) + 1) / 2) * 0.2,
              sideBias: Math.sin(motionSeed * 0.7) * 0.28,
              depthBias: Math.cos(motionSeed * 0.9) * 0.16,
              roamPulse: 0.09 + ((Math.cos(motionSeed * 1.5) + 1) / 2) * 0.07,
              personalSpace: 0.92 + segment.characterHeight * 0.22,
              lingerPhase: motionSeed * 1.6 + 0.9,
              lingerRate: 0.22 + ((Math.sin(motionSeed * 0.8) + 1) / 2) * 0.16,
              lingerStrength: 0.36 + ((Math.cos(motionSeed * 1.1) + 1) / 2) * 0.26,
              arcDrift: 0.08 + ((Math.sin(motionSeed * 1.4) + 1) / 2) * 0.1,
              lastX: baseX,
              lastZ: baseZ,
              lastMoveX: 0,
              lastMoveZ: 0,
            });
          } catch (error) {
            reportIssue(segment.asset, error);
          }
        }),
      );

      const resize = () => {
        if (!viewportRef.current) return;
        const width = Math.max(viewportRef.current.clientWidth, 1);
        const height = Math.max(viewportRef.current.clientHeight, 1);
        const aspect = width / height;
        const frustumHeight = 11.2;
        camera.left = (-frustumHeight * aspect) / 2;
        camera.right = (frustumHeight * aspect) / 2;
        camera.top = frustumHeight / 2;
        camera.bottom = -frustumHeight / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };

      resize();
      const resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(viewportRef.current);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();

      const findSegmentKey = (object: any): SegmentKey | null => {
        let current = object;
        while (current) {
          if (current.userData?.segmentKey) return current.userData.segmentKey as SegmentKey;
          current = current.parent;
        }
        return null;
      };

      const handlePointerMove = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(characterEntries.map((entry) => entry.group), true);
        renderer.domElement.style.cursor = hits.length ? "pointer" : "default";
      };

      const handleClick = (event: MouseEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(characterEntries.map((entry) => entry.group), true);
        const targetKey = hits.map((hit) => findSegmentKey(hit.object)).find(Boolean);
        if (!targetKey) return;
        bubbleKeyRef.current = targetKey;
        setBubbleKey(targetKey);
        onSelect(targetKey);
      };

      renderer.domElement.addEventListener("pointermove", handlePointerMove);
      renderer.domElement.addEventListener("click", handleClick);

      const projectedBubble = new THREE.Vector3();
      const clock = new THREE.Clock();
      let elapsedSeconds = 0;

      const clampRoamPosition = (candidateX: number, candidateZ: number) => {
        const leftGain = Math.max(0, Math.min(1, (-candidateX - 0.88) / 5.55));
        const lowerGain = Math.max(0, Math.min(1, (candidateZ - 0.34) / 4.05));
        const frontLeftGain = lowerGain * (0.68 + leftGain * 0.32);
        const minX = -5.9 - leftGain * 1.7 - frontLeftGain * 1.38;
        const maxX = 5.55;
        const minZ = -0.35;
        const maxZ = 4.1 + lowerGain * 1.02 + leftGain * 0.1;

        return {
          x: Math.max(minX, Math.min(maxX, candidateX)),
          z: Math.max(minZ, Math.min(maxZ, candidateZ)),
        };
      };

      const animateProceduralRig = (entry: CharacterEntry, elapsed: number, moving: boolean, strideAmount: number) => {
        const rig = entry.proceduralRig;
        if (!rig) return;

        const idleSway = Math.sin(elapsed * (1.45 + entry.strideBoost * 0.08) + entry.phase) * 0.06;
        const walkCycle = elapsed * (8.8 + entry.strideBoost * 0.8) + entry.phase * 1.4;
        const strideReach = moving ? strideAmount * 1.18 + 0.05 : 0;
        const legSwing = Math.sin(walkCycle) * strideReach;
        const shoulderNoise = Math.sin(walkCycle * 0.5 + Math.PI * 0.25) * 0.025;
        const elbowBendL = Math.max(0, Math.sin(walkCycle + Math.PI * 0.2)) * (strideAmount * 1.18 + 0.28);
        const elbowBendR = Math.max(0, Math.sin(walkCycle + Math.PI + Math.PI * 0.2)) * (strideAmount * 1.18 + 0.28);
        const wristSwing = Math.sin(walkCycle + Math.PI * 0.5) * (strideAmount * 0.44 + 0.12);
        const kneeLiftL = Math.max(0, Math.sin(walkCycle + Math.PI * 0.08)) * (strideAmount * 0.92 + 0.04);
        const kneeLiftR = Math.max(0, Math.sin(walkCycle + Math.PI + Math.PI * 0.08)) * (strideAmount * 0.92 + 0.04);
        const heelKickL = Math.max(0, Math.sin(walkCycle + Math.PI * 0.7)) * (strideAmount * 0.34 + 0.04);
        const heelKickR = Math.max(0, Math.sin(walkCycle + Math.PI + Math.PI * 0.7)) * (strideAmount * 0.34 + 0.04);

        const applyQuat = (joint: RigJoint | undefined, eulerX: number, eulerY: number, eulerZ: number, alpha = 0.35) => {
          if (!joint) return;
          const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(eulerX, eulerY, eulerZ, "XYZ"));
          joint.bone.quaternion.slerp(targetQuat, alpha);
        };

        const applyDirectionQuat = (
          joint: RigJoint | undefined,
          frameObject: any,
          targetDirectionInFrame: any,
          alpha = 0.35,
        ) => {
          if (!joint || !joint.bone.parent) return;

          const frameWorldQuat = new THREE.Quaternion();
          const parentWorldQuat = new THREE.Quaternion();
          frameObject.getWorldQuaternion(frameWorldQuat);
          joint.bone.parent.getWorldQuaternion(parentWorldQuat);

          const desiredWorldDirection = targetDirectionInFrame.clone().normalize().applyQuaternion(frameWorldQuat);
          const desiredParentLocalDirection = desiredWorldDirection.applyQuaternion(parentWorldQuat.clone().invert()).normalize();

          const baseDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(joint.baseQuaternion).normalize();
          const deltaQuat = new THREE.Quaternion().setFromUnitVectors(baseDirection, desiredParentLocalDirection);
          const targetQuat = deltaQuat.multiply(joint.baseQuaternion.clone());
          joint.bone.quaternion.slerp(targetQuat, alpha);
        };

        if (rig.upperLegL) rig.upperLegL.bone.rotation.x = rig.upperLegL.baseX + (moving ? legSwing : idleSway * 0.24);
        if (rig.upperLegR) rig.upperLegR.bone.rotation.x = rig.upperLegR.baseX - (moving ? legSwing : idleSway * 0.24);
        if (rig.lowerLegL) rig.lowerLegL.bone.rotation.x = rig.lowerLegL.baseX + (moving ? kneeLiftL + heelKickL : 0);
        if (rig.lowerLegR) rig.lowerLegR.bone.rotation.x = rig.lowerLegR.baseX + (moving ? kneeLiftR + heelKickR : 0);

        const leftArmTarget = new THREE.Vector3(
          -0.08,
          moving ? -0.97 : -0.985,
          -0.2 + Math.sin(walkCycle + Math.PI) * 0.42 + shoulderNoise,
        ).normalize();
        const rightArmTarget = new THREE.Vector3(
          0.08,
          moving ? -0.97 : -0.985,
          -0.2 - Math.sin(walkCycle + Math.PI) * 0.42 - shoulderNoise,
        ).normalize();

        if (rig.upperArmL) {
          applyDirectionQuat(rig.upperArmL, entry.group, leftArmTarget, 0.55);
        }
        if (rig.upperArmR) {
          applyDirectionQuat(rig.upperArmR, entry.group, rightArmTarget, 0.55);
        }

        if (rig.armMeshL) {
          rig.armMeshL.bone.rotation.z = 0.82 + Math.sin(walkCycle * 0.5) * 0.03;
          rig.armMeshL.bone.rotation.x = -0.16 + Math.sin(walkCycle + Math.PI) * 0.24;
        }
        if (rig.armMeshR) {
          rig.armMeshR.bone.rotation.z = -0.82 - Math.sin(walkCycle * 0.5) * 0.03;
          rig.armMeshR.bone.rotation.x = -0.16 - Math.sin(walkCycle + Math.PI) * 0.24;
        }
        if (rig.lowerArmL) {
          applyQuat(rig.lowerArmL, rig.lowerArmL.baseX - elbowBendL, rig.lowerArmL.baseY - 0.04, rig.lowerArmL.baseZ, 0.45);
        }
        if (rig.lowerArmR) {
          applyQuat(rig.lowerArmR, rig.lowerArmR.baseX - elbowBendR, rig.lowerArmR.baseY + 0.04, rig.lowerArmR.baseZ, 0.45);
        }
        if (rig.handL) {
          applyQuat(rig.handL, rig.handL.baseX + wristSwing, rig.handL.baseY - 0.04, rig.handL.baseZ, 0.45);
        }
        if (rig.handR) {
          applyQuat(rig.handR, rig.handR.baseX - wristSwing, rig.handR.baseY + 0.04, rig.handR.baseZ, 0.45);
        }

        if (entry.visualArmL && entry.visualArmR) {
          const armCycle = elapsed * (4.75 + entry.strideBoost * 0.36) + entry.phase * 1.7 + entry.segment.priorityRank * 0.63;
          const shoulderNeutral = -0.2;
          const shoulderSwing = (moving ? 0.33 : 0.1) * Math.sin(armCycle);
          const shoulderRoll = 0.8 + Math.sin(armCycle * 0.5 + entry.phase) * 0.025;
          const lowerFollowL = 0.32 + Math.max(0, Math.sin(armCycle - 0.18)) * 0.37;
          const lowerFollowR = 0.32 + Math.max(0, Math.sin(armCycle + Math.PI - 0.18)) * 0.37;
          const handFollowL = -0.05 + Math.sin(armCycle - 0.36) * 0.11;
          const handFollowR = -0.05 + Math.sin(armCycle + Math.PI - 0.36) * 0.11;

          entry.visualArmL.shoulder.rotation.set(shoulderNeutral + shoulderSwing, 0.05, shoulderRoll);
          entry.visualArmR.shoulder.rotation.set(shoulderNeutral - shoulderSwing, -0.05, -shoulderRoll);
          entry.visualArmL.lowerPivot.rotation.x = lowerFollowL;
          entry.visualArmR.lowerPivot.rotation.x = lowerFollowR;
          entry.visualArmL.handPivot.rotation.x = handFollowL;
          entry.visualArmR.handPivot.rotation.x = handFollowR;
        }

        if (rig.chest) {
          rig.chest.bone.rotation.z = rig.chest.baseZ + (moving ? Math.sin(walkCycle * 0.5) * strideAmount * 0.12 : idleSway * 0.08);
          rig.chest.bone.rotation.x =
            rig.chest.baseX +
            (moving ? 0.04 + Math.cos(walkCycle) * strideAmount * 0.08 : 0.01) +
            Math.sin(elapsed * 1.8 + entry.phase) * 0.01;
        }
        if (rig.hips) {
          rig.hips.bone.rotation.z = rig.hips.baseZ + (moving ? Math.sin(walkCycle) * strideAmount * 0.1 : idleSway * 0.06);
          rig.hips.bone.rotation.x = rig.hips.baseX + (moving ? -0.03 - Math.cos(walkCycle) * strideAmount * 0.06 : 0);
        }
        if (rig.head) {
          rig.head.bone.rotation.y = rig.head.baseY + Math.sin(elapsed * 0.9 + entry.phase) * 0.04;
          rig.head.bone.rotation.x = rig.head.baseX + Math.sin(elapsed * 1.1 + entry.phase) * 0.02;
        }
      };

      const animate = () => {
        if (disposed || !viewportRef.current) return;

        const delta = clock.getDelta();
        elapsedSeconds += delta;
        const elapsed = elapsedSeconds;
        const width = viewportRef.current.clientWidth;
        const height = viewportRef.current.clientHeight;

        const desiredPositions = characterEntries.map((entry) => {
          const travel = elapsed * entry.speed + entry.phase;
          const roamScale = 0.84 + Math.sin(travel * (0.34 + entry.roamPulse) + entry.pathPhaseA) * (0.08 + entry.roamPulse * 0.18);
          const localX =
            Math.sin(travel * 0.88 + entry.pathPhaseA) * entry.amplitudeX * roamScale +
            Math.sin(travel * (0.49 + entry.crossDrift * 0.18) + entry.pathPhaseB) * entry.amplitudeX * (0.24 + entry.roamPulse * 0.45);
          const localZ =
            Math.cos(travel * (0.66 + entry.roamPulse * 0.16) + entry.pathPhaseB) * entry.amplitudeZ * roamScale +
            Math.sin(travel * (0.31 + entry.crossDrift * 0.1) + entry.pathPhaseC) * entry.amplitudeZ * (0.18 + entry.roamPulse * 0.26);
          const dynamicRotation = entry.pathRotation + Math.sin(elapsed * (0.12 + entry.arcDrift * 0.24) + entry.pathPhaseB) * entry.arcDrift;
          const rotatedX = localX * Math.cos(dynamicRotation) - localZ * Math.sin(dynamicRotation);
          const rotatedZ = localX * Math.sin(dynamicRotation) + localZ * Math.cos(dynamicRotation);
          const rawX =
            entry.baseX +
            entry.sideBias +
            rotatedX +
            Math.cos(travel * (0.58 + entry.roamPulse * 0.16) + entry.pathPhaseC) * entry.amplitudeZ * (entry.crossDrift * 0.34);
          const rawZ =
            entry.baseZ +
            entry.depthBias +
            rotatedZ +
            Math.sin(travel * (0.46 + entry.roamPulse * 0.14) + entry.pathPhaseA) * entry.amplitudeX * (entry.crossDrift * 0.22);
          const clamped = clampRoamPosition(rawX, rawZ);

          const boundaryHitX = Math.abs(clamped.x - rawX);
          const boundaryHitZ = Math.abs(clamped.z - rawZ);
          const edgePressure = Math.min(
            1,
            Math.hypot(boundaryHitX, boundaryHitZ) / Math.max(entry.personalSpace * 0.75, 0.0001),
          );

          const lingerWave = Math.sin(elapsed * entry.lingerRate + entry.lingerPhase);
          const lingerIntent = Math.max(0, (lingerWave - 0.52) / 0.48) * entry.lingerStrength;

          return {
            entry,
            x: clamped.x,
            z: clamped.z,
            targetX: clamped.x,
            targetZ: clamped.z,
            crowding: 0,
            edgePressure,
            hesitation: 0,
            lingerIntent,
            boundaryHitX,
            boundaryHitZ,
          };
        });

        for (let i = 0; i < desiredPositions.length; i += 1) {
          for (let j = i + 1; j < desiredPositions.length; j += 1) {
            const a = desiredPositions[i];
            const b = desiredPositions[j];
            const dx = a.x - b.x;
            const dz = a.z - b.z;
            const distance = Math.hypot(dx, dz);
            const minimumDistance = (a.entry.personalSpace + b.entry.personalSpace) * 0.42;

            if (distance >= minimumDistance) continue;

            const overlap = minimumDistance - distance;
            const overlapRatio = Math.min(1, overlap / Math.max(minimumDistance, 0.0001));
            const safeDx = distance > 0.0001 ? dx / distance : Math.cos(i * 1.7 + j * 0.9);
            const safeDz = distance > 0.0001 ? dz / distance : Math.sin(i * 1.7 + j * 0.9);
            const push = Math.min(0.085, overlap * 0.18);

            const pushedA = clampRoamPosition(a.x + safeDx * push, a.z + safeDz * push);
            const pushedB = clampRoamPosition(b.x - safeDx * push, b.z - safeDz * push);

            a.x = pushedA.x;
            a.z = pushedA.z;
            b.x = pushedB.x;
            b.z = pushedB.z;
            a.crowding = Math.max(a.crowding, overlapRatio);
            b.crowding = Math.max(b.crowding, overlapRatio);
          }
        }

        desiredPositions.forEach((point) => {
          if (point.crowding <= 0) return;

          const settle = 0.42 + (1 - point.crowding) * 0.2;
          const relaxedX = point.targetX + (point.x - point.targetX) * settle;
          const relaxedZ = point.targetZ + (point.z - point.targetZ) * settle;
          const relaxed = clampRoamPosition(relaxedX, relaxedZ);
          point.x = relaxed.x;
          point.z = relaxed.z;
        });

        desiredPositions.forEach((point) => {
          const { entry } = point;
          const constraintPressure = Math.max(point.crowding, point.edgePressure);
          const unconstrainedLinger = point.lingerIntent * (1 - Math.min(1, constraintPressure * 1.35));
          let desiredDx = (point.x - entry.lastX) * (1 - unconstrainedLinger * 0.88);
          let desiredDz = (point.z - entry.lastZ) * (1 - unconstrainedLinger * 0.88);

          if (point.boundaryHitX > 0.02) {
            desiredDz *= 0.22;
            desiredDx *= 0.72;
          }
          if (point.boundaryHitZ > 0.02) {
            desiredDx *= 0.22;
            desiredDz *= 0.72;
          }

          const desiredMagnitude = Math.hypot(desiredDx, desiredDz);
          const previousMagnitude = Math.hypot(entry.lastMoveX, entry.lastMoveZ);
          const directionDot =
            desiredMagnitude > 0.0001 && previousMagnitude > 0.0001
              ? (desiredDx * entry.lastMoveX + desiredDz * entry.lastMoveZ) / (desiredMagnitude * previousMagnitude)
              : 1;
          const turnSharpness = Math.max(0, (0.35 - directionDot) / 1.35);
          const boundaryDrag = Math.max(point.boundaryHitX, point.boundaryHitZ) > 0.02 ? 0.22 : 0;
          const hesitation = Math.max(turnSharpness, constraintPressure * 0.72, unconstrainedLinger * 0.64, boundaryDrag);
          const baseBlend = constraintPressure > 0.18 ? 5.0 : 7.2;
          const moveBlend = Math.min(1, delta * baseBlend * (1 - hesitation * 0.46));
          const appliedX = entry.lastX + desiredDx * moveBlend;
          const appliedZ = entry.lastZ + desiredDz * moveBlend;

          point.x = appliedX;
          point.z = appliedZ;
          point.edgePressure = constraintPressure;
          point.hesitation = hesitation;
        });

        desiredPositions.forEach(({ entry, x, z, edgePressure, crowding, hesitation = 0, lingerIntent = 0 }) => {
          const dx = x - entry.lastX;
          const dz = z - entry.lastZ;
          const movementMagnitude = Math.hypot(dx, dz);
          const moving = movementMagnitude > 0.004 + hesitation * 0.004 + lingerIntent * 0.006;
          const strideAmount = Math.min(0.52, 0.18 + movementMagnitude * 22 * entry.strideBoost);

          entry.group.position.x = x;
          entry.group.position.z = z;
          entry.group.position.y = 0;

          if (moving) {
            const facing = Math.atan2(dx, dz) + CHARACTER_FORWARD_OFFSET;
            const constrainedTurn = Math.max(edgePressure, crowding);
            const turnBlend = Math.min(1, delta * entry.turnRate * (constrainedTurn > 0.18 ? 0.78 : 1.18) * (1 - hesitation * 0.18));
            entry.group.rotation.y = lerpAngle(entry.group.rotation.y, facing, turnBlend);
          }

          entry.lastX = x;
          entry.lastZ = z;
          entry.lastMoveX = dx;
          entry.lastMoveZ = dz;

          const gaitLift = moving ? Math.max(0, Math.sin(elapsed * (entry.bobSpeed * 1.86) + entry.phase * 1.2)) * (0.014 + strideAmount * 0.018) : 0;
          const bodyStride = moving ? Math.sin(elapsed * (entry.bobSpeed * 0.98) + entry.phase) * (0.014 + strideAmount * 0.018) : 0;
          const idleShift = !moving ? Math.sin(elapsed * (0.72 + entry.lingerRate) + entry.lingerPhase) * 0.003 : 0;
          const forwardLean = moving ? Math.sin(elapsed * (entry.bobSpeed * 1.12) + entry.phase) * entry.lateralSway * 0.18 : 0;

          entry.actor.position.x = idleShift;
          entry.actor.position.y = Math.sin(elapsed * entry.bobSpeed + entry.phase) * entry.bobAmount + gaitLift + (moving ? 0.015 : 0.004);
          entry.actor.position.z = bodyStride + forwardLean;
          entry.actor.rotation.x = moving
            ? 0.034 + Math.sin(elapsed * entry.bobSpeed * 2.05 + entry.phase) * 0.021
            : 0.008 + Math.sin(elapsed * 1.5 + entry.phase) * 0.013;
          entry.actor.rotation.y = Math.sin(elapsed * entry.bobSpeed * 0.72 + entry.phase) * (moving ? 0.01 : 0.008);
          entry.actor.rotation.z = moving
            ? Math.sin(elapsed * entry.bobSpeed * 2.5 + entry.phase) * 0.03
            : Math.sin(elapsed * 1.2 + entry.phase) * 0.011;

          if (entry.mixer) {
            if (entry.walkAction && entry.idleAction) {
              entry.walkAction.weight = moving ? 1 : 0;
              entry.idleAction.weight = moving ? 0 : 1;
            }
            entry.mixer.update(delta);
          } else {
            animateProceduralRig(entry, elapsed, moving, strideAmount);
          }

          const bubbleElement = bubbleRefs.current[entry.segment.key];
          if (bubbleElement) {
            entry.bubbleAnchor.getWorldPosition(projectedBubble);
            projectedBubble.project(camera);
            const screenX = (projectedBubble.x * 0.5 + 0.5) * width;
            const screenY = (-projectedBubble.y * 0.5 + 0.5) * height;
            const visible = projectedBubble.z > -1 && projectedBubble.z < 1 && bubbleKeyRef.current === entry.segment.key;
            bubbleElement.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -100%)`;
            bubbleElement.dataset.visible = visible ? "true" : "false";
          }
        });

        renderer.render(scene, camera);
        animationFrame = window.requestAnimationFrame(animate);
      };

      animate();

      const disposeScene = () => {
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener("pointermove", handlePointerMove);
        renderer.domElement.removeEventListener("click", handleClick);
        window.cancelAnimationFrame(animationFrame);
        scene.traverse((child: any) => {
          if (child.geometry) child.geometry.dispose?.();
          if (Array.isArray(child.material)) {
            child.material.forEach((material: any) => material.dispose?.());
          } else {
            child.material?.dispose?.();
          }
        });
        renderer.dispose();
        const parentNode = renderer.domElement.parentNode;
        if (parentNode && parentNode === viewportRef.current) {
          parentNode.removeChild(renderer.domElement);
        }
      };

      cleanupScene = disposeScene;
    };

    void initScene();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      cleanupScene?.();
    };
  }, [onSelect, segments]);

  return (
    <div className="guild-canvas-shell">
      <div className="guild-canvas-viewport" ref={viewportRef} aria-label="3D Segment Guild merchant room" />

      <div className="speech-overlay" aria-hidden="true">
        {segments.map((segment) => (
          <div
            key={segment.key}
            ref={(node) => {
              bubbleRefs.current[segment.key] = node;
            }}
            className={`speech-bubble ${bubbleKey === segment.key ? "is-active" : ""}`}
            data-visible={bubbleKey === segment.key ? "true" : "false"}
          >
            <strong>{segment.label}</strong>
            <span>{segment.speechBubble}</span>
          </div>
        ))}
      </div>

      {loadIssues.length ? (
        <div className="asset-warning-card" role="alert">
          <strong>Asset load issues</strong>
          <ul>
            {loadIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
