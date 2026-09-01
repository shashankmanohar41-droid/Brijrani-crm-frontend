import { redirect } from 'next/navigation';

export default function LogisticsDriversRedirectPage() {
  redirect('/masters?tab=drivers');
}
