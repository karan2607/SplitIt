"""
Simplified debt algorithm.

Given a group, computes the minimum number of transfers needed to settle
all balances. Returns a list of dicts: {from_user, to_user, amount}.

Strategy:
  1. Compute each member's net balance:
       net = sum(paid_by amounts) - sum(amount_owed amounts)
       positive  → they are owed money (creditor)
       negative  → they owe money (debtor)
  2. Greedily match the largest creditor with the largest debtor until
     all balances are zero.
"""

from decimal import Decimal, ROUND_HALF_UP
from .models import Expense, ExpenseSplit


def compute_balances(group):
    net = {}  # user_id (str) -> Decimal

    expenses = (
        Expense.objects
        .filter(group=group)
        .select_related('paid_by')
        .prefetch_related('splits__user')
    )

    for expense in expenses:
        paid_id = str(expense.paid_by_id)
        net[paid_id] = net.get(paid_id, Decimal('0')) + expense.amount
        for split in expense.splits.all():
            uid = str(split.user_id)
            net[uid] = net.get(uid, Decimal('0')) - split.amount_owed

    # Separate into creditors (net > 0) and debtors (net < 0)
    creditors = [[uid, amt] for uid, amt in net.items() if amt > 0]
    debtors = [[uid, -amt] for uid, amt in net.items() if amt < 0]

    creditors.sort(key=lambda x: -x[1])
    debtors.sort(key=lambda x: -x[1])

    transfers = []
    i = j = 0
    while i < len(creditors) and j < len(debtors):
        cred_id, cred_amt = creditors[i]
        debt_id, debt_amt = debtors[j]

        transfer = min(cred_amt, debt_amt).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        if transfer > 0:
            transfers.append({
                'from_user_id': debt_id,
                'to_user_id': cred_id,
                'amount': transfer,
            })

        creditors[i][1] = (cred_amt - transfer).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        debtors[j][1] = (debt_amt - transfer).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        if creditors[i][1] == 0:
            i += 1
        if debtors[j][1] == 0:
            j += 1

    return transfers
