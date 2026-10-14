import { redirect } from 'next/navigation';

export default async function DashboardTabRedirect({
  params,
}: {
  params: Promise<{ tab: string }> | { tab: string };
}) {
  const resolved = await params;
  redirect(`/${resolved?.tab || ''}`);
}
