import { redirect } from 'next/navigation';

export default function FinanceIncomeRedirect() {
  redirect('/finance/receipts');
}
