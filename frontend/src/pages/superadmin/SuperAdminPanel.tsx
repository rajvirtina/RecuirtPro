import { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';
import { format } from 'date-fns';

interface Company {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  website?: string;
  description?: string;
  industry?: string;
  size?: string;
  status: string;
  emailVerified?: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface CompanyAdmin {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  companyId: {
    _id: string;
    name: string;
  };
  status: string;
  emailVerified?: boolean;
  lastLogin?: string;
  createdAt: string;
}

interface CompanyDetail {
  company: Company;
  admins: CompanyAdmin[];
}

export default function SuperAdminPanel() {
  const [activeTab, setActiveTab] = useState<'companies' | 'admins'>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [admins, setAdmins] = useState<CompanyAdmin[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Detail drawers
  const [selectedCompany, setSelectedCompany] = useState<CompanyDetail | null>(null);
  const [showCompanyDetail, setShowCompanyDetail] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<CompanyAdmin | null>(null);
  const [showAdminDetail, setShowAdminDetail] = useState(false);

  // Edit modes
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyEditForm, setCompanyEditForm] = useState({ name: '', phone: '', website: '', industry: '', size: '', description: '' });
  const [editingAdmin, setEditingAdmin] = useState(false);
  const [adminEditForm, setAdminEditForm] = useState({ firstName: '', lastName: '', status: '' });

  // Company Form
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: '',
    email: '',
    phone: '',
    website: '',
  });

  // Admin Form
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [adminForm, setAdminForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    companyId: '',
    role: 'admin',
  });

  useEffect(() => {
    fetchCompanies();
    fetchAdmins();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await apiClient.get('/admin/companies');
      setCompanies(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch companies');
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await apiClient.get('/admin/users?role=admin,hr');
      setAdmins(response.data || []);
    } catch (err: any) {
      console.error('Failed to fetch admins:', err);
    }
  };

  const fetchCompanyDetail = async (companyId: string) => {
    try {
      const response = await apiClient.get(`/admin/companies/${companyId}`);
      setSelectedCompany(response.data || null);
      setShowCompanyDetail(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch company details');
    }
  };

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      await apiClient.post('/admin/companies', companyForm);
      setSuccess('Company created successfully! Verification email sent.');
      setShowCompanyForm(false);
      setCompanyForm({ name: '', email: '', phone: '', website: '' });
      await fetchCompanies();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create company');
    }
  };

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');

      // Validate email domain matches selected company
      if (adminForm.companyId && adminForm.email) {
        const selectedCompanyObj = companies.find(c => c._id === adminForm.companyId);
        if (selectedCompanyObj) {
          const companyDomain = selectedCompanyObj.email.toLowerCase().split('@')[1];
          const adminDomain = adminForm.email.toLowerCase().split('@')[1];
          if (adminDomain !== companyDomain) {
            setError(`Email domain "@${adminDomain}" does not match company domain "@${companyDomain}". Admin must use a company email address.`);
            return;
          }
        }
      }

      await apiClient.post('/admin/users', adminForm);
      setSuccess('Company admin created successfully!');
      setShowAdminForm(false);
      setAdminForm({ firstName: '', lastName: '', email: '', password: '', companyId: '', role: 'admin' });
      await fetchAdmins();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create admin');
    }
  };

  const deleteCompany = async (companyId: string) => {
    if (!confirm('Are you sure? This will delete all associated data.')) return;
    try {
      setError('');
      await apiClient.delete(`/admin/companies/${companyId}`);
      setSuccess('Company deleted successfully');
      setShowCompanyDetail(false);
      await fetchCompanies();
      await fetchAdmins();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete company');
    }
  };

  const deleteAdmin = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this admin?')) return;
    try {
      setError('');
      await apiClient.delete(`/admin/users/${userId}`);
      setSuccess('Admin deleted successfully');
      setShowAdminDetail(false);
      await fetchAdmins();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete admin');
    }
  };

  const startEditCompany = () => {
    if (!selectedCompany) return;
    setCompanyEditForm({
      name: selectedCompany.company.name || '',
      phone: selectedCompany.company.phone || '',
      website: selectedCompany.company.website || '',
      industry: selectedCompany.company.industry || '',
      size: selectedCompany.company.size || '',
      description: selectedCompany.company.description || '',
    });
    setEditingCompany(true);
  };

  const saveCompany = async () => {
    if (!selectedCompany) return;
    try {
      setError('');
      await apiClient.put(`/admin/companies/${selectedCompany.company._id}`, companyEditForm);
      setSuccess('Company updated successfully');
      setEditingCompany(false);
      await fetchCompanies();
      await fetchCompanyDetail(selectedCompany.company._id);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update company');
    }
  };

  const startEditAdmin = () => {
    if (!selectedAdmin) return;
    setAdminEditForm({
      firstName: selectedAdmin.firstName || '',
      lastName: selectedAdmin.lastName || '',
      status: selectedAdmin.status || 'active',
    });
    setEditingAdmin(true);
  };

  const saveAdmin = async () => {
    if (!selectedAdmin) return;
    try {
      setError('');
      await apiClient.put(`/admin/users/${selectedAdmin._id}`, adminEditForm);
      setSuccess('Admin updated successfully');
      setEditingAdmin(false);
      await fetchAdmins();
      // refresh the selected admin data
      const response = await apiClient.get('/admin/users?role=admin,hr');
      const updated = (response.data || []).find((a: CompanyAdmin) => a._id === selectedAdmin._id);
      if (updated) setSelectedAdmin(updated);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update admin');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
      suspended: 'bg-red-100 text-red-800',
      pending_verification: 'bg-yellow-100 text-yellow-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Super Admin Panel</h1>
        <p className="text-gray-600">Manage customer companies and their administrators</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center">
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">&times;</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
          <span className="text-green-700">{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-500 hover:text-green-700">&times;</button>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('companies')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'companies'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Companies ({companies.length})
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`px-4 py-2 font-medium transition ${
              activeTab === 'admins'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Company Admins ({admins.length})
          </button>
        </div>
      </div>

      {/* ==================== Companies Tab ==================== */}
      {activeTab === 'companies' && (
        <div>
          <div className="mb-6">
            <button
              onClick={() => setShowCompanyForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              + Add New Company
            </button>
          </div>

          {/* Company Form Modal */}
          {showCompanyForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Create New Company</h2>
                <p className="text-sm text-gray-500 mb-4">A verification email will be sent to the company email address.</p>
                <form onSubmit={createCompany} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                    <input type="text" required value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="ABC Corporation" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input type="email" required value={companyForm.email}
                      onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="contact@abc.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input type="tel" value={companyForm.phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="+1234567890" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input type="url" value={companyForm.website}
                      onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://abc.com" />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                      Create Company
                    </button>
                    <button type="button" onClick={() => setShowCompanyForm(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Companies Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {companies.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-5xl mb-4">🏢</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No companies yet</h3>
                <p className="text-gray-500 mb-4">Get started by creating your first company</p>
                <button onClick={() => setShowCompanyForm(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                  + Add First Company
                </button>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {companies.map((company) => (
                    <tr key={company._id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => fetchCompanyDetail(company._id)}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{company.name}</div>
                        {company.website && (
                          <span className="text-xs text-indigo-600">{company.website}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{company.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(company.status)}`}>
                          {company.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {company.emailVerified ? (
                          <span className="text-green-600 text-sm font-medium">Verified</span>
                        ) : (
                          <span className="text-yellow-600 text-sm font-medium">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {format(new Date(company.createdAt), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteCompany(company._id); }}
                          className="text-red-600 hover:text-red-900 font-medium">
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ==================== Admins Tab ==================== */}
      {activeTab === 'admins' && (
        <div>
          <div className="mb-6">
            <button onClick={() => setShowAdminForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
              + Add Company Admin
            </button>
          </div>

          {/* Admin Form Modal */}
          {showAdminForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Create Company Admin</h2>
                <form onSubmit={createAdmin} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                      <input type="text" required value={adminForm.firstName}
                        onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                      <input type="text" required value={adminForm.lastName}
                        onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input type="email" required value={adminForm.email}
                      onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                    <input type="password" required value={adminForm.password}
                      onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      minLength={8} />
                    <p className="text-xs text-gray-500 mt-1">Min 8 chars with uppercase, lowercase, number &amp; special character</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company *</label>
                    <select required value={adminForm.companyId}
                      onChange={(e) => setAdminForm({ ...adminForm, companyId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                      <option value="">Select Company</option>
                      {companies.map((company) => (
                        <option key={company._id} value={company._id}>{company.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                    <select value={adminForm.role}
                      onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                      <option value="admin">Admin</option>
                      <option value="hr">HR Manager</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                      Create Admin
                    </button>
                    <button type="button" onClick={() => setShowAdminForm(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Admins Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {admins.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-5xl mb-4">👥</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No company admins yet</h3>
                <p className="text-gray-500 mb-4">Create a company first, then add admins to manage it</p>
                {companies.length > 0 && (
                  <button onClick={() => setShowAdminForm(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
                    + Add First Admin
                  </button>
                )}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {admins.map((admin) => (
                    <tr key={admin._id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => { setSelectedAdmin(admin); setShowAdminDetail(true); }}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{admin.firstName} {admin.lastName}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{admin.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{admin.companyId?.name || '-'}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                          {admin.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(admin.status)}`}>
                          {admin.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {admin.emailVerified ? (
                          <span className="text-green-600 text-sm">Verified</span>
                        ) : (
                          <span className="text-yellow-600 text-sm">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {admin.companyId ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAdmin(admin._id); }}
                            className="text-red-600 hover:text-red-900 font-medium">
                            Delete
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">Super Admin</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ==================== Company Detail Drawer ==================== */}
      {showCompanyDetail && selectedCompany && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => { setShowCompanyDetail(false); setEditingCompany(false); }} />
          <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Company Details</h2>
                <button onClick={() => { setShowCompanyDetail(false); setEditingCompany(false); }}
                  className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
              </div>

              <div className="space-y-6">
                {/* Status & Verification */}
                <div className="flex gap-3 flex-wrap">
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadge(selectedCompany.company.status)}`}>
                    {selectedCompany.company.status?.replace('_', ' ')}
                  </span>
                  {selectedCompany.company.emailVerified ? (
                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">Email Verified</span>
                  ) : (
                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">Email Not Verified</span>
                  )}
                </div>

                {/* Company Info - Edit / View */}
                {editingCompany ? (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Company Name</label>
                      <input type="text" value={companyEditForm.name}
                        onChange={(e) => setCompanyEditForm({ ...companyEditForm, name: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                      <p className="text-sm text-gray-400 italic mt-1">{selectedCompany.company.email} (cannot be changed)</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Phone</label>
                      <input type="tel" value={companyEditForm.phone}
                        onChange={(e) => setCompanyEditForm({ ...companyEditForm, phone: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Website</label>
                      <input type="url" value={companyEditForm.website}
                        onChange={(e) => setCompanyEditForm({ ...companyEditForm, website: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Industry</label>
                      <input type="text" value={companyEditForm.industry}
                        onChange={(e) => setCompanyEditForm({ ...companyEditForm, industry: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="e.g. Technology, Healthcare" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Company Size</label>
                      <select value={companyEditForm.size}
                        onChange={(e) => setCompanyEditForm({ ...companyEditForm, size: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
                        <option value="">Select size</option>
                        <option value="1-10">1-10</option>
                        <option value="11-50">11-50</option>
                        <option value="51-200">51-200</option>
                        <option value="201-500">201-500</option>
                        <option value="501-1000">501-1000</option>
                        <option value="1001-5000">1001-5000</option>
                        <option value="5001+">5001+</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Description</label>
                      <textarea value={companyEditForm.description}
                        onChange={(e) => setCompanyEditForm({ ...companyEditForm, description: e.target.value })}
                        rows={3}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                        placeholder="Brief company description" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={saveCompany} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                        Save Changes
                      </button>
                      <button onClick={() => setEditingCompany(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Company Name</label>
                      <p className="text-sm font-semibold text-gray-900">{selectedCompany.company.name}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                      <p className="text-sm text-gray-900">{selectedCompany.company.email}</p>
                    </div>
                    {selectedCompany.company.phone && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Phone</label>
                        <p className="text-sm text-gray-900">{selectedCompany.company.phone}</p>
                      </div>
                    )}
                    {selectedCompany.company.website && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Website</label>
                        <p className="text-sm text-indigo-600">{selectedCompany.company.website}</p>
                      </div>
                    )}
                    {selectedCompany.company.industry && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Industry</label>
                        <p className="text-sm text-gray-900">{selectedCompany.company.industry}</p>
                      </div>
                    )}
                    {selectedCompany.company.size && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Company Size</label>
                        <p className="text-sm text-gray-900">{selectedCompany.company.size} employees</p>
                      </div>
                    )}
                    {selectedCompany.company.description && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Description</label>
                        <p className="text-sm text-gray-900">{selectedCompany.company.description}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Created</label>
                      <p className="text-sm text-gray-900">
                        {format(new Date(selectedCompany.company.createdAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Company Admins */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Company Admins ({selectedCompany.admins.length})</h3>
                  {selectedCompany.admins.length === 0 ? (
                    <p className="text-sm text-gray-500">No admins assigned to this company</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedCompany.admins.map((admin) => (
                        <div key={admin._id} className="bg-white border rounded-lg p-3 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{admin.firstName} {admin.lastName}</p>
                            <p className="text-xs text-gray-500">{admin.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(admin.status)}`}>
                              {admin.status}
                            </span>
                            <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-800">
                              {admin.role}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 border-t flex gap-3">
                  {!editingCompany && (
                    <button onClick={startEditCompany}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                      Edit Company
                    </button>
                  )}
                  <button onClick={() => deleteCompany(selectedCompany.company._id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                    Delete Company
                  </button>
                  <button onClick={() => { setShowCompanyDetail(false); setEditingCompany(false); }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Admin Detail Drawer ==================== */}
      {showAdminDetail && selectedAdmin && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => { setShowAdminDetail(false); setEditingAdmin(false); }} />
          <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Admin Details</h2>
                <button onClick={() => { setShowAdminDetail(false); setEditingAdmin(false); }}
                  className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
              </div>

              <div className="space-y-6">
                {/* Status Badges */}
                <div className="flex gap-3 flex-wrap">
                  <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadge(selectedAdmin.status)}`}>
                    {selectedAdmin.status?.replace('_', ' ')}
                  </span>
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-indigo-100 text-indigo-800">
                    {selectedAdmin.role.toUpperCase()}
                  </span>
                  {selectedAdmin.emailVerified ? (
                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">Email Verified</span>
                  ) : (
                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 text-yellow-800">Not Verified</span>
                  )}
                </div>

                {/* Admin Info - Edit / View */}
                {editingAdmin ? (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">First Name</label>
                        <input type="text" value={adminEditForm.firstName}
                          onChange={(e) => setAdminEditForm({ ...adminEditForm, firstName: e.target.value })}
                          className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Last Name</label>
                        <input type="text" value={adminEditForm.lastName}
                          onChange={(e) => setAdminEditForm({ ...adminEditForm, lastName: e.target.value })}
                          className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                      <p className="text-sm text-gray-400 italic mt-1">{selectedAdmin.email} (cannot be changed)</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Status</label>
                      <select value={adminEditForm.status}
                        onChange={(e) => setAdminEditForm({ ...adminEditForm, status: e.target.value })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Company</label>
                      <p className="text-sm text-gray-400 italic mt-1">{selectedAdmin.companyId?.name || 'Not assigned'}</p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={saveAdmin} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                        Save Changes
                      </button>
                      <button onClick={() => setEditingAdmin(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Full Name</label>
                      <p className="text-sm font-semibold text-gray-900">{selectedAdmin.firstName} {selectedAdmin.lastName}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                      <p className="text-sm text-gray-900">{selectedAdmin.email}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Company</label>
                      <p className="text-sm text-gray-900">{selectedAdmin.companyId?.name || 'Not assigned'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase">Created</label>
                      <p className="text-sm text-gray-900">
                        {format(new Date(selectedAdmin.createdAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                    {selectedAdmin.lastLogin && (
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Last Login</label>
                        <p className="text-sm text-gray-900">
                          {format(new Date(selectedAdmin.lastLogin), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t flex gap-3">
                  {!editingAdmin && (
                    <button onClick={startEditAdmin}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                      Edit Admin
                    </button>
                  )}
                  {selectedAdmin.companyId && (
                    <button onClick={() => deleteAdmin(selectedAdmin._id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
                      Delete Admin
                    </button>
                  )}
                  <button onClick={() => { setShowAdminDetail(false); setEditingAdmin(false); }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
