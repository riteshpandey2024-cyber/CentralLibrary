import { Printer, X } from 'lucide-react';

export interface ReceiptData {
  receiptNumber: string;
  libraryName: string;
  libraryAddress: string;
  libraryPhone: string;
  libraryEmail: string;
  memberName: string;
  memberEmail: string;
  memberMobile: string;
  planName: string;
  amountInr: number;
  currency: string;
  paymentMethod: string;
  status: string;
  paidAt: string;
  razorpayPaymentId?: string | null;
}

interface ReceiptModalProps {
  receipt: ReceiptData | null;
  onClose: () => void;
}

export function ReceiptModal({ receipt, onClose }: ReceiptModalProps) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#101D35]/65 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-[#E2DFD5] rounded-xl max-w-lg w-full p-6 sm:p-8 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#E2DFD5] pb-4">
          <div>
            <p className="text-xs font-medium text-[#737B89]">Official Payment Receipt</p>
            <h3 className="font-serif text-xl font-bold text-[#101D35] mt-0.5">
              {receipt.libraryName}
            </h3>
            <p className="text-xs text-[#737B89] mt-1">{receipt.libraryAddress}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#737B89] hover:text-[#101D35] p-1"
            aria-label="Close receipt"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-[#737B89]">Receipt / Transaction ID</span>
            <span className="font-mono text-[#101D35] font-medium tabular-nums">
              {receipt.receiptNumber}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#737B89]">Member Name</span>
            <span className="text-[#101D35] font-medium">{receipt.memberName}</span>
          </div>
          {receipt.memberMobile && (
            <div className="flex justify-between gap-4">
              <span className="text-[#737B89]">Mobile</span>
              <span className="font-mono text-[#101D35] tabular-nums">{receipt.memberMobile}</span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-[#737B89]">Membership Plan</span>
            <span className="text-[#101D35] font-medium">{receipt.planName}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#737B89]">Payment Method</span>
            <span className="text-[#101D35] uppercase text-xs font-semibold">
              {receipt.paymentMethod.replace('_', ' ')}
            </span>
          </div>
          {receipt.razorpayPaymentId && (
            <div className="flex justify-between gap-4">
              <span className="text-[#737B89]">Gateway Reference</span>
              <span className="font-mono text-xs text-[#101D35] tabular-nums">
                {receipt.razorpayPaymentId}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-[#737B89]">Date</span>
            <span className="text-[#101D35] tabular-nums">
              {new Date(receipt.paidAt).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[#737B89]">Status</span>
            <span className="font-semibold text-emerald-700 capitalize">{receipt.status}</span>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-[#E2DFD5] flex items-center justify-between">
          <div>
            <span className="text-xs text-[#737B89] block">Amount Paid</span>
            <span className="font-serif text-2xl font-bold text-[#101D35] tabular-nums">
              &#8377;{receipt.amountInr.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#101D35] text-white text-sm font-medium hover:bg-[#172943] transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
