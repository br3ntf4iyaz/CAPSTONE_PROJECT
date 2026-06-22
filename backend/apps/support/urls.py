from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FAQViewSet, SupportTicketViewSet, UserFeedbackViewSet

router = DefaultRouter()
router.register(r'tickets', SupportTicketViewSet, basename='support-ticket')
router.register(r'faqs', FAQViewSet, basename='faq')
router.register(r'feedback', UserFeedbackViewSet, basename='user-feedback')

urlpatterns = [
    path('', include(router.urls)),
]
