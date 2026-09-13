export interface OrderItem {
  itemId: string;
  width: number;
  length: number;
  depth: number;
  quantity: number;
}

export interface OrderBox {
  boxId: string;
  width: number;
  length: number;
  depth: number;
  items: OrderItem[];
}

export interface Order {
  orderId: string;
  boxes: OrderBox[];
}