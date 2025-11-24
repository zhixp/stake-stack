import TWEEN from "@tweenjs/tween.js";
import * as CANNON from "cannon-es";
import * as THREE from "three";

import { CAMERA_POS } from "./application";

export const userInput = ({
  clearParticles,
  generateParticles,
  animatePlaneProgress,
  destroyBoxes,
  addOverhang,
  addLayer,
  appObj,
  gameSetup,
  appProps,
  cannonWorld,
  loseEmitter,
}) => {
  const { appTime, camera } = appObj;

  let tweenEnterBox;
  let tweenCamera;
  let tweenScaleUp;
  let tweenBackgroundColor;

  // === ANTI-CHEAT: Human Jitter Detection ===
  const clickHistory = [];
  const CLICK_HISTORY_SIZE = 10;
  let suspiciousClickCount = 0;
  let gameStartTime = null;
  
  const recordClickForAntiCheat = (event) => {
    if (!gameStartTime) gameStartTime = Date.now();
    
    const clickData = {
      timestamp: Date.now(),
      x: event.clientX || (event.touches && event.touches[0]?.clientX) || 0,
      y: event.clientY || (event.touches && event.touches[0]?.clientY) || 0,
    };
    
    clickHistory.push(clickData);
    if (clickHistory.length > CLICK_HISTORY_SIZE) {
      clickHistory.shift();
    }
    
    // Detect bot patterns: perfect timing, perfect positioning
    if (clickHistory.length >= 5) {
      const recent = clickHistory.slice(-5);
      const intervals = [];
      const positions = [];
      
      for (let i = 1; i < recent.length; i++) {
        intervals.push(recent[i].timestamp - recent[i-1].timestamp);
        const dx = recent[i].x - recent[i-1].x;
        const dy = recent[i].y - recent[i-1].y;
        positions.push(Math.sqrt(dx * dx + dy * dy));
      }
      
      // Check for perfect timing (variance too low = bot)
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const intervalVariance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
      
      // Check for perfect positioning (no mouse movement = bot clicking same spot)
      const avgPosition = positions.reduce((a, b) => a + b, 0) / positions.length;
      const positionVariance = positions.reduce((sum, val) => sum + Math.pow(val - avgPosition, 2), 0) / positions.length;
      
      // Human jitter: intervals vary by at least 50ms, positions vary by at least 5px
      if (intervalVariance < 2500 || positionVariance < 25) {
        suspiciousClickCount++;
        console.warn('Suspicious click pattern detected:', { intervalVariance, positionVariance, suspiciousClickCount });
      } else {
        suspiciousClickCount = Math.max(0, suspiciousClickCount - 1); // Reset if human-like
      }
    }
  };

  const handleClick = (event) => {
    if (gameSetup.gameState !== "playing") {
      return;
    }

    // Record click for anti-cheat analysis
    recordClickForAntiCheat(event);
    
    // If too many suspicious clicks, silently reject (shadow ban)
    if (suspiciousClickCount > 3) {
      console.warn('Bot detected - shadow banning');
      // Don't process the click, but don't tell the user
      return;
    }

    const topLayer = gameSetup.stack[gameSetup.stack.length - 1];
    const previousLayer = gameSetup.stack[gameSetup.stack.length - 2];

    const direction = topLayer.direction;

    const delta =
      topLayer.threejs.position[direction] - previousLayer.threejs.position[direction];

    const overhangSize = Math.abs(delta);

    const size = direction === "x" ? topLayer.width : topLayer.depth;

    const overlap = size - overhangSize;

    if (overlap > 0) {
      appProps.setPoint((prev) => prev + 1);
      // Cut layer
      const newWidth = direction === "x" ? overlap : topLayer.width;
      const newDepth = direction === "z" ? overlap : topLayer.depth;

      const oldVal = topLayer.width * topLayer.depth;
      const newVal = newWidth * newDepth;
      const startVal = gameSetup.ORIGINAL_BOX_SIZE * gameSetup.ORIGINAL_BOX_SIZE;

      const restArea = (oldVal - newVal) / startVal;

      cutBox(topLayer, overlap, size, delta, restArea);

      // Overhang
      const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
      const overhangX =
        direction === "x"
          ? topLayer.threejs.position.x + overhangShift
          : topLayer.threejs.position.x;
      const overhangZ =
        direction === "z"
          ? topLayer.threejs.position.z + overhangShift
          : topLayer.threejs.position.z;
      const overhangWidth = direction === "x" ? overhangSize : topLayer.width;
      const overhangDepth = direction === "z" ? overhangSize : topLayer.depth;

      addOverhang({
        x: overhangX,
        z: overhangZ,
        width: overhangWidth,
        depth: overhangDepth,
      });

      // Next layer
      const nextX = direction === "x" ? topLayer.threejs.position.x : -8;
      const nextZ = direction === "z" ? topLayer.threejs.position.z : -8;
      const nextDirection = direction === "x" ? "z" : "x";

      addLayer({
        x: nextX,
        z: nextZ,
        width: newWidth,
        depth: newDepth,
        direction: nextDirection,
      });
      // Continuously update camera to follow top block
      animateCamera();
      animateBackgroundColor();
      animateEnterBox(gameSetup.stack.length - 1);
      
      // Also update camera in the tick loop for smooth following
      // This ensures camera stays focused even between block placements
    } else {
      // Game over
      const finalScore = appProps.point;
      const gameDuration = gameStartTime ? Date.now() - gameStartTime : 0;
      
      console.log('Game Over! Final score:', finalScore, 'Duration:', gameDuration, 'ms');
      console.log('Suspicious clicks:', suspiciousClickCount);
      
      // Additional anti-cheat: Check if score is humanly possible
      const minTimePerBlock = 200; // Minimum 200ms per block (human reaction time)
      const minExpectedTime = finalScore * minTimePerBlock;
      
      if (gameDuration < minExpectedTime && finalScore > 10) {
        console.warn('Score rejected: Too fast for human', { gameDuration, minExpectedTime, finalScore });
        // Shadow ban - don't emit score
        return;
      }
      
      if (suspiciousClickCount > 3) {
        console.warn('Score rejected: Bot detected');
        // Shadow ban - don't emit score
        return;
      }
      
      if (loseEmitter && finalScore > 0) {
        loseEmitter.emit(finalScore || 0);
        console.log('Score emitted to loseEmitter:', finalScore);
      } else {
        console.warn('Score not emitted:', { loseEmitter: !!loseEmitter, finalScore });
      }

      gameSetup.gameState = "animating";
      appProps.setGameState("animating");
      animateCameraDown();
      setTimeout(() => {
        animatePlaneProgress(0);

        setTimeout(() => {
          animateInitBackground();
          gameSetup.gameState = "readyToStart";
          appProps.setGameState("readyToStart");
        }, 800);
      }, gameSetup.stack.length * 40);
    }
  };

  const cutBox = (topLayer, overlap, size, delta, restArea) => {
    const direction = topLayer.direction;
    const newWidth = direction === "x" ? overlap : topLayer.width;
    const newDepth = direction === "z" ? overlap : topLayer.depth;

    // Update metadata
    topLayer.width = newWidth;
    topLayer.depth = newDepth;

    // Update ThreeJS model
    topLayer.threejs.scale[direction] = overlap / size;
    topLayer.threejs.position[direction] -= delta / 2;

    // Update CannonJS model
    topLayer.cannonjs.position[direction] -= delta / 2;

    const shape = new CANNON.Box(
      new CANNON.Vec3(newWidth / 2, gameSetup.BOX_HEIGHT / 2, newDepth / 2)
    );
    topLayer.cannonjs.shapes = [];
    topLayer.cannonjs.addShape(shape);

    // Reduced particle count for cleaner look (was 800, now max 30)
    // Particles disabled - removed for cleaner look
    // const count = Math.floor(30 * restArea);
    // const newParticle = generateParticles({
    //   y: gameSetup.BOX_HEIGHT * (gameSetup.stack.length - 1),
    //   count: count,
    // });
    // gameSetup.particles.push(newParticle);
  };

  const scaleDownBox = (layerObject) => {
    const scaleDownBoxTween = new TWEEN.Tween(layerObject.threejs.scale)
      .to({ x: 0, y: 0, z: 0 }, 600)
      .easing(TWEEN.Easing.Cubic.In);

    scaleDownBoxTween.start();
  };

  const initGame = () => {
    if (gameSetup.gameState !== "readyToStart") {
      return;
    }

    // Reset anti-cheat tracking
    clickHistory.length = 0;
    suspiciousClickCount = 0;
    gameStartTime = Date.now();

    gameSetup.gameState = "animating";
    appProps.setGameState("animating");

    gameSetup.stack.forEach((_element, key) => {
      scaleDownBox(gameSetup.stack[key]);
    });

    gameSetup.overhangs.forEach((_element, key) => {
      scaleDownBox(gameSetup.overhangs[key]);
    });

    setTimeout(
      () => {
        appProps.setPoint(0);
        gameSetup.gameState = "playing";
        appProps.setGameState("playing");
        animationDirection = 1;
        
        // Reset anti-cheat tracking for new game
        clickHistory.length = 0;
        suspiciousClickCount = 0;
        gameStartTime = Date.now();
        console.log('New game started, score reset to 0');

        destroyBoxes();
        clearParticles();

        // Foundation
        addLayer({
          x: 0,
          z: 0,
          width: gameSetup.ORIGINAL_BOX_SIZE,
          depth: gameSetup.ORIGINAL_BOX_SIZE,
          direction: "z",
        });

        // First layer
        addLayer({
          x: -10,
          z: 0,
          width: gameSetup.ORIGINAL_BOX_SIZE,
          depth: gameSetup.ORIGINAL_BOX_SIZE,
          direction: "x",
        });

        scaleUpBox(0);
        animateCamera();
        animateEnterBox(1);
        animatePlaneProgress(1);
      },
      gameSetup.stack.length === 0 ? 0 : 600
    );
  };

  let animationDirection = 1;

  appTime.on("tick", (slowDownFactor, time) => {
    const speed = 0.15;

    const topLayer = gameSetup.stack[gameSetup.stack.length - 1];

    if (!topLayer) {
      return;
    }

    if (topLayer.threejs.position[topLayer.direction] >= 8) {
      animationDirection = -1;
    }

    if (topLayer.threejs.position[topLayer.direction] <= -8) {
      animationDirection = 1;
    }

    topLayer.threejs.position[topLayer.direction] += speed * slowDownFactor * animationDirection;
    topLayer.cannonjs.position[topLayer.direction] += speed * slowDownFactor * animationDirection;

    // Continuously update camera to follow top block (smooth following)
    if (gameSetup.stack.length > 0 && gameSetup.gameState === "playing") {
      const targetY = gameSetup.BOX_HEIGHT * (gameSetup.stack.length - 1) + CAMERA_POS;
      const currentY = camera.position.y;
      const diff = targetY - currentY;
      
      // Smooth camera follow (lerp)
      if (Math.abs(diff) > 0.1) {
        camera.position.y += diff * 0.05; // Smooth interpolation
      }
    }
    
    // Fade out blocks at the bottom - make them transparent as they go off screen
    const cameraY = camera.position.y;
    const fadeStartDistance = 4; // Start fading 4 units below camera
    const fadeEndDistance = 8; // Fully transparent 8 units below camera
    
    gameSetup.stack.forEach((layer, index) => {
      const layerY = layer.threejs.position.y;
      const distanceBelowCamera = cameraY - CAMERA_POS - layerY;
      
      if (distanceBelowCamera > fadeStartDistance) {
        const fadeProgress = Math.min(1, (distanceBelowCamera - fadeStartDistance) / (fadeEndDistance - fadeStartDistance));
        if (!layer.threejs.material.transparent) {
          layer.threejs.material.transparent = true;
        }
        layer.threejs.material.opacity = Math.max(0, 1 - fadeProgress);
      } else {
        if (layer.threejs.material.transparent) {
          layer.threejs.material.opacity = 1;
        }
      }
    });

    // Copy coordinates from Cannon.js to Three.js
    gameSetup.overhangs.forEach((element) => {
      const positionVec = new THREE.Vector3(
        element.cannonjs.position.x,
        element.cannonjs.position.y,
        element.cannonjs.position.z
      );

      const quaternionVec = new THREE.Quaternion(
        element.cannonjs.quaternion.x,
        element.cannonjs.quaternion.y,
        element.cannonjs.quaternion.z
      );

      element.threejs.position.copy(positionVec);
      element.threejs.quaternion.copy(quaternionVec);
    });
  });

  const animateEnterBox = (layerPosition) => {
    const layerObject = gameSetup.stack[layerPosition];
    layerObject.threejs.material.opacity = 0;
    layerObject.threejs.material.transparent = true;

    tweenEnterBox = new TWEEN.Tween({
      opacity: layerObject.threejs.material.opacity,
    })
      .to({ opacity: 1 }, 1200)
      .easing(TWEEN.Easing.Exponential.Out)
      .onUpdate((object) => {
        layerObject.threejs.material.opacity = object.opacity;
      })
      .start();
  };

  const scaleUpBox = (layerPosition) => {
    const layerObject = gameSetup.stack[layerPosition];
    layerObject.threejs.scale.set(0, 0, 0);

    if (tweenScaleUp) {
      tweenScaleUp.stop();
    }

    tweenScaleUp = new TWEEN.Tween(layerObject.threejs.scale)
      .to({ x: 1, y: 1, z: 1 }, 1500)
      .easing(TWEEN.Easing.Exponential.Out);

    tweenScaleUp.start();
  };

  const animateCamera = () => {
    if (tweenCamera) {
      tweenCamera.stop();
    }

    // Camera should follow the top block - focus on the active block
    // Keep a few blocks visible below, but let base fade out
    const targetY = gameSetup.BOX_HEIGHT * (gameSetup.stack.length - 1) + CAMERA_POS;
    
    tweenCamera = new TWEEN.Tween({ offsetY: camera.position.y })
      .to(
        {
          offsetY: targetY,
        },
        800 // Faster camera movement
      )
      .easing(TWEEN.Easing.Exponential.Out)
      .onUpdate((object) => {
        camera.position.y = object.offsetY;
      })
      .start();
  };

  const animateCameraDown = () => {
    if (tweenCamera) {
      tweenCamera.stop();
    }

    tweenCamera = new TWEEN.Tween({ offsetY: camera.position.y })
      .to({ offsetY: CAMERA_POS }, gameSetup.stack.length * 70)
      .easing(TWEEN.Easing.Sinusoidal.Out)
      .onUpdate((object) => {
        camera.position.y = object.offsetY;
      })
      .start();
  };

  const animateInitBackground = () => {
    if (tweenBackgroundColor) {
      tweenBackgroundColor.stop();
    }

    appObj.baseColor = Math.floor(Math.random() * 360) + 1;
    appObj.backgroundColor = appObj.baseColor;

    const color = new THREE.Color(`hsl(${appObj.backgroundColor}, 40%,80%)`);
    appObj.renderer.setClearColor(color);
  };

  const animateBackgroundColor = () => {
    if (tweenBackgroundColor) {
      tweenBackgroundColor.stop();
    }

    tweenBackgroundColor = new TWEEN.Tween({
      colorValue: appObj.backgroundColor,
    })
      .to(
        {
          colorValue:
            appObj.baseColor + gameSetup.stack.length * appObj.colorMultiplier,
        },
        400
      )
      .easing(TWEEN.Easing.Linear.None)
      .onUpdate((object) => {
        appObj.backgroundColor = object.colorValue;
        const color = new THREE.Color(`hsl(${object.colorValue}, 40%,80%)`);
        appObj.renderer.setClearColor(color);
      })
      .start();
  };

  window.addEventListener("pointerdown", handleClick);
  window.addEventListener("touchstart", handleClick);

  const destroy = () => {
    window.removeEventListener("pointerdown", handleClick);
    window.removeEventListener("touchstart", handleClick);
  };

  return {
    destroy,
    initGame,
  };
};
