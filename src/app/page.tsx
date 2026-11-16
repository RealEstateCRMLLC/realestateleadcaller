'use client';
import { apiUrl } from '@/lib/api-base';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type DashboardStats = {
  totalLeads: number;
  newLeads: number;
  hotLeads: number;
  dncLeads: number;
  activeWorkflows: number;
  pausedWorkflows: number;
  overdueFollowUps: number;
  conversionRate: string;
  dncRate: string;
  connectRate: string;
  appointmentsSet: number;
  warmTransfersCompleted: number;
};

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const loadStats = () => {
    fetch(apiUrl('/api/dashboard'))
      .then(res => res.json())
      .then(data => setStats(data));
  };

  useEffect(() => {
    loadStats();
  }, []);

  const runEngine = async () => {
    try {
      const res = await fetch(apiUrl('/api/engine/tick'), { method: 'POST' });
      const data = await res.json();
      alert(`Engine ran successfully. Processed ${data.processed} leads.`);
      loadStats();
    } catch (e) {
      alert('Error running engine.');
    }
  };

  const runScoring = async () => {
    try {
      await fetch(apiUrl('/api/inngest'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'scoring/evaluate-pool' })
      });
      alert(`Sent trigger to Inngest to evaluate lead pool scoring. Scores will update shortly.`);
    } catch (e) {
      alert('Error triggering scoring engine.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">AI Real Estate Concierge Dashboard</h1>
          <div className="flex gap-2">
            <button
              onClick={runScoring}
              className="bg-indigo-600 text-white px-4 py-2 rounded shadow hover:bg-indigo-700"
            >
              Re-Score Leads (ML)
            </button>
            <button
              onClick={runEngine}
              className="bg-purple-600 text-white px-4 py-2 rounded shadow hover:bg-purple-700"
            >
              Run Workflow Engine
            </button>
          </div>
        </header>

        {stats ? (
          <>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Pipeline Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <h2 className="text-sm font-medium text-gray-500 uppercase">Total Leads</h2>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stats.totalLeads}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <h2 className="text-sm font-medium text-gray-500 uppercase">New / Uncontacted</h2>
                <p className="mt-2 text-3xl font-semibold text-blue-600">{stats.newLeads}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <h2 className="text-sm font-medium text-gray-500 uppercase">Hot Leads</h2>
                <p className="mt-2 text-3xl font-semibold text-red-600">{stats.hotLeads}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                <h2 className="text-sm font-medium text-gray-500 uppercase">Overdue Follow-ups</h2>
                <p className="mt-2 text-3xl font-semibold text-orange-500">{stats.overdueFollowUps}</p>
              </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-800 mb-4">Team Analytics & Conversion Rates</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200 lg:col-span-2">
                <h2 className="text-sm font-medium text-gray-500 uppercase">Hot Conversion Rate</h2>
                <p className="mt-2 text-3xl font-semibold text-green-600">{stats.conversionRate}%</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200 lg:col-span-2">
                <h2 className="text-sm font-medium text-gray-500 uppercase">AI Connect Rate</h2>
                <p className="mt-2 text-3xl font-semibold text-purple-600">{stats.connectRate}%</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200 lg:col-span-2">
                <h2 className="text-sm font-medium text-gray-500 uppercase">Appointments Set</h2>
                <p className="mt-2 text-3xl font-semibold text-indigo-600">{stats.appointmentsSet}</p>
              </div>

              <div className="bg-white p-6 rounded-lg shadow border border-gray-200 lg:col-span-2">
                <h2 className="text-sm font-medium text-gray-500 uppercase">DNC / Unsubscribe Rate</h2>
                <p className="mt-2 text-3xl font-semibold text-gray-700">{stats.dncRate}%</p>
                <p className="text-xs text-gray-400 mt-1">{stats.dncLeads} total</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200 lg:col-span-2">
                <h2 className="text-sm font-medium text-gray-500 uppercase">Active Workflows</h2>
                <p className="mt-2 text-3xl font-semibold text-blue-500">{stats.activeWorkflows}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border border-gray-200 lg:col-span-2">
                <h2 className="text-sm font-medium text-gray-500 uppercase">Paused Workflows</h2>
                <p className="mt-2 text-3xl font-semibold text-gray-500">{stats.pausedWorkflows}</p>
              </div>
            </div>
          </>
        ) : (
          <p>Loading stats...</p>
        )}

        <div className="flex gap-4">
          <Link href="/leads" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">
            View All Leads
          </Link>
          <Link href="/workflows" className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded shadow hover:bg-gray-50">
            View Workflows
          </Link>
          <Link href="/direct-mail" className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded shadow hover:bg-gray-50">
            Direct Mail Tasks
          </Link>
          <Link href="/settings" className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded shadow hover:bg-gray-50">
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
