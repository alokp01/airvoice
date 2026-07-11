import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "voicechat.settings")

from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from signaling.middleware import JWTAuthMiddleware
import signaling.routing

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(
            URLRouter(signaling.routing.websocket_urlpatterns)
        ),
    }
)
