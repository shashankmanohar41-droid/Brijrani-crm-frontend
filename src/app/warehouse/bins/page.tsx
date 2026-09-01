import { redirect } from 'next/navigation';

export default function WarehouseBinsRedirectPage() {
  redirect('/masters?tab=bins');
}
