from django.db import models
import uuid


class CallSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_a = models.ForeignKey(
        "users.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="calls_as_a"
    )
    user_b = models.ForeignKey(
        "users.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="calls_as_b"
    )
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"Call {self.id} — {self.started_at:%Y-%m-%d %H:%M}"
