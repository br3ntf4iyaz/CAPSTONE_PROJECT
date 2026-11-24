from django.urls import path

from .views import PolicyDetailView, PolicyListView, PolicyRevisionsView

urlpatterns = [
    path('', PolicyListView.as_view(), name='policy-list'),
    path('<slug:slug>/', PolicyDetailView.as_view(), name='policy-detail'),
    path('<slug:slug>/revisions/', PolicyRevisionsView.as_view(), name='policy-revisions'),
]
