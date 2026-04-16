import React, { useEffect, useState } from "react";
import io from "socket.io-client";

const socketUrl = process.env.REACT_APP_SOCKET_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
const socket = io(socketUrl);
const COLORS = ["red", "yellow", "green", "blue"];

const UNO_COLORS = {
  red: "#d7263d",
  yellow: "#f4c430",
  green: "#2db35d",
  blue: "#1f67c1",
};

const colorDot = {
  red: "#ef4444",
  yellow: "#facc15",
  green: "#22c55e",
  blue: "#3b82f6",
};

const MOBILE_BREAKPOINT = 768;

const appStyles = {
  minHeight: "100vh",
  background: "radial-gradient(circle at 15% 20%, #1d4ed8 0%, #0f172a 45%, #020617 100%)",
  color: "#f8fafc",
  padding: "16px",
  fontFamily: "'Trebuchet MS', 'Gill Sans', sans-serif",
};

const panelStyles = {
  maxWidth: "1200px",
  margin: "0 auto",
  background: "rgba(5, 10, 20, 0.74)",
  border: "1px solid rgba(148, 163, 184, 0.28)",
  borderRadius: "20px",
  padding: "20px",
  boxShadow: "0 20px 70px rgba(2, 6, 23, 0.65)",
};

const inputStyles = {
  padding: "10px 12px",
  marginRight: "8px",
  marginBottom: "8px",
  borderRadius: "8px",
  border: "1px solid #475569",
  outline: "none",
  background: "#0b1220",
  color: "#e2e8f0",
};

const buttonStyles = {
  padding: "10px 14px",
  border: "none",
  borderRadius: "8px",
  background: "#22c55e",
  color: "#0f172a",
  fontWeight: 700,
  cursor: "pointer",
  marginRight: "8px",
  marginBottom: "8px",
  touchAction: "manipulation",
};

const smallButtonStyles = {
  ...buttonStyles,
  background: "#38bdf8",
};

const tableStyles = {
  marginTop: "16px",
  background: "radial-gradient(circle at 50% 40%, #245f2f 0%, #163f20 55%, #0f2f18 100%)",
  borderRadius: "18px",
  border: "1px solid rgba(187, 247, 208, 0.25)",
  padding: "16px",
};

const centerPileStyles = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "20px",
  flexWrap: "wrap",
  marginTop: "8px",
};

const mobileCardSizes = {
  standard: { width: 94, height: 140 },
};

const getResponsiveUi = (isMobile) => ({
  app: {
    ...appStyles,
    padding: isMobile ? "10px" : appStyles.padding,
  },
  panel: {
    ...panelStyles,
    padding: isMobile ? "14px" : panelStyles.padding,
    borderRadius: isMobile ? "16px" : panelStyles.borderRadius,
  },
  input: {
    ...inputStyles,
    width: isMobile ? "100%" : "auto",
    marginRight: isMobile ? 0 : inputStyles.marginRight,
  },
  button: {
    ...buttonStyles,
    width: isMobile ? "100%" : "auto",
    marginRight: isMobile ? 0 : buttonStyles.marginRight,
  },
  smallButton: {
    ...smallButtonStyles,
    width: isMobile ? "100%" : "auto",
    marginRight: isMobile ? 0 : smallButtonStyles.marginRight,
  },
  statsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "12px",
    marginBottom: "12px",
  },
  infoCard: {
    background: "rgba(15,23,42,0.65)",
    padding: "8px 12px",
    borderRadius: "10px",
    minWidth: isMobile ? "unset" : "auto",
    flex: isMobile ? "1 1 100%" : "0 0 auto",
  },
  table: {
    ...tableStyles,
    padding: isMobile ? "12px" : tableStyles.padding,
  },
  centerPile: {
    ...centerPileStyles,
    gap: isMobile ? "12px" : centerPileStyles.gap,
    flexDirection: isMobile ? "column" : "row",
    alignItems: isMobile ? "stretch" : "center",
  },
  tableCard: {
    width: isMobile ? `${mobileCardSizes.standard.width}px` : "112px",
    height: isMobile ? `${mobileCardSizes.standard.height}px` : "166px",
  },
  handWrap: {
    display: "flex",
    flexWrap: isMobile ? "nowrap" : "wrap",
    gap: isMobile ? "8px" : "10px",
    overflowX: isMobile ? "auto" : "visible",
    WebkitOverflowScrolling: "touch",
    paddingBottom: isMobile ? "6px" : 0,
  },
  playerWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
});

