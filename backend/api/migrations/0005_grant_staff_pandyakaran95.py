from django.db import migrations


def grant_staff(apps, schema_editor):
    User = apps.get_model('api', 'User')
    # Try both casings just in case
    for email in ['pandyakaran95@gmail.com', 'Pandyakaran95@gmail.com']:
        updated = User.objects.filter(email=email).update(is_staff=True, is_superuser=True)
        if updated:
            print(f'Granted staff access to {email}')
            return
    print('WARNING: pandyakaran95@gmail.com not found — sign up first, then re-run migrations')


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_user_username_friendship'),
    ]

    operations = [
        migrations.RunPython(grant_staff, migrations.RunPython.noop),
    ]
