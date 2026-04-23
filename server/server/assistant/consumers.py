from channels.generic.websocket import AsyncWebsocketConsumer
from channels.exceptions import AcceptConnection, DenyConnection

class AssistantConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        user = self.scope['user']

        if user.is_authenticated:
            raise AcceptConnection()
        else:
            raise DenyConnection()