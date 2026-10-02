from django.urls import path
from rest_framework.routers import SimpleRouter

from .item_views import AddOrderItemsView
from .views import (
    DiningTableViewSet,
    KitchenTicketViewSet,
    OrderViewSet,
)


router = SimpleRouter()

router.register(
    "tables",
    DiningTableViewSet,
    basename="dining-table",
)

router.register(
    "kitchen",
    KitchenTicketViewSet,
    basename="kitchen-ticket",
)

router.register(
    "",
    OrderViewSet,
    basename="order",
)

urlpatterns = [
    path(
        "<int:order_id>/add-items/",
        AddOrderItemsView.as_view(),
        name="order-add-items",
    ),
] + router.urls
from .edit_api import ItemEditView, OrderNotesView
urlpatterns += [
    path("<int:order_id>/items/<int:item_id>/", ItemEditView.as_view()),
    path("<int:order_id>/notes/", OrderNotesView.as_view()),
]

from .edit_api import OrderHistoryView
urlpatterns += [path("<int:order_id>/history/", OrderHistoryView.as_view())]
