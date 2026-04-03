from fastapi import WebSocket
from fastapi.websockets import WebSocketState
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, tournament_id: str):
        await websocket.accept()
        if tournament_id not in self.connections:
            self.connections[tournament_id] = []
        self.connections[tournament_id].append(websocket)
        count = len(self.connections[tournament_id])
        logger.info(f"WS connect: tournament={tournament_id}, online={count}")
        # Notifier tous les clients du nouveau compteur
        await self.broadcast(tournament_id, {
            "event": "online_count",
            "count": count,
            "tournament_id": tournament_id,
        })

    def disconnect(self, websocket: WebSocket, tournament_id: str):
        if tournament_id in self.connections:
            try:
                self.connections[tournament_id].remove(websocket)
            except ValueError:
                pass
            if not self.connections[tournament_id]:
                del self.connections[tournament_id]

    def get_online_count(self, tournament_id: str) -> int:
        return len(self.connections.get(tournament_id, []))

    async def broadcast(self, tournament_id: str, message: dict):
        """Envoie un message à tous les clients connectés. Nettoie les connexions mortes."""
        if tournament_id not in self.connections:
            return
        dead: List[WebSocket] = []
        for ws in self.connections[tournament_id]:
            try:
                if ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_json(message)
                else:
                    dead.append(ws)
            except Exception as e:
                logger.warning(f"WS broadcast error for {tournament_id}: {e}")
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, tournament_id)


manager = ConnectionManager()
