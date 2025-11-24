import * as THREE from "three";

export const particles = ({ appObj, gameSetup }) => {
  const container = new THREE.Object3D();

  const destroy = () => {
    while (container.children.length) {
      const child = container.children.pop();
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
  };

  const clearParticles = () => {
    destroy();
    gameSetup.particles = [];
  };

  const generateParticles = ({ y, count }) => {
    const group = new THREE.Group();
    for (let i = 0; i < count; i += 1) {
      // Smaller, more subtle particles
      const geom = new THREE.SphereGeometry(0.04, 4, 4); // Smaller size (0.04 vs 0.08)
      const mat = new THREE.MeshBasicMaterial({ 
        color: 0xffffff,
        transparent: true,
        opacity: 0.4 // Start semi-transparent
      });
      const m = new THREE.Mesh(geom, mat);
      m.position.set(
        (Math.random() - 0.5) * 1.5, // Tighter spread
        y + Math.random() * 1.2,
        (Math.random() - 0.5) * 1.5
      );
      group.add(m);
    }
    container.add(group);
    return group;
  };

  return {
    container,
    generateParticles,
    clearParticles,
    destroy,
  };
};
