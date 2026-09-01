import { redirect } from 'next/navigation';

export default function LogisticsVehiclesRedirectPage() {
  redirect('/masters?tab=vehicles');
}
