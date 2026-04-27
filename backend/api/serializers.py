from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Group, GroupMember, GroupInvite, Expense, ExpenseSplit

User = get_user_model()


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(required=True, max_length=255)
    email = serializers.EmailField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value.lower()

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            name=validated_data['name'],
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'avatar_url', 'created_at']
        read_only_fields = ['id', 'created_at']


class GroupMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = GroupMember
        fields = ['id', 'user', 'role', 'joined_at']


class GroupListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the groups list — omits the full member list."""
    created_by = UserSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'created_by', 'member_count', 'created_at']
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_member_count(self, obj):
        # Use annotated value when available (avoids extra query)
        if hasattr(obj, 'members__count'):
            return obj.members__count
        return obj.members.count()


class GroupSerializer(GroupListSerializer):
    members = GroupMemberSerializer(many=True, read_only=True)

    class Meta(GroupListSerializer.Meta):
        fields = GroupListSerializer.Meta.fields + ['members']


class GroupInviteSerializer(serializers.ModelSerializer):
    invited_by = UserSerializer(read_only=True)
    group = GroupListSerializer(read_only=True)

    class Meta:
        model = GroupInvite
        fields = ['id', 'group', 'invited_email', 'invited_by', 'expires_at', 'is_valid']


class ExpenseSplitSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = ['id', 'user', 'amount_owed']


class ExpenseSerializer(serializers.ModelSerializer):
    paid_by = UserSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    splits = ExpenseSplitSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = [
            'id', 'description', 'amount', 'paid_by', 'date',
            'created_by', 'created_at', 'is_settlement', 'splits',
        ]


class ExpenseUpdateSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=255, required=False)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'), required=False)
    paid_by = serializers.UUIDField(required=False)
    split_among = serializers.ListField(child=serializers.UUIDField(), min_length=1, required=False)
    date = serializers.DateField(required=False)

    def validate(self, data):
        group = self.context['group']
        member_ids = set(group.members.values_list('user_id', flat=True))

        if 'paid_by' in data and data['paid_by'] not in member_ids:
            raise serializers.ValidationError({'paid_by': 'Payer must be a group member.'})

        if 'split_among' in data:
            unknown = set(data['split_among']) - member_ids
            if unknown:
                raise serializers.ValidationError({'split_among': 'All split members must be group members.'})

        return data


class ExpenseCreateSerializer(serializers.Serializer):
    description = serializers.CharField(max_length=255)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal('0.01'))
    paid_by = serializers.UUIDField()
    split_among = serializers.ListField(child=serializers.UUIDField(), min_length=1)
    date = serializers.DateField(required=False)

    def validate(self, data):
        group = self.context['group']
        member_ids = set(
            group.members.values_list('user_id', flat=True)
        )

        if data['paid_by'] not in member_ids:
            raise serializers.ValidationError({'paid_by': 'Payer must be a group member.'})

        unknown = set(data['split_among']) - member_ids
        if unknown:
            raise serializers.ValidationError({'split_among': 'All split members must be group members.'})

        return data
