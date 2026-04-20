import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const normalizeUrl = (url) => (url || "").trim().replace(/\/+$/, "");
const SOCKET_URL_STORAGE_KEY = "uno_socket_url";

const getInitialSocketUrl = () => {
  const envUrl = normalizeUrl(process.env.REACT_APP_SOCKET_URL);
  if (envUrl) return envUrl;

  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const urlFromQuery = normalizeUrl(params.get("backendUrl") || params.get("socketUrl"));
    if (urlFromQuery) return urlFromQuery;

    const storedUrl = normalizeUrl(window.localStorage.getItem(SOCKET_URL_STORAGE_KEY));
    if (storedUrl) return storedUrl;
  }

  if (typeof window === "undefined") {
    return "http://localhost:10000";
  }

  const { protocol, hostname, port } = window.location;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocal) return `${protocol}//${hostname}:10000`;

  return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
};

const createSocket = (url) =>
  io(normalizeUrl(url), {
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 15,
  });

const COLORS = ["red", "yellow", "green", "blue"];

const getCardBackground = (color) => {
  if (color === "wild") return "var(--card-wild)";
  if (color === "red") return "var(--card-red)";
  if (color === "yellow") return "var(--card-yellow)";
  if (color === "green") return "var(--card-green)";
  if (color === "blue") return "var(--card-blue)";
  return "rgba(51, 65, 85, 1)";
};

const getCardValueLabel = (value) => {
  if (value === "reverse") return "↺";
  if (value === "skip") return "⊘";
  if (value === "wild") return "W";
  return value;
};

function UnoCard({ card, onClick, playable, showHint = false, delayIndex = 0 }) {
  const valueLabel = getCardValueLabel(card.value);
  const bg = getCardBackground(card.color);

  return (
    <div className="uno-card-wrapper animate-slide-up" style={{ animationDelay: `${delayIndex * 0.05}s` }}>
      <div
        className={`uno-card ${playable === false ? "not-playable" : "playable"}`}
        style={{ background: bg }}
        onClick={playable !== false ? onClick : undefined}
        title={showHint ? `${card.color} ${card.value}` : ""}
      >
        <div className="uno-card-value-corner corner-top">{valueLabel}</div>
        <div className="uno-card-inner-circle">
          <div className="uno-card-value-center" style={{ color: bg === 'var(--card-wild)' ? '#111827' : bg }}>
            {valueLabel}
          </div>
        </div>
        <div className="uno-card-value-corner corner-bottom">{valueLabel}</div>
      </div>
    </div>
  );
}

