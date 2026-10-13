export interface Cart {
  id: string;
  email: string;
  items: string[];
  total: number;
}

export interface Charge {
  id: string;
  receiptUrl: string;
}

export const inventory = {
  async hold(items: string[]): Promise<string> {
    return `hold_${items.join('+')}`;
  },
  async release(hold: string): Promise<void> {
    void hold;
  }
};

export const stripe = {
  async charge(amount: number): Promise<Charge> {
    return { id: `ch_${amount}`, receiptUrl: `https://receipts.test/${amount}` };
  },
  async refund(chargeId: string): Promise<void> {
    void chargeId;
  }
};

export const courier = {
  async book(cart: Cart, chargeId: string): Promise<{ id: string }> {
    return { id: `trk_${cart.id}_${chargeId}` };
  }
};

export const mail = {
  async send(to: string, url: string): Promise<void> {
    void to;
    void url;
  }
};
