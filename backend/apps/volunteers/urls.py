from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedDefaultRouter

from .views import (
    TeamMemberViewSet,
    TeamViewSet,
    VolunteerOpportunityViewSet,
    VolunteerSignupViewSet,
)

# Root router
router = DefaultRouter()
router.register(r'opportunities', VolunteerOpportunityViewSet, basename='volunteer-opportunity')
router.register(r'signups', VolunteerSignupViewSet, basename='volunteer-signup')
router.register(r'teams', TeamViewSet, basename='team')

# Nested: /teams/{team_pk}/members/
teams_router = NestedDefaultRouter(router, r'teams', lookup='team')
teams_router.register(r'members', TeamMemberViewSet, basename='team-member')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(teams_router.urls)),
]
