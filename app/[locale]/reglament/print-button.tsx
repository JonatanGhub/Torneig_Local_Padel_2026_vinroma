'use client';

import { Download } from 'lucide-react';

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="bg-crimson-600 hover:bg-crimson-500 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors print:hidden"
    >
      <Download className="size-4" />
      {label}
    </button>
  );
}
