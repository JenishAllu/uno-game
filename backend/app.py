
import os
from flask import Flask, request
from flask_socketio import SocketIO, join_room, leave_room, emit
import random
import math
from itertools import count

app = Flask(__name__)
ASYNC_MODE = os.environ.get("SOCKET_ASYNC_MODE", "gevent")
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode=ASYNC_MODE,
    ping_interval=20,
    ping_timeout=30,
)

rooms = {}

colors = ["red", "yellow", "green", "blue"]
specials = ["skip", "reverse", "+2"]
card_counter = count(1)
MAX_PLAYERS_PER_ROOM = 40


@app.get("/")
def health_check():
    return {"status": "ok", "service": "uno-backend"}


def create_single_deck():
    deck = []
    for color in colors:
        deck.append({"id": next(card_counter), "color": color, "value": "0"})
        for i in range(1, 10):
            deck.append({"id": next(card_counter), "color": color, "value": str(i)})
            deck.append({"id": next(card_counter), "color": color, "value": str(i)})
        for s in specials:
            deck.append({"id": next(card_counter), "color": color, "value": s})
            deck.append({"id": next(card_counter), "color": color, "value": s})
    for _ in range(4):
        deck.append({"id": next(card_counter), "color": "wild", "value": "wild"})
        deck.append({"id": next(card_counter), "color": "wild", "value": "+4"})
    random.shuffle(deck)
    return deck


def normalize_room_name(room):
    return (room or "").strip().lower()


def create_decks(num_decks):
    combined = []
    for _ in range(max(1, num_decks)):
        combined.extend(create_single_deck())
    random.shuffle(combined)
    return combined


def get_room_state(room):
    if room not in rooms:
        rooms[room] = {
            "players": [],
            "hands": {},
            "started": False,
            "host_sid": None,
            "draw_pile": [],
            "discard": [],
            "turn": 0,
            "direction": 1,
            "current_color": None,
            "winner": None,
        }
    return rooms[room]


def find_player_index(players, sid):
    for i, p in enumerate(players):
        if p["sid"] == sid:
            return i
    return -1


def ensure_draw_cards(game, amount):
    while len(game["draw_pile"]) < amount:
        game["draw_pile"].extend(create_single_deck())
        random.shuffle(game["draw_pile"])


def draw_cards(game, sid, amount):
    ensure_draw_cards(game, amount)
    for _ in range(amount):
        game["hands"][sid].append(game["draw_pile"].pop())


def advance_turn(game, steps=1):
    total = len(game["players"])
    if total == 0:
        return
    game["turn"] = (game["turn"] + (steps * game["direction"])) % total


def card_is_playable(game, card):
    if not game["discard"]:
        return True
    top = game["discard"][-1]
    if card["color"] == "wild":
        return True
    return card["color"] == game["current_color"] or card["value"] == top["value"]


def build_state_for_player(game, sid):
    players_public = []
    for p in game["players"]:
        players_public.append(
            {
                "name": p["name"],
                "handCount": len(game["hands"].get(p["sid"], [])),
                "isHost": p["sid"] == game["host_sid"],
                "isYou": p["sid"] == sid,
            }
        )

    turn_name = None
    if game["players"]:
        turn_name = game["players"][game["turn"]]["name"]

    return {
        "players": players_public,
        "started": game["started"],
        "turn": game["turn"],
        "turnName": turn_name,
        "direction": game["direction"],
        "topCard": game["discard"][-1] if game["discard"] else None,
        "currentColor": game["current_color"],
        "you": sid,
        "yourHand": game["hands"].get(sid, []),
        "winner": game["winner"],
        "canStart": sid == game["host_sid"] and not game["started"] and len(game["players"]) >= 2,
    }


def broadcast_state(room):
    game = rooms.get(room)
    if not game:
        return
    for p in game["players"]:
        emit("state", build_state_for_player(game, p["sid"]), to=p["sid"])


def send_error(sid, message):
    emit("error_msg", {"message": message}, to=sid)


def reset_match_state(game):
    needed_cards = len(game["players"]) * 7 + 30
    num_decks = max(1, math.ceil(needed_cards / 108))
    game["draw_pile"] = create_decks(num_decks)
    game["discard"] = []
    game["turn"] = 0
    game["direction"] = 1
    game["current_color"] = None
    game["winner"] = None
    game["started"] = True

    for p in game["players"]:
        game["hands"][p["sid"]] = []
        draw_cards(game, p["sid"], 7)

    game["discard"].append(game["draw_pile"].pop())
    top = game["discard"][-1]
    game["current_color"] = random.choice(colors) if top["color"] == "wild" else top["color"]

@socketio.on("join")
def join(data):
    room = normalize_room_name(data.get("room"))
    username = (data.get("username") or "").strip()
    sid = request.sid

    app.logger.info("Join requested sid=%s room=%s username=%s", sid, room, username)

    if not room or not username:
        send_error(sid, "Please provide both room and name.")
        return

    game = get_room_state(room)

    if game["started"]:
        send_error(sid, "Game already started. Create a new room for late joiners.")
        return

    if len(game["players"]) >= MAX_PLAYERS_PER_ROOM:
        send_error(sid, f"Room full. Max {MAX_PLAYERS_PER_ROOM} players.")
        return

    if any(p["name"].lower() == username.lower() for p in game["players"]):
        send_error(sid, "Name already taken in this room.")
        return

    join_room(room)

    game["players"].append({"sid": sid, "name": username})
    game["hands"][sid] = []

    if game["host_sid"] is None:
        game["host_sid"] = sid

    emit("joined", {"room": room, "username": username}, to=sid)
    broadcast_state(room)


