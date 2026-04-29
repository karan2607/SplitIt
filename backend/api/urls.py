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
    path('auth/password-change/', views.password_change, name='password-change'),
    # Receipt scanner
    path('receipt/scan/', views.receipt_scan, name='receipt-scan'),
    # Users
    path('users/search/', views.user_search, name='user-search'),
    # Friends
    path('friends/', views.friends, name='friends'),
    path('friends/<uuid:pk>/', views.friend_detail, name='friend-detail'),
    # Groups
    path('groups/', views.groups, name='groups'),
    path('groups/<uuid:pk>/', views.group_detail, name='group-detail'),
    path('groups/<uuid:pk>/members/', views.group_add_member, name='group-add-member'),
    # Expenses
    path('groups/<uuid:group_pk>/expenses/', views.expenses, name='expenses'),
    path('groups/<uuid:group_pk>/expenses/<uuid:expense_pk>/', views.expense_detail, name='expense-detail'),
    # Balances & settlements
    path('groups/<uuid:group_pk>/balances/', views.balances, name='balances'),
    path('groups/<uuid:group_pk>/settle/', views.settle, name='settle'),
]
