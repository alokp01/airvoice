from rest_framework import generics, permissions, serializers
from .models import CallSession


class CallSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CallSession
        fields = ["id", "started_at", "ended_at", "duration_seconds"]


class CallHistoryView(generics.ListAPIView):
    serializer_class = CallSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return CallSession.objects.filter(user_a=user) | CallSession.objects.filter(user_b=user)
