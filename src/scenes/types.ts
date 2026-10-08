import type { Group, Vector3 } from 'three';

export interface CollectibleSpot {
  position: Vector3;
  name: string;
  message: string;
}

export interface Landscape {
  group: Group;
  collectibles: CollectibleSpot[];
  update: (elapsed: number, delta: number) => void;
  heightAt?: (x: number, z: number) => number;
  view?: {
    position: Vector3;
    target: Vector3;
    fov?: number;
    minDistance?: number;
    maxDistance?: number;
    azimuthRange?: number;
    polarRange?: number;
  };
  atmosphere?: {
    fogColor: number;
    fogDensity: number;
    sunPosition: Vector3;
    sunColor?: number;
    sunIntensity?: number;
    exposure?: number;
    skyRotation?: number;
  };
}
