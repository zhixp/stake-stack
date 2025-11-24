import * as THREE from "three";

export const overhangBox = ({ generateBox, gameSetup }) => {
  const container = new THREE.Object3D();
  container.matrixAutoUpdate = false;

  const addOverhang = ({ x, z, width, depth }) => {
    const y = gameSetup.BOX_HEIGHT * (gameSetup.stack.length - 1);
    const overhang = generateBox(x, y, z, width, depth, true);
    gameSetup.overhangs.push(overhang);
  };

  return {
    addOverhang,
  };
};
