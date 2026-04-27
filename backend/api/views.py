from django.contrib.auth import get_user_model, authenticate
from django.shortcuts import get_object_or_404
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Count

from .models import Group, GroupMember, GroupInvite, Expense, ExpenseSplit, PasswordResetToken
from .balance import compute_balances
from .serializers import (
    RegisterSerializer,
    UserSerializer,
    GroupSerializer,
    GroupListSerializer,
    GroupInviteSerializer,
    ExpenseSerializer,
    ExpenseCreateSerializer,
    ExpenseUpdateSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
)
from .permissions import IsGroupMember
from .email import send_invite_email, send_password_reset_email

User = get_user_model()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    return Response({'status': 'ok'})


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    user = serializer.save()
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': UserSerializer(user).data}, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    email = request.data.get('email', '').lower()
    password = request.data.get('password', '')
    user = authenticate(request, username=email, password=password)
    if user is None:
        return Response({'detail': 'Invalid email or password.'}, status=status.HTTP_400_BAD_REQUEST)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': UserSerializer(user).data})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    request.user.auth_token.delete()
    return Response({'detail': 'Logged out.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_request(request):
    serializer = PasswordResetRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email = serializer.validated_data['email'].lower()
    frontend_base = request.data.get('frontend_base', 'http://localhost:5173')
    user = User.objects.filter(email=email).first()

    # Always return 200 — don't reveal whether the email exists
    if user:
        token = PasswordResetToken.objects.create(user=user)
        reset_url = f"{frontend_base}/reset-password/{token.token}"
        try:
            send_password_reset_email(to_email=user.email, user_name=user.name, reset_url=reset_url)
        except Exception:
            pass

    return Response({'detail': 'If an account with that email exists, a reset link has been sent.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    serializer = PasswordResetConfirmSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    token_str = serializer.validated_data['token']
    new_password = serializer.validated_data['password']

    token = get_object_or_404(PasswordResetToken, token=token_str)
    if not token.is_valid:
        return Response({'detail': 'This reset link has expired or already been used.'}, status=status.HTTP_400_BAD_REQUEST)

    user = token.user
    user.set_password(new_password)
    user.save()

    from django.utils import timezone as tz
    token.used_at = tz.now()
    token.save(update_fields=['used_at'])

    return Response({'detail': 'Password reset successfully. You can now log in.'})


# ---------------------------------------------------------------------------
# Groups
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def groups(request):
    if request.method == 'GET':
        group_list = (
            Group.objects
            .filter(members__user=request.user)
            .annotate(**{'members__count': Count('members')})
            .select_related('created_by')
        )
        return Response(GroupListSerializer(group_list, many=True).data)

    # POST — create a new group
    serializer = GroupListSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    group = serializer.save(created_by=request.user)
    # Creator is automatically an admin member
    GroupMember.objects.create(group=group, user=request.user, role='admin')
    return Response(GroupListSerializer(group).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated, IsGroupMember])
def group_detail(request, pk):
    group = get_object_or_404(Group, pk=pk)

    if request.method == 'GET':
        group = (
            Group.objects
            .prefetch_related('members__user')
            .annotate(**{'members__count': Count('members')})
            .get(pk=pk)
        )
        return Response(GroupSerializer(group).data)

    # DELETE — only the group creator (admin) can delete
    if group.created_by != request.user:
        return Response({'detail': 'Only the group creator can delete this group.'}, status=status.HTTP_403_FORBIDDEN)
    group.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsGroupMember])
def invite_create(request, group_pk):
    group = get_object_or_404(Group, pk=group_pk)
    emails = request.data.get('emails', [])
    if not emails or not isinstance(emails, list):
        return Response({'detail': 'Provide a non-empty list of emails.'}, status=status.HTTP_400_BAD_REQUEST)

    frontend_base = request.data.get('frontend_base', 'http://localhost:5173')
    created = []
    for email in emails:
        email = email.strip().lower()
        if not email:
            continue
        # Skip if the user is already a member
        existing_user = User.objects.filter(email=email).first()
        if existing_user and GroupMember.objects.filter(group=group, user=existing_user).exists():
            continue
        invite = GroupInvite.objects.create(
            group=group,
            invited_email=email,
            invited_by=request.user,
        )
        invite_url = f"{frontend_base}/invite/{invite.token}"
        try:
            send_invite_email(
                to_email=email,
                invited_by_name=request.user.name,
                group_name=group.name,
                invite_url=invite_url,
            )
        except Exception:
            pass  # email failure should not block the response
        created.append(invite)

    return Response(GroupInviteSerializer(created, many=True).data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsGroupMember])
