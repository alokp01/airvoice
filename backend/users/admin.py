from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ["username", "email", "display_name", "country", "total_calls", "total_minutes", "created_at"]
    fieldsets = UserAdmin.fieldsets + (
        ("VoiceChat", {"fields": ("display_name", "country", "total_calls", "total_minutes")}),
    )
