"use client";

import { useEffect, useRef } from "react";

interface SegmentCardAvatarProps {
  asset: string;
  textureOverride?: string;
  accent: string;
  characterHeight: number;
  label: string;
}

interface AvatarRigJoint {
  bone: any;
  baseX: number;
  baseY: number;
  baseZ: number;
}

interface AvatarRig {
  armMeshL?: AvatarRigJoint;
  armMeshR?: AvatarRigJoint;
}

function hashLabel(label: string) {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function makeJoint(bone: any): AvatarRigJoint {
  return {
    bone,
    baseX: bone.rotation.x,
    baseY: bone.rotation.y,
    baseZ: bone.rotation.z,
  };
}

function captureNamedNode(root: any, patterns: RegExp[]) {
  let found: any = null;
  root.traverse((node: any) => {
    if (found) return;
    const name = String(node.name ?? "");
    if (patterns.some((pattern) => pattern.test(name))) {
      found = node;
    }
  });
  return found ? makeJoint(found) : undefined;
}

function buildAvatarRig(root: any): AvatarRig {
  return {
    armMeshL: captureNamedNode(root, [/_ArmLeft$/i, /ArmLeft$/i]),
    armMeshR: captureNamedNode(root, [/_ArmRight$/i, /ArmRight$/i]),
  };
}

function getMotionProfile(label: string) {
  switch (label) {
    case "Champions":
      return { bobSpeed: 2.6, bobAmount: 0.045, bodyTurnSpeed: 1.16, bodyTurnAmount: 0.11, torsoTiltSpeed: 1.5, torsoTiltAmount: 0.048, armSpeed: 2.85, shoulderSwingAmount: 0.145, swaySpeed: 1.34, swayAmount: 0.048, torsoYawAmount: 0.048 };
    case "At-Risk VIPs":
      return { bobSpeed: 2.4, bobAmount: 0.041, bodyTurnSpeed: 1.06, bodyTurnAmount: 0.102, torsoTiltSpeed: 1.38, torsoTiltAmount: 0.043, armSpeed: 2.62, shoulderSwingAmount: 0.132, swaySpeed: 1.22, swayAmount: 0.042, torsoYawAmount: 0.042 };
    case "Sleeping Giants":
      return { bobSpeed: 2.12, bobAmount: 0.034, bodyTurnSpeed: 0.92, bodyTurnAmount: 0.084, torsoTiltSpeed: 1.18, torsoTiltAmount: 0.034, armSpeed: 2.24, shoulderSwingAmount: 0.112, swaySpeed: 1.04, swayAmount: 0.032, torsoYawAmount: 0.032 };
    case "New Momentum":
      return { bobSpeed: 3.36, bobAmount: 0.056, bodyTurnSpeed: 1.42, bodyTurnAmount: 0.132, torsoTiltSpeed: 1.86, torsoTiltAmount: 0.058, armSpeed: 3.46, shoulderSwingAmount: 0.17, swaySpeed: 1.62, swayAmount: 0.058, torsoYawAmount: 0.058 };
    case "Drifting Occasionals":
      return { bobSpeed: 3.18, bobAmount: 0.052, bodyTurnSpeed: 1.36, bodyTurnAmount: 0.126, torsoTiltSpeed: 1.76, torsoTiltAmount: 0.054, armSpeed: 3.4, shoulderSwingAmount: 0.168, swaySpeed: 1.54, swayAmount: 0.06, torsoYawAmount: 0.06 };
    case "Long-tail Dormant":
      return { bobSpeed: 2.94, bobAmount: 0.048, bodyTurnSpeed: 1.24, bodyTurnAmount: 0.116, torsoTiltSpeed: 1.62, torsoTiltAmount: 0.05, armSpeed: 3.1, shoulderSwingAmount: 0.154, swaySpeed: 1.44, swayAmount: 0.052, torsoYawAmount: 0.052 };
    case "Loyal Core":
      return { bobSpeed: 2.82, bobAmount: 0.046, bodyTurnSpeed: 1.2, bodyTurnAmount: 0.112, torsoTiltSpeed: 1.54, torsoTiltAmount: 0.048, armSpeed: 2.98, shoulderSwingAmount: 0.148, swaySpeed: 1.36, swayAmount: 0.05, torsoYawAmount: 0.048 };
    case "Warming Up":
      return { bobSpeed: 2.62, bobAmount: 0.043, bodyTurnSpeed: 1.12, bodyTurnAmount: 0.106, torsoTiltSpeed: 1.46, torsoTiltAmount: 0.044, armSpeed: 2.82, shoulderSwingAmount: 0.14, swaySpeed: 1.28, swayAmount: 0.046, torsoYawAmount: 0.044 };
    case "Cold Repeaters":
      return { bobSpeed: 2.46, bobAmount: 0.04, bodyTurnSpeed: 1.04, bodyTurnAmount: 0.098, torsoTiltSpeed: 1.34, torsoTiltAmount: 0.041, armSpeed: 2.58, shoulderSwingAmount: 0.128, swaySpeed: 1.16, swayAmount: 0.041, torsoYawAmount: 0.04 };
    default:
      return { bobSpeed: 2.72, bobAmount: 0.044, bodyTurnSpeed: 1.16, bodyTurnAmount: 0.11, torsoTiltSpeed: 1.48, torsoTiltAmount: 0.046, armSpeed: 2.92, shoulderSwingAmount: 0.144, swaySpeed: 1.32, swayAmount: 0.048, torsoYawAmount: 0.046 };
  }
}

export function SegmentCardAvatar({ asset, textureOverride, accent, characterHeight, label }: SegmentCardAvatarProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let renderer: any = null;
    let cleanupModel: (() => void) | null = null;

    if (!viewportRef.current) return;

    const init = async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");

      if (disposed || !viewportRef.current) return;

      const createVisualArm = (side: "left" | "right", scaleFactor: number) => {
        const sideSign = side === "left" ? -1 : 1;
        const shoulder = new THREE.Group();
        shoulder.position.set(sideSign * 0.22 * scaleFactor, 0.78 * scaleFactor, -0.01 * scaleFactor);

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

        return { shoulder, lowerPivot, handPivot };
      };

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
      camera.position.set(0, 1.5, 6.4);
      camera.lookAt(0, 1.02, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      viewportRef.current.appendChild(renderer.domElement);

      const ambient = new THREE.HemisphereLight(0xfbf4df, 0x2d3748, 1.55);
      scene.add(ambient);

      const keyLight = new THREE.DirectionalLight(0xffe2b0, 1.45);
      keyLight.position.set(2.6, 4.2, 4.6);
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(new THREE.Color(accent), 0.55);
      rimLight.position.set(-3.4, 2.8, 3.1);
      scene.add(rimLight);

      const loader = new GLTFLoader();
      const textureLoader = new THREE.TextureLoader();

      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(asset, resolve, undefined, reject);
      });

      if (disposed) return;

      const actor = gltf.scene;
      const overrideTexture = textureOverride
        ? await new Promise<any>((resolve, reject) => {
            textureLoader.load(textureOverride, resolve, undefined, reject);
          }).catch(() => null)
        : null;

      if (overrideTexture) {
        overrideTexture.flipY = false;
        overrideTexture.colorSpace = THREE.SRGBColorSpace;
      }

      actor.traverse((child: any) => {
        if (!child.isMesh) return;
        child.castShadow = false;
        child.receiveShadow = false;
        child.frustumCulled = false;

        const nextMaterial = Array.isArray(child.material)
          ? child.material.map((material: any) => material.clone())
          : child.material?.clone?.() ?? new THREE.MeshStandardMaterial({ color: 0xffffff });

        const applyToMaterial = (material: any) => {
          if (!material) return;
          material.color = material.color?.clone?.() ?? new THREE.Color(0xffffff);
          material.roughness = 0.95;
          material.metalness = 0.02;
          if (overrideTexture) {
            material.map = overrideTexture;
            material.needsUpdate = true;
          }
        };

        if (Array.isArray(nextMaterial)) {
          nextMaterial.forEach(applyToMaterial);
        } else {
          applyToMaterial(nextMaterial);
        }

        child.material = nextMaterial;
      });

      const rig = buildAvatarRig(actor);
      if (rig.armMeshL?.bone) rig.armMeshL.bone.visible = false;
      if (rig.armMeshR?.bone) rig.armMeshR.bone.visible = false;

      const armScale = Math.max(0.9, characterHeight / 1.1);
      const visualArmL = createVisualArm("left", armScale);
      const visualArmR = createVisualArm("right", armScale);
      actor.add(visualArmL.shoulder);
      actor.add(visualArmR.shoulder);

      const actorRoot = new THREE.Group();
      actorRoot.add(actor);
      scene.add(actorRoot);

      const box = new THREE.Box3().setFromObject(actorRoot);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      actor.position.sub(center);
      actor.position.y -= box.min.y;

      const baseScale = (3.18 / Math.max(size.y, 0.01)) * Math.max(0.97, characterHeight / 1.08);
      actorRoot.scale.setScalar(baseScale);
      actorRoot.position.set(0, 0, 0);

      const alignedBox = new THREE.Box3().setFromObject(actorRoot);
      const alignedSize = alignedBox.getSize(new THREE.Vector3());
      const alignedCenter = alignedBox.getCenter(new THREE.Vector3());
      actor.position.x -= alignedCenter.x;
      actor.position.z -= alignedCenter.z;
      actor.position.y -= alignedCenter.y - alignedSize.y * 0.5;

      const fitCharacter = () => {
        const fitBox = new THREE.Box3().setFromObject(actorRoot);
        const fitSize = fitBox.getSize(new THREE.Vector3());
        const fitCenter = fitBox.getCenter(new THREE.Vector3());
        const verticalFov = (camera.fov * Math.PI) / 180;
        const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
        const halfHeight = fitSize.y * 0.485;
        const halfWidth = fitSize.x * 0.53;
        const distanceV = halfHeight / Math.tan(verticalFov / 2);
        const distanceH = halfWidth / Math.tan(horizontalFov / 2);
        const distance = Math.max(distanceV, distanceH) + fitSize.z * 0.56 + 0.06;
        const frameOffsetX = -fitSize.x * 0.07;
        const frameOffsetY = fitSize.y * 0.015;
        camera.position.set(fitCenter.x + frameOffsetX * 0.18, fitCenter.y + frameOffsetY * 0.18, distance);
        camera.lookAt(fitCenter.x + frameOffsetX, fitCenter.y + frameOffsetY, fitCenter.z);
      };

      const labelHash = hashLabel(label);
      const phase = (labelHash % 628) / 100;
      const swayPhase = ((labelHash >> 4) % 628) / 100;
      const baseY = actorRoot.position.y;
      const motion = getMotionProfile(label);
      const motionBoost = 1.5;

      const resize = () => {
        if (!viewportRef.current || !renderer) return;
        const width = viewportRef.current.clientWidth;
        const height = viewportRef.current.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        fitCharacter();
      };

      resize();
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(viewportRef.current);

      const animate = () => {
        if (disposed) return;
        const elapsed = performance.now() * 0.001;
        const armCycle = elapsed * motion.armSpeed + phase;
        const swayCycle = elapsed * motion.swaySpeed + swayPhase;
        const shoulderNeutral = -0.26;
        const shoulderSwing = motion.shoulderSwingAmount * motionBoost * Math.sin(armCycle);
        const shoulderRoll = 0.74 + Math.sin(armCycle * 0.45 + phase) * (0.042 * motionBoost);
        const lowerFollowL = 0.38 + Math.max(0, Math.sin(armCycle - 0.18)) * (0.29 * motionBoost);
        const lowerFollowR = 0.38 + Math.max(0, Math.sin(armCycle + Math.PI - 0.18)) * (0.29 * motionBoost);
        const handFollowL = -0.05 + Math.sin(armCycle - 0.36) * (0.095 * motionBoost);
        const handFollowR = -0.05 + Math.sin(armCycle + Math.PI - 0.36) * (0.095 * motionBoost);
        const handDriftL = Math.sin(armCycle * 0.58 + swayPhase) * (0.11 * motionBoost);
        const handDriftR = Math.sin(armCycle * 0.58 + swayPhase + Math.PI * 0.9) * (0.11 * motionBoost);
        const handRollL = 0.04 + Math.sin(armCycle * 0.72 + phase) * (0.055 * motionBoost);
        const handRollR = -0.04 + Math.sin(armCycle * 0.72 + phase + Math.PI * 0.92) * (0.055 * motionBoost);

        actorRoot.position.x = Math.sin(swayCycle) * (motion.swayAmount * 0.24);
        actorRoot.position.y = baseY + Math.sin(elapsed * motion.bobSpeed + phase) * (motion.bobAmount * 0.9) + Math.sin(swayCycle * 0.7) * 0.006;
        actorRoot.rotation.y = Math.sin(elapsed * motion.bodyTurnSpeed + phase) * (motion.bodyTurnAmount * motionBoost) + Math.sin(swayCycle * 0.8) * (motion.torsoYawAmount * motionBoost);
        actor.rotation.x = 0.012 + Math.sin(elapsed * motion.torsoTiltSpeed * 0.82 + phase) * (0.022 * motionBoost);
        actor.rotation.y = Math.sin(swayCycle * 1.08) * (motion.torsoYawAmount * 1.44);
        actor.rotation.z = Math.sin(elapsed * motion.torsoTiltSpeed + phase) * (motion.torsoTiltAmount * motionBoost) + Math.sin(swayCycle * 1.18) * 0.036;
        visualArmL.shoulder.rotation.set(shoulderNeutral + shoulderSwing, 0.05, shoulderRoll);
        visualArmR.shoulder.rotation.set(shoulderNeutral - shoulderSwing, -0.05, -shoulderRoll);
        visualArmL.lowerPivot.rotation.x = lowerFollowL;
        visualArmR.lowerPivot.rotation.x = lowerFollowR;
        visualArmL.handPivot.rotation.x = handFollowL;
        visualArmR.handPivot.rotation.x = handFollowR;
        visualArmL.handPivot.rotation.y = handDriftL;
        visualArmR.handPivot.rotation.y = handDriftR;
        visualArmL.handPivot.rotation.z = handRollL;
        visualArmR.handPivot.rotation.z = handRollR;

        renderer.render(scene, camera);
        frame = window.requestAnimationFrame(animate);
      };

      animate();

      cleanupModel = () => {
        actorRoot.traverse((child: any) => {
          if (child.geometry?.dispose) child.geometry.dispose();
          const material = child.material;
          if (Array.isArray(material)) {
            material.forEach((entry) => entry?.dispose?.());
          } else {
            material?.dispose?.();
          }
        });
      };
    };

    init().catch((error) => {
      console.error(`Failed to load segment card avatar for ${label}`, error);
    });

    return () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      cleanupModel?.();
      renderer?.dispose?.();
      if (renderer?.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [accent, asset, characterHeight, label, textureOverride]);

  return <div ref={viewportRef} className="segment-card-avatar-viewport" aria-hidden="true" />;
}
