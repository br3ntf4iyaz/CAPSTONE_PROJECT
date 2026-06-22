from django.urls import path, include
from rest_framework.routers import DefaultRouter, SimpleRouter
from rest_framework_nested.routers import NestedDefaultRouter

from .views import EventViewSet, FeaturedPostViewSet, FeedbackViewSet, PollViewSet, SurveyViewSet

# Root router — specific prefixes MUST come before the catch-all r'' EventViewSet
# so Django matches e.g. featured-posts/ before the detail pattern ^(?P<pk>[^/.]+)/$
router = DefaultRouter()
router.register(r'featured-posts', FeaturedPostViewSet, basename='featured-post')
router.register(r'feedback', FeedbackViewSet, basename='feedback')
router.register(r'', EventViewSet, basename='event')

# Nested: /events/{event_pk}/polls/
events_router = NestedDefaultRouter(router, r'', lookup='event')
events_router.register(r'polls', PollViewSet, basename='event-poll')
events_router.register(r'surveys', SurveyViewSet, basename='event-survey')

# Standalone routers for polls and surveys (not nested under an event).
# SimpleRouter intentionally used here — DefaultRouter would generate a ^$ API root
# that intercepts GET /events/ before EventViewSet's list action can handle it.
standalone_router = SimpleRouter()
standalone_router.register(r'polls', PollViewSet, basename='poll')
standalone_router.register(r'surveys', SurveyViewSet, basename='survey')

urlpatterns = [
    # standalone_router (SimpleRouter) first: no ^$ API root, just polls/ and surveys/.
    path('', include(standalone_router.urls)),
    # Main router second: EventViewSet at r'' handles ^$ (list), ^{pk}/ (detail), etc.
    # Must come BEFORE events_router because NestedDefaultRouter generates a ^$ API root
    # that would return {} and shadow the EventViewSet list.
    path('', include(router.urls)),
    # Nested polls/surveys under /events/{event_pk}/ last — its ^$ API root is now shadowed.
    path('', include(events_router.urls)),
]
