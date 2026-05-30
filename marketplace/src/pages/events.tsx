'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import EventManagementPage from '@/features/events/EventManagementPage';

export default function EventsPage() {
  const router = useRouter();
  const { account, loading } = useAuth();

  if (loading) return null;

  return <EventManagementPage />;
}
