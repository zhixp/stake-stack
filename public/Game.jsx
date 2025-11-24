import { useEffect, useRef } from 'react';

const Game = ({ gameActive, onGameOver }) => {
  const iframeRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const sessionNonceRef = useRef(null);

  useEffect(() => {
    if (!gameActive) {
      // Reset when game becomes inactive
      sessionTokenRef.current = null;
      sessionNonceRef.current = null;
      return;
    }

    // Generate session token and store in ref so it persists
    const sessionToken = crypto.randomUUID ? crypto.randomUUID() : 
      `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionNonce = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    sessionTokenRef.current = sessionToken;
    sessionNonceRef.current = sessionNonce;

    console.log('Game started with token:', sessionToken);

    // Set iframe src with token
    if (iframeRef.current) {
      iframeRef.current.src = `/game/index.html?token=${encodeURIComponent(sessionToken)}&nonce=${encodeURIComponent(sessionNonce)}`;
    }

    // Listen for postMessage from iframe
    const handleMessage = (event) => {
      console.log('Received message:', event.data);
      
      // In production, verify event.origin for security
      if (event.data && event.data.type === 'GAME_OVER') {
        const { score, token } = event.data;
        
        console.log('Game Over received - Score:', score, 'Token:', token, 'Expected:', sessionTokenRef.current);
        
        // Verify token matches (basic security check)
        if (token === sessionTokenRef.current && score !== undefined && score > 0) {
          console.log('Valid game over, calling onGameOver with score:', score);
          onGameOver(score);
        } else {
          console.warn('Invalid game over message:', { score, token, expectedToken: sessionTokenRef.current });
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [gameActive, onGameOver]);

  if (!gameActive) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 20,
      background: '#dcb7b2',
    }}>
      <iframe
        ref={iframeRef}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'block',
        }}
        title="Stack Game"
        allow="gamepad; fullscreen"
      />
      <button
        onClick={() => onGameOver(0)}
        style={{
          position: 'absolute',
          top: 20,
          right: 24,
          padding: '10px 20px',
          background: 'rgba(0,0,0,0.6)',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.18)',
          color: '#f5f5f5',
          fontSize: 13,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          zIndex: 21,
        }}
      >
        Exit
      </button>
    </div>
  );
};

export default Game;

