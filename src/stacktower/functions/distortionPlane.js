import * as THREE from "three";

export const distortionPlane = ({ appObj }) => {
  const container = new THREE.Object3D();

  const geometry = new THREE.PlaneGeometry(40, 40, 1, 1);
  const material = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.0,
  });
  const plane = new THREE.Mesh(geometry, material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -10;

  container.add(plane);

  const animateProgress = (_value) => {
    // no-op placeholder; original used custom shaders
  };

  return { container, animateProgress };
};
