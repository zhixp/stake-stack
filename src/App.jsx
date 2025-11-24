import React, { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import {
  BrowserProvider,
  Contract,
  ZeroAddress,
  parseEther,
  formatEther,
} from "ethers";

import { CONTRACT_ADDRESS, CONTRACT_ABI } from "./abi";
import Game from "./Game";
import "./index.css";

// ---------- helpers --------------------------------------------------------

async function buildProvider(wallets) {
  // 1) Prefer a Privy wallet if present
  const wallet = wallets && wallets.length > 0 ? wallets[0] : null;
  if (wallet && wallet.getEthereumProvider) {
    const ethProvider = await wallet.getEthereumProvider();
    return new BrowserProvider(ethProvider);
  }

  // 2) Fallback to window.ethereum (e.g. MetaMask)
  if (typeof window !== "undefined" && window.ethereum) {
    return new BrowserProvider(window.ethereum);
  }

  // 3) No provider available
  return null;
}

async function getSignerAndContract(wallets) {
  const provider = await buildProvider(wallets);
  if (!provider) {
    throw new Error("No Ethereum provider found. Connect a wallet first.");
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  if (!address || address === ZeroAddress) {
    throw new Error("Invalid signer address.");
  }

  const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  return { signer, contract, address };
}

// ---------- component ------------------------------------------------------

const App = () => {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [tickets, setTickets] = useState(0);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(0);
  const [potSize, setPotSize] = useState("0");
  const [highScore, setHighScore] = useState("0");
  const [king, setKing] = useState("0x...");

  const [ticketInput, setTicketInput] = useState("1");
  const [isPlaying, setIsPlaying] = useState(false);

  // ---------- on‑chain reads -----------------------------------------------

  const refreshGameState = async () => {
    try {
      setError("");

      const { contract, address } = await getSignerAndContract(wallets);

      // get_game_state(address) returns a tuple of six values:
      // [tickets, xp, someAddress, level, potSize, extra]
      const state = await contract.get_game_state(address);

      // get_game_state returns: [potSize, highScore, king, level, tickets, xp]
      const potRaw = state[0] ?? 0n;
      const highScoreRaw = state[1] ?? 0n;
      const kingAddress = state[2] || "0x0000000000000000000000000000000000000000";
      const levelRaw = state[3] ?? 0n;
      const ticketsRaw = state[4] ?? 0n;
      const xpRaw = state[5] ?? 0n;

      console.log('Game state received:', { potRaw, highScoreRaw, kingAddress, levelRaw, ticketsRaw, xpRaw });

      // Format pot as string (ETH)
      setPotSize(formatEther(potRaw));
      setHighScore(highScoreRaw.toString());
      setKing(kingAddress);
      // Use Number for tickets/xp/level (not BigInt for display)
      setTickets(Number(ticketsRaw));
      setXp(Number(xpRaw));
      setLevel(Number(levelRaw));
    } catch (e) {
      console.error(e);
      setError(e.message ?? "Failed to load game state");
    }
  };

  useEffect(() => {
    if (authenticated && wallets.length > 0) {
      refreshGameState();
    }
  }, [authenticated, wallets]);

  // ---------- actions ------------------------------------------------------

  const handleBuyTickets = async () => {
    try {
      setError("");

      if (!authenticated) {
        await login();
        return;
      }

      const amount = Number(ticketInput || "0");
      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Enter a positive ticket amount.");
        return;
      }

      setLoading(true);
      setError("");
      
      try {
        const { contract } = await getSignerAndContract(wallets);

        // Ticket price: 0.0001 ETH per ticket
        const TICKET_PRICE_ETH = "0.0001";
        const totalCost = parseEther(TICKET_PRICE_ETH) * BigInt(amount);

        const tx = await contract.buy_tickets(amount, { value: totalCost });
        await tx.wait();

        await refreshGameState();
      } catch (e) {
        console.error('Error buying tickets:', e);
        setError(e.message ?? "Failed to buy tickets");
      }
    } catch (e) {
      console.error(e);
      setError(e.message ?? "Failed to buy tickets");
    } finally {
      setLoading(false);
    }
  };

  const handleGameOver = async ({ score, aborted }) => {
    console.log('handleGameOver called with:', { score, aborted });
    
    // Always close game first - don't auto-start
    setIsPlaying(false);
    
    // If the user exited or score is not valid, just return
    if (aborted || !score || score <= 0) {
      console.log('Game over aborted or invalid score:', { aborted, score });
      return;
    }

    // Deduct ticket immediately (optimistic update)
    setTickets(prev => Math.max(0, prev - 1));
    
    try {
      setLoading(true);
      setError("");

      if (!authenticated) {
        console.warn('Not authenticated, cannot save score');
        setError("You must be logged in to record scores.");
        return;
      }

      console.log('Submitting score to contract:', score);
      const { contract } = await getSignerAndContract(wallets);
      const tx = await contract.play_round(score);
      console.log('Transaction sent, waiting for confirmation...');
      await tx.wait();
      console.log('Score saved successfully!');

      // Refresh state to get updated pot, high score, king, etc.
      await refreshGameState();
    } catch (e) {
      console.error('Error saving score:', e);
      setError(e.message ?? "Failed to submit score");
      // Refund ticket on error
      setTickets(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  // ---------- derived display ----------------------------------------------

  // Pot is already formatted as string from formatEther
  const formattedPot = potSize ? `${Number(potSize).toFixed(4)} ETH` : "0.0000 ETH";

  // Format large numbers for display
  const formatNumber = (num) => {
    if (!num || num === 0n) return "0";
    const n = Number(num);
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
    return n.toLocaleString();
  };

  // ---------- UI -----------------------------------------------------------

  return (
    <div className="app-shell">
      {/* Top nav bar */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-mark">STACK PRO</div>
        </div>

        <div className="topbar-center">
          <div className="topbar-pot-label">Current Pot</div>
          <div className="topbar-pot-value">{formattedPot}</div>
        </div>

        <div className="topbar-right">
          {authenticated ? (
            <>
              <span className="address-pill">Connected</span>
              <button
                className="btn ghost"
                onClick={logout}
                disabled={loading}
              >
                Logout
              </button>
            </>
          ) : (
            <button
              className="btn primary"
              onClick={login}
              disabled={!ready}
            >
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      {/* Error banner */}
      {error && <div className="error-banner">{error}</div>}

      {/* Main stage */}
      <main className="stage">
        {!isPlaying ? (
          <section className="hero">
            {/* Left column: hero copy */}
            <div className="hero-copy">
              <h1>Build the tallest stack on‑chain.</h1>
              <p>
                Buy tickets, climb levels, and compete for the pot in a
                physics‑driven stacking game. Real scores, real stakes,
                instant rewards.
              </p>

              <div className="hero-actions">
                <button
                  className="btn primary big"
                  onClick={() => {
                    if (tickets > 0) {
                      setIsPlaying(true);
                    } else {
                      setError("No tickets! Buy tickets to play.");
                    }
                  }}
                  disabled={!authenticated || tickets <= 0 || loading}
                >
                  Play Game
                </button>
                <button
                  className="btn secondary"
                  onClick={handleBuyTickets}
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Buy Tickets"}
                </button>
              </div>

              <div className="hero-meta">
                <span>{tickets} tickets</span>
                <span>{formatNumber(xp)} XP</span>
                <span>Lvl {formatNumber(level)}</span>
              </div>
            </div>

            {/* Right column: lobby card */}
            <div className="hero-panel">
              <div className="panel-header">
                <span className="panel-title">Stack Pro Lobby</span>
                <span className="panel-subtitle">Session overview</span>
              </div>

              <div className="panel-stats">
                <div className="stat">
                  <span className="label">Pot</span>
                  <span className="value" style={{color: '#00ff9c', fontSize: '18px'}}>{formattedPot}</span>
                </div>
                <div className="stat">
                  <span className="label">High Score</span>
                  <span className="value">{highScore}</span>
                </div>
                <div className="stat">
                  <span className="label">Tickets</span>
                  <span className="value">{tickets}</span>
                </div>
              </div>
              
              <div className="panel-stats" style={{marginTop: '16px'}}>
                <div className="stat">
                  <span className="label">XP</span>
                  <span className="value">{formatNumber(xp)}</span>
                </div>
                <div className="stat">
                  <span className="label">Level</span>
                  <span className="value">{formatNumber(level)}</span>
                </div>
                <div className="stat">
                  <span className="label">King</span>
                  <span className="value" style={{fontSize: '12px'}}>{king.substring(0, 8)}...</span>
                </div>
              </div>

              <div className="panel-control">
                <label className="ticket-label">
                  Tickets to buy
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={ticketInput}
                    onChange={(e) => setTicketInput(e.target.value)}
                  />
                </label>
                <button
                  className="btn primary"
                  onClick={handleBuyTickets}
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Buy Tickets"}
                </button>
              </div>

              <button
                className="btn play-full"
                onClick={() => {
                  if (tickets > 0) {
                    setIsPlaying(true);
                  } else {
                    setError("No tickets! Buy tickets to play.");
                  }
                }}
                disabled={!authenticated || tickets <= 0 || loading}
              >
                Enter Arena
              </button>
            </div>
          </section>
        ) : (
          <section className="game-overlay">
            <div className="game-frame">
              <Game
                active={isPlaying}
                onGameOver={handleGameOver}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;