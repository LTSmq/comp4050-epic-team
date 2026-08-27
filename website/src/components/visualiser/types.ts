import { Vector3 } from "three";

export type vector3Data = {
  x: number;
  y: number;
  z: number;
};

export interface packingItem {
  uuid: string;
  position: vector3Data;
  size: vector3Data;
}

export interface packingSolution {
  containerSize: vector3Data;
  items: packingItem[];
}

export function toVector3(vector: vector3Data): Vector3 {
  return new Vector3(vector.x, vector.y, vector.z);
}

export function calculateCenter(position: vector3Data, size: vector3Data): Vector3 {
  return toVector3(position).add(toVector3(size).divideScalar(2));
}
