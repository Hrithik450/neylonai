# async func that handles connection, messages, and disconnect
async def websocket_application(scope, receive, send):
    while True:
        # Continuously listens for incoming WebSocket events
        event = await receive()

        # Accepts the WebSocket connection
        if event["type"] == "websocket.connect":
            await send({"type": "websocket.accept"})

        # Stops the loop and closes connection
        if event["type"] == "websocket.disconnect":
            break

        # If client sends "ping", server responds with "pong!"
        if event["type"] == "websocket.receive":
            if event["text"] == "ping":
                await send({"type": "websocket.send", "text": "pong!"})