def invite_link_create(request, group_pk):
    """Create a shareable invite link not tied to a specific email."""
    group = get_object_or_404(Group, pk=group_pk)
    frontend_base = request.data.get('frontend_base', 'http://localhost:5173')
    invite = GroupInvite.objects.create(
        group=group,
        invited_email='',
        invited_by=request.user,
    )
    data = GroupInviteSerializer(invite).data
    data['url'] = f"{frontend_base}/invite/{invite.token}"
    return Response(data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def invite_detail(request, token):
    invite = get_object_or_404(GroupInvite, token=token)
    data = GroupInviteSerializer(invite).data
    data['is_valid'] = invite.is_valid
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_accept(request, token):
    invite = get_object_or_404(GroupInvite, token=token)
    if not invite.is_valid:
        return Response({'detail': 'This invite link has expired or already been used.'}, status=status.HTTP_400_BAD_REQUEST)

    # Add the user to the group (idempotent — ignore if already a member)
    GroupMember.objects.get_or_create(group=invite.group, user=request.user, defaults={'role': 'member'})

    # Mark invite as used
    from django.utils import timezone
    invite.used_at = timezone.now()
    invite.save(update_fields=['used_at'])

    return Response(GroupSerializer(invite.group).data)


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsGroupMember])
def expenses(request, group_pk):
    group = get_object_or_404(Group, pk=group_pk)

    if request.method == 'GET':
        qs = (
            Expense.objects
            .filter(group=group)
            .select_related('paid_by', 'created_by')
            .prefetch_related('splits__user')
            .order_by('-date', '-created_at')
        )
        return Response(ExpenseSerializer(qs, many=True).data)

    # POST — create expense
    serializer = ExpenseCreateSerializer(data=request.data, context={'group': group})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    from decimal import Decimal, ROUND_HALF_UP

    paid_by_user = User.objects.get(pk=data['paid_by'])
    kwargs = {'group': group, 'paid_by': paid_by_user, 'created_by': request.user}
    if 'date' in data:
        kwargs['date'] = data['date']

    expense = Expense.objects.create(
        description=data['description'],
        amount=data['amount'],
        **kwargs,
    )

    if 'splits' in data:
        # Custom percentage split
        split_rows = [
            ExpenseSplit(
                expense=expense,
                user_id=s['user_id'],
                amount_owed=(data['amount'] * s['percentage'] / Decimal(100)).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                ),
            )
            for s in data['splits']
        ]
    else:
        # Equal split
        split_ids = data['split_among']
        per_person = (data['amount'] / Decimal(len(split_ids))).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )
        split_rows = [
            ExpenseSplit(expense=expense, user_id=uid, amount_owed=per_person)
            for uid in split_ids
        ]

    ExpenseSplit.objects.bulk_create(split_rows)
    return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated, IsGroupMember])
