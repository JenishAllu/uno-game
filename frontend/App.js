
import React, { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");
const COLORS = ["red", "yellow", "green", "blue"];

const appStyles = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #0f172a, #1e293b)",
  color: "#f8fafc",
  padding: "24px",
  fontFamily: "Verdana, Geneva, Tahoma, sans-serif",
};

const panelStyles = {
  maxWidth: "980px",
  margin: "0 auto",
  background: "rgba(15, 23, 42, 0.78)",
  border: "1px solid rgba(148, 163, 184, 0.35)",
  borderRadius: "16px",
  padding: "20px",
  boxShadow: "0 20px 60px rgba(2, 6, 23, 0.45)",
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
};

const smallButtonStyles = {
  ...buttonStyles,
  background: "#38bdf8",
};

const cardButton = (cardColor, playable) => ({
  ...smallButtonStyles,
  background: cardColor === "wild" ? "#f59e0b" : cardColor,
  color: "#ffffff",
  opacity: playable ? 1 : 0.4,
  cursor: playable ? "pointer" : "not-allowed",
  minWidth: "115px",
});

function App() {
  const [username, setUsername] = useState("");
  const [room, setRoom] = useState("");
  const [game, setGame] = useState(null);
  const [joined, setJoined] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [wildCardId, setWildCardId] = useState(null);

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

  return (
    <div style={appStyles}>
      <div style={panelStyles}>
        <h1 style={{ marginTop: 0 }}>UNO Party (10-20+ Players)</h1>

        {!joined && (
          <div>
            <input
              style={inputStyles}
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              style={inputStyles}
              placeholder="Room name"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
            <button style={buttonStyles} onClick={joinGame}>Join Room</button>
          </div>
        )}

        {errorMsg && <p style={{ color: "#fca5a5", fontWeight: 700 }}>{errorMsg}</p>}

        {joined && game && (
          <>
            <p>
              <strong>Room:</strong> {room} | <strong>Direction:</strong> {game.direction === 1 ? "Clockwise" : "Counterclockwise"}
            </p>
            <p>
              <strong>Turn:</strong> {game.turnName || "-"}
            </p>
            <p>
              <strong>Current Color:</strong> {game.currentColor || "-"}
            </p>
            <p>
              <strong>Top Card:</strong> {game.topCard ? `${game.topCard.color} ${game.topCard.value}` : "-"}
            </p>

            {game.winner && (
              <h2 style={{ color: "#86efac" }}>Winner: {game.winner}</h2>
            )}

            {!game.started && (
              <div>
                <h3>Lobby</h3>
                <ul>
                  {game.players.map((p, i) => (
                    <li key={`${p.name}-${i}`}>
                      {p.name} {p.isHost ? "(Host)" : ""}
                    </li>
                  ))}
                </ul>
                {game.canStart && (
                  <button style={buttonStyles} onClick={startGame}>Start Game</button>
                )}
              </div>
            )}

            {game.started && (
              <>
                <h3>Players</h3>
                <div>
                  {game.players.map((p, i) => (
                    <div key={`${p.name}-${i}`} style={{ marginBottom: "6px" }}>
                      {p.name} {p.isYou ? "(You)" : ""} - Cards: {p.handCount}
                    </div>
                  ))}
                </div>

                <h3>Your Hand</h3>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {game.yourHand.map((card) => {
                    const playable = canPlay(card);
                    return (
                      <button
                        key={card.id}
                        style={cardButton(card.color, playable)}
                        disabled={!playable}
                        onClick={() => {
                          if (card.color === "wild") {
                            setWildCardId(card.id);
                            return;
                          }
                          playCard(card.id);
                        }}
                      >
                        {card.color} {card.value}
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: "12px" }}>
                  <button style={smallButtonStyles} disabled={!isMyTurn || !!game.winner} onClick={drawCard}>
                    Draw Card
                  </button>
                </div>

                {wildCardId && (
                  <div style={{ marginTop: "12px" }}>
                    <p>Choose a color for your wild card:</p>
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        style={{ ...cardButton(color, true), minWidth: "95px" }}
                        onClick={() => {
                          playCard(wildCardId, color);
                          setWildCardId(null);
                        }}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: "16px" }}>
              <button style={{ ...buttonStyles, background: "#f87171" }} onClick={leaveGame}>Leave Room</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
