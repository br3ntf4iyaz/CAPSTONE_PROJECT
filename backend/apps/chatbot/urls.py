from django.urls import path
from .views import ChatbotView, ChatHistoryView

urlpatterns = [
    path('', ChatbotView.as_view(), name='chat'),
    path('history/<str:session_key>/', ChatHistoryView.as_view(), name='chat-history'),
]
