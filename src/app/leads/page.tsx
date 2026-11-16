'use client';
import { apiUrl } from '@/lib/api-base';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Lead } from '@prisma/client';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    const loadLeads = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (statusFilter) params.append('status', statusFilter);
        if (typeFilter) params.append('type', typeFilter);

        const res = await fetch(apiUrl(`/api/leads?${params.toString()}`));
        if (!res.ok) throw new Error('Failed to fetch leads');
        const data = await res.json();
        setLeads(data);
      } catch (err: any) {
        setError(err.message || 'An error occurred while loading leads.');
      } finally {
        setLoading(false);
      }
    };
    loadLeads();
  }, [search, statusFilter, typeFilter]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
          <div className="space-x-4">
            <Link href="/" className="text-blue-600 hover:underline">Back to Dashboard</Link>
            <Link href="/leads/import" className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded shadow hover:bg-gray-50">Import Leads</Link>
            <Link href="/leads/new" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700">Add New Lead</Link>
          </div>
        </header>

        {error && (
          <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md border border-red-200">
            {error}
          </div>
        )}

        <div className="mb-6 flex flex-col md:flex-row gap-4 bg-white p-4 rounded-lg shadow border border-gray-200">
          <input
            type="text"
            placeholder="Search name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Contacted">Contacted</option>
            <option value="Hot Lead">Hot Lead</option>
            <option value="Appointment Set">Appointment Set</option>
            <option value="Warm Transfer Completed">Warm Transfer Completed</option>
            <option value="Nurture">Nurture</option>
            <option value="Closed/Archived">Closed/Archived</option>
            <option value="Do Not Contact">Do Not Contact</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
          >
            <option value="">All Types</option>
            <option value="Buyer">Buyer</option>
            <option value="Seller">Seller</option>
            <option value="Circle Prospecting">Circle Prospecting</option>
          </select>
        </div>

        {loading ? (
          <p>Loading leads...</p>
        ) : leads.length === 0 ? (
          <p className="text-gray-500">No leads found matching your criteria.</p>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.map(lead => (
                  <tr key={lead.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{lead.first_name} {lead.last_name}</div>
                      <div className="text-sm text-gray-500">{lead.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {lead.lead_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {lead.status}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/leads/${lead.id}`} className="text-blue-600 hover:text-blue-900">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
