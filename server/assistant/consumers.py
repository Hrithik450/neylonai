from channels.exceptions import AcceptConnection
from channels.exceptions import DenyConnection
from channels.generic.websocket import AsyncWebsocketConsumer


class AssistantConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]

        if user.is_authenticated:
            raise AcceptConnection
        raise DenyConnection