const getCardValueLabel = (value) => {
  if (value === "reverse") return "↺";
  if (value === "skip") return "⊘";
  if (value === "wild") return "W";
  return value;
};

const getCardBackground = (color) => {
  if (color === "wild") {
    return "conic-gradient(from 45deg, #ef4444, #facc15, #22c55e, #3b82f6, #ef4444)";
  }
  return UNO_COLORS[color] || "#334155";
};

function UnoCard({ card, onClick, playable, small = false, showHint = false, raised = false }) {
  const cardWidth = small ? 78 : 112;
  const cardHeight = small ? 116 : 166;
  const valueLabel = getCardValueLabel(card.value);

  return (
    <button
      onClick={onClick}
      disabled={playable === false}
      style={{
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        borderRadius: "16px",
        border: "2px solid rgba(255, 255, 255, 0.92)",
        background: getCardBackground(card.color),
        color: "#ffffff",
        fontWeight: 800,
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? (playable === false ? "not-allowed" : "pointer") : "default",
        opacity: playable === false ? 0.45 : 1,
        transform: raised ? "translateY(-8px)" : "translateY(0px)",
        boxShadow: raised
          ? "0 14px 30px rgba(15, 23, 42, 0.7)"
          : "0 10px 22px rgba(15, 23, 42, 0.55)",
        transition: "transform 120ms ease, box-shadow 120ms ease",
        padding: 0,
        touchAction: "manipulation",
      }}
      title={showHint ? `${card.color} ${card.value}` : ""}
    >
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          fontSize: small ? "14px" : "18px",
          textShadow: "0 2px 4px rgba(0,0,0,0.4)",
        }}
      >
        {valueLabel}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          right: "8px",
          fontSize: small ? "14px" : "18px",
          transform: "rotate(180deg)",
          textShadow: "0 2px 4px rgba(0,0,0,0.4)",
        }}
      >
        {valueLabel}
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%) rotate(-32deg)",
          width: small ? "70px" : "95px",
          height: small ? "42px" : "56px",
          borderRadius: "999px",
          background: "rgba(255, 255, 255, 0.93)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#111827",
          fontSize: small ? "24px" : "32px",
          fontWeight: 900,
          letterSpacing: "0.5px",
          textShadow: "none",
        }}
      >
        {valueLabel}
      </div>
    </button>
  );
}

