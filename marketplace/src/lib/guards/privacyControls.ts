import { User } from '@/types';

export async function getPrivacyDashboardData(userId: string): Promise<any> {
  const response = await fetch(`/api/users/${userId}`);
  if (!response.ok) throw new Error('Failed to fetch user data');
  return response.json();
}

export async function downloadDataExport(userId: string): Promise<void> {
  const data = await getPrivacyDashboardData(userId);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `user-data-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteAccountPermanently(userId: string): Promise<void> {
  const response = await fetch('/api/users', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  if (!response.ok) throw new Error('Failed to delete account');
}
