from django.contrib import admin
from .models import CallSession

@admin.register(CallSession)
class CallSessionAdmin(admin.ModelAdmin):
    list_display = ["id", "user_a", "user_b", "started_at", "duration_seconds"]
    list_filter = ["started_at"]
