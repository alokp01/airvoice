from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    display_name = models.CharField(max_length=50, blank=True)
    country = models.CharField(max_length=100, blank=True)
    total_calls = models.PositiveIntegerField(default=0)
    total_minutes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.username

    @property
    def name(self):
        return self.display_name or self.username
