from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedDefaultRouter

from .views import OrgAccomplishmentViewSet, OrgRequirementViewSet, YouthOrgViewSet

# Root router
router = DefaultRouter()
router.register(r'', YouthOrgViewSet, basename='youth-org')

# Nested: /youth-orgs/{org_pk}/accomplishments/
orgs_router = NestedDefaultRouter(router, r'', lookup='org')
orgs_router.register(r'accomplishments', OrgAccomplishmentViewSet, basename='org-accomplishment')
orgs_router.register(r'requirements', OrgRequirementViewSet, basename='org-requirement')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(orgs_router.urls)),
]