@socketio.on("connect")
def on_connect():
    app.logger.info("Socket connected sid=%s", request.sid)


@socketio.on("disconnect")
def on_disconnect():
    app.logger.info("Socket disconnected sid=%s", request.sid)


@socketio.on("start_game")
def start_game(data):
    room = normalize_room_name(data.get("room"))
    sid = request.sid
    game = rooms.get(room)

    if not game:
        send_error(sid, "Room not found.")
        return
    if game["started"]:
        send_error(sid, "Game already started.")
        return
    if sid != game["host_sid"]:
        send_error(sid, "Only the host can start the game.")
        return
    if len(game["players"]) < 2:
        send_error(sid, "Need at least 2 players to start.")
        return

    reset_match_state(game)

    broadcast_state(room)


@socketio.on("restart_game")
def restart_game(data):
    room = normalize_room_name(data.get("room"))
    sid = request.sid
    game = rooms.get(room)

    if not game:
        send_error(sid, "Room not found.")
        return
    if sid != game["host_sid"]:
        send_error(sid, "Only the host can restart the game.")
        return
    if len(game["players"]) < 2:
        send_error(sid, "Need at least 2 players to restart.")
        return

    reset_match_state(game)
    broadcast_state(room)

@socketio.on("play")
def play(data):
    room = normalize_room_name(data.get("room"))
    sid = request.sid
    card_id = data.get("cardId")
    chosen_color = data.get("chosenColor")

    game = rooms.get(room)
    if not game or not game["started"] or game["winner"]:
        return

    if not game["players"]:
        return

    current_sid = game["players"][game["turn"]]["sid"]
    if sid != current_sid:
        send_error(sid, "It is not your turn.")
        return

    hand = game["hands"].get(sid, [])
    card = next((c for c in hand if c["id"] == card_id), None)
    if not card:
        send_error(sid, "Card not in your hand.")
        return
    if not card_is_playable(game, card):
        send_error(sid, "That card is not playable right now.")
        return

    hand.remove(card)
    game["discard"].append(card)

    if card["color"] == "wild":
        if chosen_color not in colors:
            send_error(sid, "Choose a valid color for wild cards.")
            hand.append(card)
            game["discard"].pop()
            return
        game["current_color"] = chosen_color
    else:
        game["current_color"] = card["color"]

    skip_steps = 0
    draw_amount = 0

    if card["value"] == "reverse":
        if len(game["players"]) == 2:
            skip_steps = 1
        else:
            game["direction"] *= -1
    elif card["value"] == "skip":
        skip_steps = 1
    elif card["value"] == "+2":
        skip_steps = 1
        draw_amount = 2
    elif card["value"] == "+4":
        skip_steps = 1
        draw_amount = 4

    if len(hand) == 0:
        player_name = next((p["name"] for p in game["players"] if p["sid"] == sid), "Unknown")
        game["winner"] = player_name
        broadcast_state(room)
        return

    if draw_amount > 0 and len(game["players"]) > 1:
        next_idx = (game["turn"] + game["direction"]) % len(game["players"])
        next_sid = game["players"][next_idx]["sid"]
        draw_cards(game, next_sid, draw_amount)

    advance_turn(game, 1 + skip_steps)
    broadcast_state(room)


@socketio.on("draw")
def draw(data):
    room = normalize_room_name(data.get("room"))
    sid = request.sid
    game = rooms.get(room)

    if not game or not game["started"] or game["winner"]:
        return

    if not game["players"]:
        return

    current_sid = game["players"][game["turn"]]["sid"]
    if sid != current_sid:
        send_error(sid, "It is not your turn.")
        return

    draw_cards(game, sid, 1)
    advance_turn(game, 1)
    broadcast_state(room)


@socketio.on("leave")
def leave(data):
    room = normalize_room_name(data.get("room"))
    sid = request.sid
    _remove_player(room, sid)


@socketio.on("disconnect")
def handle_disconnect(data=None):
    sid = request.sid
    for room in list(rooms.keys()):
        if _remove_player(room, sid):
            break


def _remove_player(room, sid):
    game = rooms.get(room)
    if not game:
        return False

    idx = find_player_index(game["players"], sid)
    if idx == -1:
        return False

    leave_room(room)
    game["players"].pop(idx)
    game["hands"].pop(sid, None)

    if not game["players"]:
        rooms.pop(room, None)
        return True

    if game["host_sid"] == sid:
        game["host_sid"] = game["players"][0]["sid"]

    if game["started"]:
        if idx < game["turn"]:
            game["turn"] -= 1
        game["turn"] %= len(game["players"])

        if len(game["players"]) == 1:
            game["winner"] = game["players"][0]["name"]

    broadcast_state(room)
    return True

if __name__ == "__main__":
    port = int(os.environ.get("PORT", os.environ.get("BACKEND_PORT", 10000)))
    socketio.run(app, host="0.0.0.0", port=port)
