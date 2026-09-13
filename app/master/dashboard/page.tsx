import { redirect } from 'next/navigation'

export default async function MasterDashboardRedirect() {
  redirect('/master-admin')
}
