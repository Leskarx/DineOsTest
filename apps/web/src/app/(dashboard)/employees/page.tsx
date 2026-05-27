'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPost, apiPut, apiDelete } from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth.store';
import { Plus, Edit2, UserX, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLES = ['owner', 'manager', 'cashier', 'waiter', 'kitchen', 'inventory', 'housekeeping', 'receptionist'];

const ROLE_COLORS: Record<string, string> = {
  owner: 'badge-yellow', manager: 'badge-blue', cashier: 'badge-green',
  waiter: 'badge-slate', kitchen: 'badge-red', inventory: 'badge-slate',
  housekeeping: 'badge-blue', receptionist: 'badge-purple'
};

export default function EmployeesPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', role: 'cashier', password: '', pin: '', employeeCode: '' });

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => apiFetch('/api/v1/users').then((r) => r.data) });

  const saveMutation = useMutation({
    mutationFn: () => editUser ? apiPut(`/api/v1/users/${editUser.id}`, form) : apiPost('/api/v1/users', form),
    onSuccess: () => { toast.success('Employee saved'); qc.invalidateQueries({ queryKey: ['users'] }); setShowForm(false); setEditUser(null); setForm({ firstName: '', lastName: '', email: '', phone: '', role: 'cashier', password: '', pin: '', employeeCode: '' }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/v1/users/${id}`),
    onSuccess: () => { toast.success('Employee deactivated'); qc.invalidateQueries({ queryKey: ['users'] }); },
    onError: () => toast.error('Failed'),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Employees</h1>
          <p className="text-sm text-slate-400">{users?.length || 0} active staff members</p>
        </div>
        <button onClick={() => { setEditUser(null); setShowForm(true); }} className="btn-primary"><Plus size={14} /> Add Employee</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-800/50"><tr><th className="th">Name</th><th className="th">Contact</th><th className="th">Role</th><th className="th">Employee Code</th><th className="th">Actions</th></tr></thead>
          <tbody>
            {users?.map((user: any) => (
              <tr key={user.id} className="table-row">
                <td className="td">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white">{user.firstName?.[0]}{user.lastName?.[0]}</div>
                    <div><div className="font-medium">{user.firstName} {user.lastName}</div></div>
                  </div>
                </td>
                <td className="td text-slate-400 text-xs"><div>{user.email}</div><div>{user.phone}</div></td>
                <td className="td"><span className={ROLE_COLORS[user.role] || 'badge-slate'}>{user.role}</span></td>
                <td className="td text-slate-400 font-mono">{user.employeeCode || '—'}</td>
                <td className="td">
                  <div className="flex gap-2">
                    <button onClick={() => { setEditUser(user); setForm({ firstName: user.firstName, lastName: user.lastName || '', email: user.email || '', phone: user.phone || '', role: user.role, password: '', pin: user.pin || '', employeeCode: user.employeeCode || '' }); setShowForm(true); }} className="btn-ghost p-1.5"><Edit2 size={13} /></button>
                    <button onClick={() => { if (confirm('Deactivate this employee?')) deactivateMutation.mutate(user.id); }} className="btn-ghost p-1.5 text-red-400 hover:text-red-300"><UserX size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {users?.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-slate-500">No employees added yet</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-white text-lg">{editUser ? 'Edit Employee' : 'Add Employee'}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">First Name *</label><input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
              <div><label className="label">Last Name</label><input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div>
                <label className="label">Role *</label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLES.filter(r => user?.role === 'owner' ? true : !['owner', 'manager'].includes(r)).map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div><label className="label">Employee Code</label><input className="input" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })} /></div>
              {!editUser && <div><label className="label">Password *</label><input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>}
              <div><label className="label">PIN (4-6 digits)</label><input className="input" type="password" maxLength={6} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} placeholder="Optional fast login" /></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.firstName || (!editUser && !form.password)} className="btn-primary flex-1">
                {saveMutation.isPending ? 'Saving...' : 'Save Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
