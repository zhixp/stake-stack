import React, { memo, useRef, useEffect, useState } from "react";

import { application } from "./functions/application";

// Minimal wrappers to avoid pulling styled-components: just simple divs.
const Wrapper = ({ children }) => (
  <div
    style={{
      position: "relative",
      width: "100%",
      height: "100%",
      overflow: "hidden",
      background: "transparent",
    }}
  >
    {children}
  </div>
);

const RendererWrapper = React.forwardRef(function RendererWrapper(props, ref) {
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
      }}
    >
      {props.children}
    </div>
  );
});

const Counter = ({ children }) => (
  <div
    style={{
      position: "absolute",
      top: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      fontSize: 40,
      fontWeight: 700,
      color: "white",
      textShadow: "0 2px 6px rgba(0,0,0,0.4)",
      pointerEvents: "none",
      zIndex: 5,
    }}
  >
    {children}
  </div>
);

// No entrance animations for now
const SlideWithKey = ({ children }) => children;

export const StackTower = memo(function StackTower({ onGameOver, onInitGameReady }) {
  const canvasRef = useRef(null);
  const canvasWrapperRef = useRef(null);
  const initGameRef = useRef(null);

  const [gameState, setGameState] = useState("readyToStart");
  const [isReady, setIsReady] = useState(false);
  const [point, setPoint] = useState(0); // Initialize to 0, not null

  useEffect(() => {
    const { initGame, destroy, onLose } = application({
      canvasRefEl: canvasRef.current,
      canvasWrapperRefEl: canvasWrapperRef.current,
      gameState,
      setGameState,
      isReady,
      setIsReady,
      point,
      setPoint,
    });

    initGameRef.current = initGame;
    
    // Expose initGame to parent component so it can be called manually
    if (onInitGameReady && typeof onInitGameReady === 'function') {
      onInitGameReady(initGame);
    }

    const handleLose = (score) => {
      console.log('StackTower handleLose called with score:', score, 'Type:', typeof score);
      if (typeof onGameOver === "function") {
        console.log('Calling onGameOver with:', { score });
        onGameOver({ score });
      } else {
        console.warn('onGameOver is not a function in StackTower!', typeof onGameOver);
      }
    };

    if (onLose) {
      onLose.subscribe(handleLose);
    }

    return () => {
      initGameRef.current = null;
      if (onLose) {
        onLose.unsubscribe(handleLose);
      }
      destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DO NOT auto-start - require user to click play button
  // This ensures ticket check happens before game starts
  // useEffect(() => {
  //   if (isReady && gameState === "readyToStart" && initGameRef.current) {
  //     initGameRef.current();
  //   }
  // }, [isReady, gameState]);

  return (
    <Wrapper>
      <Counter>{point ?? 0}</Counter>
      <RendererWrapper ref={canvasWrapperRef}>
        <canvas ref={canvasRef} />
      </RendererWrapper>
    </Wrapper>
  );
});

export default StackTower;
