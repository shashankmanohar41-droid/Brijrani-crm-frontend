import { redirect } from 'next/navigation';

export default function WarehouseOutwardRedirect() {
  redirect('/sales/delivery-challans');
}
