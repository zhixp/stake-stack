import * as THREE from "three";

export const lights = () => {
  const container = new THREE.Object3D();

  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  container.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(10, 20, 10);
  dir.castShadow = true;
  container.add(dir);

  return { container };
};
