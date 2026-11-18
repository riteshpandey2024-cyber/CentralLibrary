export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    const errObj = data as { error?: string; message?: string } | null;
    throw new Error(errObj?.error || errObj?.message || `Request failed (${response.status})`);
  }

  return data as T;
}

export interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export function openRazorpayCheckout(options: {
  key: string;
  amountPaise: number;
  orderId: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  onSuccess: (res: RazorpayHandlerResponse) => void;
  onDismiss?: () => void;
}) {
  const win = window as unknown as {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  };
  if (!win.Razorpay) {
    throw new Error('Razorpay checkout script failed to load. Please refresh the page.');
  }
  const rzp = new win.Razorpay({
    key: options.key,
    amount: options.amountPaise,
    currency: 'INR',
    name: options.name,
    description: options.description,
    order_id: options.orderId,
    prefill: options.prefill,
    theme: { color: '#101D35' },
    handler: options.onSuccess,
    modal: {
      ondismiss: options.onDismiss,
    },
  });
  rzp.open();
}