def expense_detail(request, group_pk, expense_pk):
    group = get_object_or_404(Group, pk=group_pk)
    expense = get_object_or_404(Expense, pk=expense_pk, group=group)

    if expense.created_by != request.user:
        action = 'edit' if request.method == 'PATCH' else 'delete'
        return Response({'detail': f'Only the expense creator can {action} it.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'DELETE':
        expense.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH — partial update
    serializer = ExpenseUpdateSerializer(data=request.data, context={'group': group})
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    from decimal import Decimal, ROUND_HALF_UP

    if 'paid_by' in data:
        expense.paid_by = User.objects.get(pk=data['paid_by'])
    if 'description' in data:
        expense.description = data['description']
    if 'date' in data:
        expense.date = data['date']

    amount_changed = 'amount' in data
    splits_changed = 'split_among' in data or 'splits' in data

    if amount_changed:
        expense.amount = data['amount']

    if amount_changed or splits_changed:
        new_amount = data.get('amount', expense.amount)
        expense.splits.all().delete()

        if 'splits' in data:
            # Custom percentage split
            split_rows = [
                ExpenseSplit(
                    expense=expense,
                    user_id=s['user_id'],
                    amount_owed=(new_amount * s['percentage'] / Decimal(100)).quantize(
                        Decimal('0.01'), rounding=ROUND_HALF_UP
                    ),
                )
                for s in data['splits']
            ]
        else:
            # Equal split (use provided split_among or fall back to existing split users)
            split_ids = data.get('split_among') or list(
                expense.splits.values_list('user_id', flat=True)
            )
            per_person = (new_amount / Decimal(len(split_ids))).quantize(
                Decimal('0.01'), rounding=ROUND_HALF_UP
            )
            split_rows = [
                ExpenseSplit(expense=expense, user_id=uid, amount_owed=per_person)
                for uid in split_ids
            ]

        ExpenseSplit.objects.bulk_create(split_rows)

    expense.save()
    expense.refresh_from_db()
    return Response(ExpenseSerializer(expense).data)


# ---------------------------------------------------------------------------
# Balances
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsGroupMember])
def balances(request, group_pk):
    group = get_object_or_404(Group, pk=group_pk)
    transfers = compute_balances(group)

    # Resolve user objects for the response
    user_ids = {t['from_user_id'] for t in transfers} | {t['to_user_id'] for t in transfers}
    users = {str(u.id): u for u in User.objects.filter(id__in=user_ids)}

    result = [
        {
            'from_user': UserSerializer(users[t['from_user_id']]).data,
            'to_user': UserSerializer(users[t['to_user_id']]).data,
            'amount': str(t['amount']),
        }
        for t in transfers
    ]
    return Response({'balances': result})


# ---------------------------------------------------------------------------
# Settle Up
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsGroupMember])
def settle(request, group_pk):
    group = get_object_or_404(Group, pk=group_pk)

    to_user_id = request.data.get('to_user_id')
    amount = request.data.get('amount')
    note = request.data.get('note', '')

    if not to_user_id or not amount:
        return Response({'detail': 'to_user_id and amount are required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        from decimal import Decimal as D
        amount_dec = D(str(amount)).quantize(D('0.01'))
        if amount_dec <= 0:
            raise ValueError
    except Exception:
        return Response({'detail': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

    to_user = get_object_or_404(User, pk=to_user_id)
    if not GroupMember.objects.filter(group=group, user=to_user).exists():
        return Response({'detail': 'Recipient must be a group member.'}, status=status.HTTP_400_BAD_REQUEST)

    description = note.strip() or f'Settlement: {request.user.name} → {to_user.name}'

    expense = Expense.objects.create(
        group=group,
        description=description,
        amount=amount_dec,
        paid_by=request.user,
        created_by=request.user,
        is_settlement=True,
    )
    # Settlement split: to_user owes the full amount (payer is making them whole)
    ExpenseSplit.objects.create(expense=expense, user=to_user, amount_owed=amount_dec)

    return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# AI Receipt Scanner
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def receipt_scan(request):
    import os, json as _json
    import google.generativeai as genai

    image_file = request.FILES.get('image')
    if not image_file:
        return Response({'detail': 'No image provided.'}, status=status.HTTP_400_BAD_REQUEST)

    api_key = os.getenv('GEMINI_API_KEY', '')
    if not api_key:
        return Response({'detail': 'Receipt scanning is not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')

    content_type = image_file.content_type or 'image/jpeg'
    image_data = {'mime_type': content_type, 'data': image_file.read()}

    prompt = (
        'Extract the total amount from this receipt. '
        'Reply with JSON only, no markdown: '
        '{"amount": "XX.XX", "description": "brief merchant or category description"}. '
        'If you cannot find a clear total, return {"amount": null, "description": null}.'
    )

    response = model.generate_content([image_data, prompt])

    try:
        result = _json.loads(response.text)
    except Exception:
        result = {'amount': None, 'description': None}

    return Response(result)
