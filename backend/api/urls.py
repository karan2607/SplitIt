from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health, name='health'),
    # Auth
    path('auth/signup/', views.signup, name='signup'),
    path('auth/login/', views.login, name='login'),
    path('auth/logout/', views.logout, name='logout'),
    path('auth/me/', views.me, name='me'),
    path('auth/password-reset/', views.password_reset_request, name='password-reset-request'),
    path('auth/password-reset/confirm/', views.password_reset_confirm, name='password-reset-confirm'),
    # Receipt scanner
    path('receipt/scan/', views.receipt_scan, name='receipt-scan'),
    # Groups
    path('groups/', views.groups, name='groups'),
    path('groups/<uuid:pk>/', views.group_detail, name='group-detail'),
    # Invites
    path('groups/<uuid:group_pk>/invite/', views.invite_create, name='invite-create'),
    path('groups/<uuid:group_pk>/invite-link/', views.invite_link_create, name='invite-link-create'),
    path('invite/<str:token>/', views.invite_detail, name='invite-detail'),
    path('invite/<str:token>/accept/', views.invite_accept, name='invite-accept'),
    # Expenses
    path('groups/<uuid:group_pk>/expenses/', views.expenses, name='expenses'),
    path('groups/<uuid:group_pk>/expenses/<uuid:expense_pk>/', views.expense_detail, name='expense-detail'),
    # Balances & settlements
    path('groups/<uuid:group_pk>/balances/', views.balances, name='balances'),
    path('groups/<uuid:group_pk>/settle/', views.settle, name='settle'),
]
