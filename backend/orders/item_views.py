from rest_framework.generics import GenericAPIView
from rest_framework.response import Response

from .item_serializers import AddOrderItemsSerializer
from .item_services import add_order_items
from .permissions import CanAccessOrders
from .serializers import OrderSerializer


class AddOrderItemsView(GenericAPIView):
    serializer_class = AddOrderItemsSerializer
    permission_classes = [CanAccessOrders]

    http_method_names = [
        "post",
        "options",
    ]

    def post(self, request, order_id):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order = add_order_items(
            order_id=order_id,
            user=request.user,
            items=serializer.validated_data["items"],
        )

        response_serializer = OrderSerializer(
            order,
            context=self.get_serializer_context(),
        )

        return Response(response_serializer.data)