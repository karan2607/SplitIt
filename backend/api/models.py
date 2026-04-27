import uuid
import secrets
from datetime import timedelta

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None  # remove the username field
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255)
    avatar_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    objects = UserManager()

    def __str__(self):
        return self.email


class Group(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_groups')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class GroupMember(models.Model):
    ROLE_CHOICES = [('admin', 'Admin'), ('member', 'Member')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='group_memberships')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('group', 'user')

    def __str__(self):
        return f'{self.user.email} in {self.group.name}'


class GroupInvite(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='invites')
    invited_email = models.CharField(max_length=254, blank=True)
    token = models.CharField(max_length=64, unique=True)
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_invites')
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(32)
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(hours=72)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()

    def __str__(self):
        return f'Invite for {self.invited_email} to {self.group.name}'


class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='expenses')
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='paid_expenses')
    date = models.DateField(default=timezone.localdate)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_expenses')
    created_at = models.DateTimeField(auto_now_add=True)
    is_settlement = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f'{self.description} (${self.amount})'


class ExpenseSplit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='splits')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='expense_splits')
    # Written at create time and never recomputed — immutable historical record
    amount_owed = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ('expense', 'user')

    def __str__(self):
        return f'{self.user.email} owes ${self.amount_owed} for {self.expense.description}'
