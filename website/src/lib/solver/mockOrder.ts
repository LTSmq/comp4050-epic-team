import { Order } from "./types";

export const mockOrder: Order = {
  orderId: "22",

  boxes: [
    {
      boxId: "box-1",

      width: 100,
      length: 80,
      depth: 60,

      items: [
        {
          itemId: "item-1",
          width: 20,
          length: 15,
          depth: 10,
          quantity: 2,
        },

        {
          itemId: "item-2",
          width: 30,
          length: 20,
          depth: 15,
          quantity: 1,
        },
      ],
    },
  ],
};



//temporarily we're pretending this came from the database: