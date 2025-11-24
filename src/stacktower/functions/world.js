import * as THREE from "three";

import { box } from "./box";
import { lights } from "./lights";
import { userInput } from "./userInput";
import { overhangBox } from "./overhangBox";
import { physics } from "./physics";
import { distortionPlane } from "./distortionPlane";
import { particles } from "./particles";

export const world = ({ appProps, appObj, loseEmitter }) => {
  const container = new THREE.Object3D();
  container.matrixAutoUpdate = false;

  const gameSetup = {
    gameState: appProps.gameState,
    BOX_HEIGHT: 0.8,
    ORIGINAL_BOX_SIZE: 3,
    stack: [],
    overhangs: [],
    particles: [],
  };

  const { cannonWorld } = physics({ appObj });

  const {
    animateProgress: animatePlaneProgress,
    container: distortionPlaneContainer,
  } = distortionPlane({ appObj });

  const { destroyBoxes, generateBox, addLayer, container: boxContainer } = box({
    gameSetup,
    cannonWorld,
    appObj,
  });

  const { addOverhang } = overhangBox({ generateBox, gameSetup });

  const {
    clearParticles,
    generateParticles,
    destroy: destroyParticles,
    container: particlesContainer,
  } = particles({ appObj, gameSetup });

  const { initGame, destroy: destroyUserInput } = userInput({
    clearParticles,
    generateParticles,
    animatePlaneProgress,
    destroyBoxes,
    cannonWorld,
    appObj,
    appProps,
    gameSetup,
    addLayer,
    addOverhang,
    loseEmitter,
  });

  const { container: lightsContainer } = lights();

  container.add(boxContainer);
  container.add(lightsContainer);
  container.add(particlesContainer);
  container.add(distortionPlaneContainer);

  const destroy = () => {
    destroyParticles();
    destroyUserInput();
  };

  return {
    container,
    destroy,
    initGame,
    onLose: loseEmitter,
  };
};