function App() {
  const [username, setUsername] = useState(window.localStorage.getItem("uno_username") || "");
  const [room, setRoom] = useState(window.localStorage.getItem("uno_room") || "");
  const [game, setGame] = useState(null);
  const [joined, setJoined] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [wildCardId, setWildCardId] = useState(null);
  const [serverUrl, setServerUrl] = useState(getInitialSocketUrl);
  const [serverUrlInput, setServerUrlInput] = useState(getInitialSocketUrl);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  const applyServerUrl = () => {
    const nextUrl = normalizeUrl(serverUrlInput);
    if (!nextUrl) {
      setErrorMsg("Please enter a valid backend URL.");
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(SOCKET_URL_STORAGE_KEY, nextUrl);
    }

    setServerUrl(nextUrl);
    setErrorMsg("");
  };

  const joinGame = () => {
    if (!username.trim() || !room.trim()) {
      setErrorMsg("Please enter your name and room.");
      return;
    }
    
    window.localStorage.setItem("uno_username", username.trim());
    window.localStorage.setItem("uno_room", room.trim().toLowerCase());

    if (!socketRef.current) return;
    if (!socketRef.current.connected) socketRef.current.connect();
    socketRef.current.emit("join", { username: username.trim(), room: room.trim().toLowerCase() });
  };

  const canPlay = (card) => {
    if (!game?.started || game?.winner) return false;
    if (!isMyTurn) return false;
    if (!game?.topCard) return true;
    if (card.color === "wild") return true;
    return card.color === game.currentColor || card.value === game.topCard.value;
  };

  const playCard = (cardId, chosenColor = null) => {
    socketRef.current?.emit("play", { room: room.trim().toLowerCase(), cardId, chosenColor });
  };

  const drawCard = () => {
    socketRef.current?.emit("draw", { room: room.trim().toLowerCase() });
  };

  const startGame = () => {
    socketRef.current?.emit("start_game", { room: room.trim().toLowerCase() });
  };

  const restartGame = () => {
    socketRef.current?.emit("restart_game", { room: room.trim().toLowerCase() });
  };

  const leaveGame = () => {
    socketRef.current?.emit("leave", { room: room.trim().toLowerCase() });
    setGame(null);
    setJoined(false);
    setWildCardId(null);
    window.localStorage.removeItem("uno_username");
    window.localStorage.removeItem("uno_room");
  };

  useEffect(() => {
    const url = normalizeUrl(serverUrl);
    if (!url) return;

    const socket = createSocket(url);
    socketRef.current = socket;
    setConnected(socket.connected);

    socket.on("connect", () => { 
      setConnected(true); 
      setErrorMsg(""); 
      
      const savedUser = window.localStorage.getItem("uno_username");
      const savedRoom = window.localStorage.getItem("uno_room");
      if (savedUser && savedRoom) {
         socket.emit("join", { username: savedUser, room: savedRoom });
      }
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => { setConnected(false); setErrorMsg(`Cannot connect to game server at ${url}`); });
    socket.on("joined", () => { 
      setJoined(true); 
      setErrorMsg(""); 
      setUsername(window.localStorage.getItem("uno_username") || username);
      setRoom(window.localStorage.getItem("uno_room") || room);
    });
    socket.on("state", (data) => { setGame(data); setErrorMsg(""); });
    socket.on("error_msg", (data) => setErrorMsg(data?.message || "Something went wrong."));

    return () => {
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [serverUrl]);

  const isMyTurn = !!game?.players?.[game.turn]?.isYou;
  const isHost = !!game?.players?.find((player) => player.isYou)?.isHost;

  return (
    <>
      <div className="glass-panel animate-slide-up">
        <h1 className="app-title">UNO Advanced Table</h1>
        <p className="subtitle">Premium multiplayer card action. Welcome to the pros.</p>
        
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span className={`status-indicator ${connected ? 'status-connected' : 'status-disconnected'}`}></span>
          <span style={{ color: connected ? 'var(--card-green)' : 'var(--card-red)', fontWeight: 600 }}>
            {connected ? "Server Connected" : "Connection Lost"}
          </span>
        </div>

        {!joined && (
          <div className="input-group animate-pop-in">
            <input
              className="styled-input"
              placeholder="Your Nickname"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinGame()}
            />
            <input
              className="styled-input"
              placeholder="Room ID"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && joinGame()}
            />
            <button className="primary-btn success-btn" onClick={joinGame}>Enter Lobby</button>
          </div>
        )}

        {errorMsg && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#fca5a5', textAlign: 'center', fontWeight: '600', marginBottom: '20px' }}>
            {errorMsg}
          </div>
        )}

        {joined && game && (
          <div className="animate-pop-in">
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-label">Lobby</div>
                <div className="stat-value" style={{ color: '#38bdf8' }}>{room.toUpperCase()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Current Turn</div>
                <div className="stat-value" style={{ color: isMyTurn ? 'var(--card-green)' : 'white' }}>
                  {game.turnName || "-"}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Flow</div>
                <div className="stat-value">{game.direction === 1 ? "Clockwise ↻" : "Counter ↺"}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active Color</div>
                <div className="stat-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {game.currentColor ? (
                    <>
                      <span style={{ 
                        width: '16px', height: '16px', borderRadius: '50%', 
                        background: `var(--card-${game.currentColor})`,
                        boxShadow: `0 0 12px var(--card-${game.currentColor})`
                      }}></span>
                      <span style={{ textTransform: 'capitalize' }}>{game.currentColor}</span>
                    </>
                  ) : "-"}
                </div>
              </div>
            </div>

            {game.winner && (
              <h1 className="app-title" style={{ fontSize: '2.5rem', color: 'var(--card-green)', margin: '40px 0' }}>
                🎉 {game.winner} has won! 🎉
              </h1>
            )}

            {game.started && isHost && (
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <button className="primary-btn" style={{ background: '#f59e0b' }} onClick={restartGame}>
                  Rematch / Restart
                </button>
              </div>
            )}

            {!game.started && (
              <div style={{ textAlign: 'center', margin: '40px 0' }}>
                <h3 style={{ marginBottom: '16px', color: '#38bdf8' }}>Lobby Standby</h3>
                <div className="player-list" style={{ justifyContent: 'center' }}>
                  {game.players.map((p, i) => (
                    <span key={i} className={`player-chip ${p.isYou ? 'is-you' : ''}`}>
                      {p.name} {p.isHost && "👑"} {!p.connected && "🔌"}
                    </span>
                  ))}
                </div>
                {game.canStart ? (
                  <button className="primary-btn success-btn" onClick={startGame} style={{ marginTop: '20px', fontSize: '1.2rem', padding: '16px 40px' }}>
                    Deal Cards
                  </button>
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>Waiting for Host to deal... (Minimum 2 players needed)</p>
                )}
              </div>
            )}

            {game.started && (
              <>
                <div className="game-table animate-slide-up">
                  <div className="center-pile">
                    <div style={{ textAlign: "center", width: '120px' }}>
                      <p className="stat-label" style={{ color: '#6ee7b7' }}>Discard Pile</p>
                      {game.topCard ? (
                        <UnoCard card={game.topCard} playable={false} />
                      ) : (
                        <div style={{ width: '100px', height: '150px', border: '2px dashed rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Empty</div>
                      )}
                    </div>
                    
                    <div style={{ textAlign: "center", width: '120px' }}>
                      <p className="stat-label" style={{ color: '#6ee7b7' }}>Draw Pile</p>
                      <button 
                        className={`uno-card deck-pile ${isMyTurn && !game.winner ? 'playable' : 'not-playable'}`} 
                        onClick={isMyTurn && !game.winner ? drawCard : undefined}
                      >
                        UNO
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '40px' }}>
                  <h3 style={{ borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginBottom: '16px' }}>Players</h3>
                  <div className="player-list">
                    {game.players.map((p, i) => (
                      <span key={i} className={`player-chip ${p.isYou ? 'is-you' : ''}`} style={{ borderColor: i === game.turn ? 'var(--card-green)' : ''}}>
                        {p.name} {!p.connected && "🔌"}
                        <span style={{ background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: '12px', marginLeft: '6px', fontSize: '0.8rem' }}>{p.handCount}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginBottom: '16px' }}>
                    <h3>Your Dashboard</h3>
                    <div style={{ fontSize: '0.9rem', color: isMyTurn ? 'var(--card-green)' : 'var(--text-muted)' }}>
                      {isMyTurn ? '● Your Turn to Play!' : 'Waiting for turn...'}
                    </div>
                  </div>

                  <div className="hand-wrap">
                    {game.yourHand.map((card, i) => {
                      const playable = canPlay(card);
                      return (
                        <UnoCard
                          key={card.id}
                          card={card}
                          playable={playable}
                          showHint
                          delayIndex={i}
                          onClick={() => {
                            if (card.color === "wild") {
                              setWildCardId(card.id);
                              return;
                            }
                            playCard(card.id);
                          }}
                        />
                      );
                    })}
                  </div>

                  {wildCardId && (
                    <div className="glass-panel animate-pop-in" style={{ marginTop: "24px", textAlign: 'center', border: '1px solid var(--card-wild)' }}>
                      <h3 style={{ marginBottom: "16px" }}>Select Wild Color</h3>
                      <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: 'wrap' }}>
                        {COLORS.map((color) => (
                          <button
                            key={color}
                            className="primary-btn"
                            style={{ background: `var(--card-${color})`, boxShadow: `0 4px 15px var(--card-${color})`, minWidth: '120px' }}
                            onClick={() => {
                              playCard(wildCardId, color);
                              setWildCardId(null);
                            }}
                          >
                            {color.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ marginTop: "40px", textAlign: 'right' }}>
              <button className="primary-btn danger-btn" onClick={leaveGame}>Exit Table</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
