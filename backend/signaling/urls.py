from django.urls import path
from .views import CallHistoryView

urlpatterns = [
    path("history/", CallHistoryView.as_view(), name="call-history"),
]
