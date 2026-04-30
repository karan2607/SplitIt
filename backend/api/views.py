from django.contrib.auth import get_user_model, authenticate
from django.shortcuts import get_object_or_404
from django.db.models import Count, Q
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from .models import Group, GroupMember, GroupInvite, Expense, ExpenseSplit, PasswordResetToken, Friendship
from .balance import compute_balances
from .serializers import (
    RegisterSerializer,
    UserSerializer,
    GroupSerializer,
    GroupListSerializer,
    GroupInviteSerializer,
    FriendshipSerializer,
    ExpenseSerializer,
    ExpenseCreateSerializer,
    ExpenseUpdateSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    PasswordChangeSerializer,
    UpdateProfileSerializer,
)
from .permissions import IsGroupMember
from .email import send_password_reset_email

User = get_user_model()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    from django.conf import settings
    db_engine = settings.DATABASES['default']['ENGINE']
    return Response({'status': 'ok', 'db': db_engine})


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


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def me(request):
    if request.method == 'PATCH':
        ser = UpdateProfileSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
        update_fields = []
        if 'name' in ser.validated_data:
            request.user.name = ser.validated_data['name']
            update_fields.append('name')
        if 'username' in ser.validated_data:
            new_username = ser.validated_data['username']
            if User.objects.filter(username=new_username).exclude(pk=request.user.pk).exists():
                return Response({'username': 'This username is already taken.'}, status=status.HTTP_400_BAD_REQUEST)
            request.user.username = new_username
            update_fields.append('username')
        if 'avatar_url' in ser.validated_data:
            request.user.avatar_url = ser.validated_data['avatar_url'] or None
            update_fields.append('avatar_url')
        if update_fields:
            request.user.save(update_fields=update_fields)
        return Response(UserSerializer(request.user).data)
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def password_change(request):
    ser = PasswordChangeSerializer(data=request.data)
    if not ser.is_valid():
        return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)
    if not request.user.check_password(ser.validated_data['current_password']):
        return Response({'detail': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
    request.user.set_password(ser.validated_data['new_password'])
    request.user.save()
    # Rotate token so other sessions are invalidated
    Token.objects.filter(user=request.user).delete()
    token = Token.objects.create(user=request.user)
    return Response({'token': token.key})


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
            .filter(pk__in=GroupMember.objects.filter(user=request.user).values('group_id'))
            .annotate(**{'members__count': Count('members')})
            .select_related('created_by')
        )
        return Response(GroupListSerializer(group_list, many=True, context={'request': request}).data)

    # POST — create a new group
    serializer = GroupListSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    group = serializer.save(created_by=request.user)
    # Creator is automatically an admin member
    GroupMember.objects.create(group=group, user=request.user, role='admin')
    return Response(GroupListSerializer(group).data, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
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

    # PATCH / DELETE — admin only
    is_admin = GroupMember.objects.filter(group=group, user=request.user, role='admin').exists()
    if not is_admin:
        return Response({'detail': 'Only group admins can do this.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PATCH':
        update_fields = []
        if 'name' in request.data:
            name = str(request.data['name']).strip()
            if not name:
                return Response({'name': 'Name cannot be blank.'}, status=status.HTTP_400_BAD_REQUEST)
            group.name = name
            update_fields.append('name')
        if 'description' in request.data:
            group.description = request.data['description'] or None
            update_fields.append('description')
        if update_fields:
            group.save(update_fields=update_fields)
        group = (
            Group.objects
            .prefetch_related('members__user')
            .annotate(**{'members__count': Count('members')})
            .get(pk=pk)
        )
        return Response(GroupSerializer(group).data)

    # DELETE
    group.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Invite links (shareable, no email required)
# ---------------------------------------------------------------------------

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
    GroupMember.objects.get_or_create(group=invite.group, user=request.user, defaults={'role': 'member'})
    from django.utils import timezone
    invite.used_at = timezone.now()
    invite.save(update_fields=['used_at'])
    return Response(GroupSerializer(invite.group).data)


# ---------------------------------------------------------------------------
# User Search
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_search(request):
    q = request.query_params.get('q', '').strip()
    if len(q) < 2:
        return Response([])
    users = (
        User.objects
        .filter(Q(username__icontains=q) | Q(name__icontains=q))
        .exclude(id=request.user.id)
        [:20]
    )
    return Response(UserSerializer(users, many=True).data)


# ---------------------------------------------------------------------------
# Friends
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def friends(request):
    if request.method == 'GET':
        friendships = (
            Friendship.objects
            .filter(Q(from_user=request.user) | Q(to_user=request.user))
            .select_related('from_user', 'to_user')
        )
        return Response(FriendshipSerializer(friendships, many=True).data)

    # POST — send friend request
    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    target = get_object_or_404(User, pk=user_id)
    if target == request.user:
        return Response({'detail': 'You cannot add yourself.'}, status=status.HTTP_400_BAD_REQUEST)

    existing = Friendship.objects.filter(
        Q(from_user=request.user, to_user=target) | Q(from_user=target, to_user=request.user)
    ).first()
    if existing:
        msg = 'Already friends.' if existing.status == 'accepted' else 'Friend request already pending.'
        return Response({'detail': msg}, status=status.HTTP_400_BAD_REQUEST)

    friendship = Friendship.objects.create(from_user=request.user, to_user=target)
    return Response(FriendshipSerializer(friendship).data, status=status.HTTP_201_CREATED)


@api_view(['POST', 'DELETE'])
@permission_classes([IsAuthenticated])
def friend_detail(request, pk):
    friendship = get_object_or_404(Friendship, pk=pk)

    if request.user not in (friendship.from_user, friendship.to_user):
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'POST':
        # Accept — recipient only
        if friendship.to_user != request.user:
            return Response({'detail': 'Only the recipient can accept a friend request.'}, status=status.HTTP_403_FORBIDDEN)
        if friendship.status == 'accepted':
            return Response({'detail': 'Already friends.'}, status=status.HTTP_400_BAD_REQUEST)
        friendship.status = 'accepted'
        friendship.save(update_fields=['status'])
        return Response(FriendshipSerializer(friendship).data)

    # DELETE — either party can remove/reject
    friendship.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Group Members — direct add
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsGroupMember])
def group_add_member(request, pk):
    group = get_object_or_404(Group, pk=pk)

    user_id = request.data.get('user_id')
    if not user_id:
        return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    target = get_object_or_404(User, pk=user_id)

    _, created = GroupMember.objects.get_or_create(group=group, user=target, defaults={'role': 'member'})
    if not created:
        return Response({'detail': f'{target.name} is already in this group.'}, status=status.HTTP_400_BAD_REQUEST)

    group = (
        Group.objects
        .prefetch_related('members__user')
        .annotate(**{'members__count': Count('members')})
        .get(pk=pk)
    )
    return Response(GroupSerializer(group).data)


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
    is_creator = expense.created_by == request.user
    is_admin = GroupMember.objects.filter(group=group, user=request.user, role='admin').exists()

    if request.method == 'DELETE':
        if not is_creator and not is_admin:
            return Response({'detail': 'Only the expense creator or a group admin can delete it.'}, status=status.HTTP_403_FORBIDDEN)
        expense.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PATCH — creator only
    if not is_creator:
        return Response({'detail': 'Only the expense creator can edit it.'}, status=status.HTTP_403_FORBIDDEN)

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
    import os, base64, json as _json, logging
    import urllib.request, urllib.error

    upload = request.FILES.get('image')
    if not upload:
        return Response({'detail': 'No file provided.'}, status=status.HTTP_400_BAD_REQUEST)

    content_type = upload.content_type or 'image/jpeg'
    allowed = {'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'}
    if content_type not in allowed:
        return Response({'detail': 'Unsupported file type.'}, status=status.HTTP_400_BAD_REQUEST)

    api_key = os.getenv('GEMINI_API_KEY', '')
    if not api_key:
        return Response({'detail': 'Receipt scanning is not configured.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    file_bytes = upload.read()
    b64 = base64.b64encode(file_bytes).decode()
    prompt = (
        'Extract the total amount from this receipt. '
        'Reply with JSON only, no markdown: '
        '{"amount": "XX.XX", "description": "brief merchant or category description"}. '
        'If you cannot find a clear total, return {"amount": null, "description": null}.'
    )

    payload = _json.dumps({
        'contents': [{
            'parts': [
                {'inline_data': {'mime_type': content_type, 'data': b64}},
                {'text': prompt},
            ]
        }],
        'generationConfig': {'response_mime_type': 'application/json'},
    }).encode()

    url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}'
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})

    try:
        with urllib.request.urlopen(req) as resp:
            data = _json.loads(resp.read())
        text = data['candidates'][0]['content']['parts'][0]['text']
        result = _json.loads(text)
    except _json.JSONDecodeError:
        result = {'amount': None, 'description': None}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        logging.getLogger(__name__).error("Gemini API HTTP error %s: %s", exc.code, body)
        return Response({'detail': f'Scan failed: {exc.code} {body}'}, status=status.HTTP_502_BAD_GATEWAY)
    except Exception as exc:
        logging.getLogger(__name__).error("Gemini receipt scan error: %s", exc, exc_info=True)
        return Response({'detail': f'Scan failed: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)

    return Response(result)
