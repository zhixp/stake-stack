import * as THREE from "three";
import * as dat from "dat.gui";
import TWEEN from "@tweenjs/tween.js";

import AppTime from "./utils/AppTime";
import { world } from "./world";

export const CAMERA_POS = 6;

// Simple pub/sub for game over events
class LoseEmitter {
  constructor() {
    this.handlers = new Set();
  }
  subscribe(fn) {
    this.handlers.add(fn);
  }
  unsubscribe(fn) {
    this.handlers.delete(fn);
  }
  emit(score) {
    for (const fn of this.handlers) fn(score);
  }
}

export const application = (appProps) => {
  const appObj = {
    appTime: new AppTime(),
    camera: null,
    scene: null,
    renderer: null,
    sizes: null,
    config: { showDebugGui: false },
    debugGUI: null,
    backgroundColor: 1,
    baseColor: 1,
    colorMultiplier: 10,
  };

  const loseEmitter = new LoseEmitter();

  const setCamera = () => {
    const aspectRatio = appObj.sizes.width / appObj.sizes.height;
    appObj.camera = new THREE.OrthographicCamera(
      -1 * aspectRatio,
      1 * aspectRatio,
      1,
      -1,
      0.1,
      100
    );

    updateCameraSettings();

    appObj.camera.position.set(CAMERA_POS, CAMERA_POS, CAMERA_POS);
    appObj.camera.lookAt(0, 0, 0);
  };

  const updateCameraSettings = () => {
    const aspectRatio = appObj.sizes.width / appObj.sizes.height;

    const distance = CAMERA_POS;
    appObj.camera.left = (aspectRatio / -1) * distance;
    appObj.camera.right = (aspectRatio / 1) * distance;
    appObj.camera.top = 1 * distance;
    appObj.camera.bottom = -1 * distance;

    appObj.camera.updateProjectionMatrix();
  };

  const setRenderer = () => {
    appObj.scene = new THREE.Scene();

    appObj.renderer = new THREE.WebGLRenderer({
      canvas: appProps.canvasRefEl,
      antialias: false,
      alpha: true,
    });

    appObj.renderer.shadowMap.enabled = true;
    appObj.renderer.outputEncoding = THREE.sRGBEncoding;
    appObj.renderer.setClearColor(new THREE.Color(`hsl(${appObj.backgroundColor}, 40%,80%)`));
    appObj.renderer.physicallyCorrectLights = true;
  };

  const setSizes = () => {
    appObj.sizes = appProps.canvasWrapperRefEl.getBoundingClientRect();
  };

  const onResize = () => {
    setSizes();
    appObj.renderer.setSize(appObj.sizes.width, appObj.sizes.height);
    appObj.renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio, 1.5), 2));

    updateCameraSettings();
  };

  const onVisibilityChange = () => {
    if (document.hidden) {
      appObj.appTime.stop();
    } else {
      appObj.appTime.resume();
    }
  };

  // Anti-cheat: Random camera jitter to throw off screen-reading bots
  let jitterSeed = Math.random() * 1000;
  let jitterX = 0;
  let jitterY = 0;
  let jitterZ = 0;
  const JITTER_AMPLITUDE = 0.008; // Very subtle - humans won't notice
  const JITTER_SPEED = 0.003;
  let cameraTargetY = CAMERA_POS; // Track camera target Y for jitter offset

  const setListeners = () => {
    window.addEventListener("resize", onResize);
    window.addEventListener("visibilitychange", onVisibilityChange);

    appObj.appTime.on("tick", (_slowDownFactor, time, _delta) => {
      TWEEN.update(time);
      
      // Apply random camera jitter for anti-cheat (relative to current camera position)
      // Uses multiple sine waves with different frequencies to make it unpredictable
      const t = time * JITTER_SPEED + jitterSeed;
      jitterX = Math.sin(t * 1.7) * JITTER_AMPLITUDE + Math.cos(t * 2.3) * JITTER_AMPLITUDE * 0.5;
      jitterY = Math.sin(t * 1.3) * JITTER_AMPLITUDE + Math.cos(t * 1.9) * JITTER_AMPLITUDE * 0.5;
      jitterZ = Math.sin(t * 2.1) * JITTER_AMPLITUDE + Math.cos(t * 1.5) * JITTER_AMPLITUDE * 0.5;
      
      // Apply jitter relative to current camera position
      // Camera Y is managed by userInput.js, we just add subtle jitter on top
      const currentCameraY = appObj.camera.position.y;
      const currentJitterY = Math.sin(t * 1.3) * JITTER_AMPLITUDE + Math.cos(t * 1.9) * JITTER_AMPLITUDE * 0.5;
      
      // Store base position (without jitter) for X and Z, add jitter to Y
      appObj.camera.position.x = CAMERA_POS + jitterX;
      appObj.camera.position.y = currentCameraY + currentJitterY - jitterY; // Add new jitter, remove old
      appObj.camera.position.z = CAMERA_POS + jitterZ;
      jitterY = currentJitterY; // Update for next frame
      
      // LookAt follows tower center (camera Y - CAMERA_POS gives tower height)
      const towerCenterY = currentCameraY - CAMERA_POS;
      appObj.camera.lookAt(0 + jitterX * 0.3, towerCenterY + currentJitterY * 0.3, 0 + jitterZ * 0.3);
      
      appObj.renderer.render(appObj.scene, appObj.camera);
    });
  };

  const setWorld = () => {
    const { initGame, destroy, container, onLose } = world({ appObj, appProps, loseEmitter });
    appObj.scene.add(container);
    return { destroy, initGame, onLose };
  };

  const setConfig = () => {
    appObj.config.showDebugGui = window.location.hash === "#debug";
  };

  const setDebug = () => {
    if (appObj.config.showDebugGui) {
      appObj.debugGUI = new dat.GUI({ width: 420 });
    }
  };

  const destroy = () => {
    destroySetWorld();
    appObj.appTime.stop();
    appObj.debugGUI && appObj.debugGUI.destroy();
    appObj.renderer.dispose();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("visibilitychange", onVisibilityChange);
  };

  setSizes();
  setCamera();
  setRenderer();
  onResize();
  setConfig();
  setDebug();
  const { initGame, destroy: destroySetWorld, onLose } = setWorld();
  setListeners();
  appProps.setIsReady(true);

  return { destroy, initGame, onLose: loseEmitter };
};

export default application;
