'use client';

import { useParams, notFound } from 'next/navigation';
import DashboardContent from '@/components/DashboardContent';

const VALID_TABS = ['overview', 'scheduled', 'sent', 'starred', 'trash', 'senders', 'profile'];

export default function TabPage() {
  const params = useParams();
  const currentTab = (params?.tab as string)?.toLowerCase();
  if (currentTab && !VALID_TABS.includes(currentTab)) {
    notFound();
  }
  return <DashboardContent />;
}
