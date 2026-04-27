from rest_framework.permissions import BasePermission

from .models import GroupMember


class IsGroupMember(BasePermission):
    """Allows access only to members of the group identified by `group_pk` or `pk` in the URL."""

    message = 'You are not a member of this group.'

    def has_permission(self, request, view):
        group_id = view.kwargs.get('group_pk') or view.kwargs.get('pk')
        if not group_id:
            return False
        return GroupMember.objects.filter(
            group_id=group_id,
            user=request.user,
        ).exists()
