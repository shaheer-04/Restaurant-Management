from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Create the restaurant's staff role groups."

    def handle(self, *args, **options):
        for role_name in ["Manager", "Cashier", "Kitchen"]:
            group, created = Group.objects.get_or_create(
                name=role_name
            )

            result = "Created" if created else "Already exists"

            self.stdout.write(
                self.style.SUCCESS(f"{result}: {group.name}")
            )