function App() {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [game, setGame] = useState(null);
  const [joined, setJoined] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [wildCardId, setWildCardId] = useState(null);
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : MOBILE_BREAKPOINT,
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < MOBILE_BREAKPOINT;
  const ui = getResponsiveUi(isMobile);

  const joinGame = () => {
    if (!username.trim() || !room.trim()) {
      setErrorMsg("Please enter your name and room.");
      return;
    }
    socket.emit("join", { username: username.trim(), room: room.trim() });
  };

  const canPlay = (card) => {
    if (!game?.started || game?.winner) return false;
    if (!isMyTurn) return false;
    if (!game?.topCard) return true;
    if (card.color === "wild") return true;
    return card.color === game.currentColor || card.value === game.topCard.value;
  };

  const playCard = (cardId, chosenColor = null) => {
    socket.emit("play", { room, cardId, chosenColor });
  };

  const drawCard = () => {
    socket.emit("draw", { room });
  };

  const startGame = () => {
    socket.emit("start_game", { room });
  };

  const restartGame = () => {
    socket.emit("restart_game", { room });
  };

  const leaveGame = () => {
    socket.emit("leave", { room });
    setGame(null);
    setJoined(false);
    setWildCardId(null);
  };

  useEffect(() => {
    socket.on("joined", () => {
      setJoined(true);
      setErrorMsg("");
    });

    socket.on("state", (data) => {
      setGame(data);
      setErrorMsg("");
    });

    socket.on("error_msg", (data) => {
      setErrorMsg(data?.message || "Something went wrong.");
    });

    return () => {
      socket.off("joined");
      socket.off("state");
      socket.off("error_msg");
    };
  }, []);

  const isMyTurn = !!game?.players?.[game.turn]?.isYou;
  const isHost = !!game?.players?.find((player) => player.isYou)?.isHost;

  return (
    <div style={ui.app}>
      <div style={ui.panel}>
        <h1 style={{ marginTop: 0, marginBottom: "8px", letterSpacing: "1px", fontSize: isMobile ? "1.6rem" : "2rem" }}>UNO Party Table</h1>
        <p style={{ marginTop: 0, color: "#bfdbfe" }}>Real-card look for large friendly matches (10-20+ players)</p>

        {!joined && (
          <div>
            <input
              style={ui.input}
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              style={ui.input}
              placeholder="Room name"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
            <button style={ui.button} onClick={joinGame}>Join Room</button>
          </div>
        )}

        {errorMsg && <p style={{ color: "#fca5a5", fontWeight: 700 }}>{errorMsg}</p>}

        {joined && game && (
          <>
            <div style={ui.statsRow}>
              <div style={ui.infoCard}>
                <strong>Room:</strong> {room}
              </div>
              <div style={ui.infoCard}>
                <strong>Turn:</strong> {game.turnName || "-"}
              </div>
              <div style={ui.infoCard}>
                <strong>Direction:</strong> {game.direction === 1 ? "Clockwise" : "Counterclockwise"}
              </div>
              <div style={ui.infoCard}>
                <strong>Current Color:</strong> {game.currentColor || "-"}
                {game.currentColor && (
                  <span
                    style={{
                      display: "inline-block",
                      width: "11px",
                      height: "11px",
                      borderRadius: "999px",
                      marginLeft: "8px",
                      background: colorDot[game.currentColor],
                    }}
                  />
                )}
              </div>
            </div>

            {game.winner && (
              <h2 style={{ color: "#86efac" }}>Winner: {game.winner}</h2>
            )}

            {game.started && isHost && (
              <div style={{ marginBottom: "12px" }}>
                <button style={{ ...ui.button, background: "#f59e0b" }} onClick={restartGame}>
                  Restart Game
                </button>
              </div>
            )}

            {!game.started && (
              <div>
                <h3>Lobby</h3>
                <ul style={{ paddingLeft: "20px" }}>
                  {game.players.map((p, i) => (
                    <li key={`${p.name}-${i}`}>
                      {p.name} {p.isHost ? "(Host)" : ""}
                    </li>
                  ))}
                </ul>
                {game.canStart && (
                  <button style={ui.button} onClick={startGame}>Start Game</button>
                )}
              </div>
            )}

            {game.started && (
              <>
                <div style={ui.table}>
                  <h3 style={{ marginTop: 0 }}>Table</h3>
                  <div style={ui.centerPile}>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: "0 0 8px" }}>Top Card</p>
                      {game.topCard ? (
                        <UnoCard card={game.topCard} small={isMobile} />
                      ) : (
                        <div>No card yet</div>
                      )}
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: "0 0 8px" }}>Draw Pile</p>
                      <div
                        style={{
                          ...ui.tableCard,
                          borderRadius: "16px",
                          border: "2px solid rgba(255,255,255,0.95)",
                          background: "linear-gradient(145deg, #0b1220, #1e293b)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 900,
                          letterSpacing: "2px",
                          boxShadow: "0 10px 22px rgba(15,23,42,0.55)",
                        }}
                      >
                        UNO
                      </div>
                    </div>
                  </div>
                </div>

                <h3>Players</h3>
                <div style={ui.playerWrap}>
                  {game.players.map((p, i) => (
                    <div
                      key={`${p.name}-${i}`}
                      style={{
                        background: p.isYou ? "rgba(30,64,175,0.45)" : "rgba(15,23,42,0.6)",
                        border: p.isYou ? "1px solid rgba(147,197,253,0.7)" : "1px solid rgba(148,163,184,0.35)",
                        borderRadius: "10px",
                        padding: "7px 11px",
                      }}
                    >
                      {p.name} {p.isYou ? "(You)" : ""} | Cards: {p.handCount}
                    </div>
                  ))}
                </div>

                <h3>Your Hand</h3>
                <div style={ui.handWrap}>
                  {game.yourHand.map((card) => {
                    const playable = canPlay(card);
                    return (
                      <UnoCard
                        key={card.id}
                        card={card}
                        playable={playable}
                        showHint
                        raised={playable && !isMobile}
                        small={isMobile}
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

                <div style={{ marginTop: "12px" }}>
                  <button style={ui.smallButton} disabled={!isMyTurn || !!game.winner} onClick={drawCard}>
                    Draw Card
                  </button>
                </div>

                {wildCardId && (
                  <div style={{ marginTop: "12px" }}>
                    <p>Choose a color for your wild card:</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          style={{
                            ...ui.smallButton,
                            minWidth: isMobile ? "100%" : "105px",
                            background: UNO_COLORS[color],
                            color: "#fff",
                          }}
                          onClick={() => {
                            playCard(wildCardId, color);
                            setWildCardId(null);
                          }}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: "16px" }}>
              <button style={{ ...ui.button, background: "#f87171" }} onClick={leaveGame}>Leave Room</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
