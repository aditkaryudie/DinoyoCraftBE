declare module 'midtrans-client' {
  export interface MidtransClientOptions {
    isProduction?: boolean;
    serverKey?: string;
    clientKey?: string;
  }

  export interface Transaction {
    status(orderId: string): Promise<any>;
    approve(orderId: string): Promise<any>;
    cancel(orderId: string): Promise<any>;
    expire(orderId: string): Promise<any>;
    refund(orderId: string, parameter?: any): Promise<any>;
    notification(notificationJsonOrString: any): Promise<any>;
  }

  export class Snap {
    constructor(options?: MidtransClientOptions);
    transaction: Transaction;
    createTransaction(parameter: any): Promise<any>;
    createTransactionToken(parameter: any): Promise<string>;
    createTransactionRedirectUrl(parameter: any): Promise<string>;
  }

  export class CoreApi {
    constructor(options?: MidtransClientOptions);
    charge(parameter: any): Promise<any>;
    transaction: Transaction;
  }

  const midtransClient: {
    Snap: typeof Snap;
    CoreApi: typeof CoreApi;
  };

  export default midtransClient;
}

