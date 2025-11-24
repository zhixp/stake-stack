import React, { useState, useRef, useEffect } from "react";
import StackTower from "./stacktower/StackTower";

const Game = ({ active, gameActive, onGameOver }) => {
  // Support both 'active' and 'gameActive' prop names
  const isActive = active || gameActive;
  const [gameStarted, setGameStarted] = useState(false);
  const initGameRef = useRef(null);

  if (!isActive) return null;

  const handleGameOver = (data) => {
    // StackTower passes { score } object, App expects { score, aborted? }
    const score = data?.score ?? data ?? 0;
    console.log('Game over received from StackTower:', data, 'Extracted score:', score);
    setGameStarted(false); // Reset for next game
    if (typeof onGameOver === 'function') {
      onGameOver({ score, aborted: false });
    } else {
      console.warn('onGameOver is not a function!', typeof onGameOver);
    }
  };

  const handleStartGame = () => {
    if (initGameRef.current) {
      initGameRef.current();
      setGameStarted(true);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20,
        background: "#dcb7b2",
      }}
    >
      {!gameStarted ? (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '20px',
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
        }}>
          <h2 style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold', margin: 0 }}>Ready to Play?</h2>
          <p style={{ color: '#aaa', fontSize: '14px' }}>Click START to begin</p>
          <button
            onClick={handleStartGame}
            className="btn primary big"
            style={{ padding: '16px 48px', fontSize: '18px' }}
          >
            START GAME
          </button>
        </div>
      ) : null}
      <StackTower 
        onGameOver={handleGameOver}
        onInitGameReady={(initFn) => { 
          initGameRef.current = initFn;
        }}
      />
      <button
        onClick={() => {
          console.log('Exit button clicked');
          setGameStarted(false);
          if (typeof onGameOver === 'function') {
            onGameOver({ score: 0, aborted: true });
          }
        }}
        className="btn ghost"
        style={{
          position: "absolute",
          top: 20,
          right: 24,
          zIndex: 1001,
        }}
      >
        Exit
      </button>
    </div>
  );
};

export default Game;
