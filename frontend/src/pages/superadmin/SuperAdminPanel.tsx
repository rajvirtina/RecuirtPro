import { useState, useEffect } from 'react';
import { apiClient } from '../../services/api';
import { format } from 'date-fns';

interface Company {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  website?: string;
  createdAt: string;
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
  createdAt: string;
}

export default function SuperAdminPanel() {
  const [activeTab, setActiveTab] = useState<'companies' | 'admins'>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [admins, setAdmins] = useState<CompanyAdmin[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      console.log('Companies API Response:', response);
      const companiesData = response.data || [];
      console.log('Companies Data:', companiesData);
      setCompanies(companiesData);
    } catch (err: any) {
      console.error('Error fetching companies:', err);
      setError(err.response?.data?.message || 'Failed to fetch companies');
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await apiClient.get('/admin/users?role=admin,hr');
      console.log('Admins API Response:', response);
      const adminsData = response.data || [];
      console.log('Admins Data:', adminsData);
      setAdmins(adminsData);
    } catch (err: any) {
      console.error('Failed to fetch admins:', err);
    }
  };

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      const response = await apiClient.post('/admin/companies', companyForm);
      console.log('Create Company Response:', response);
      setSuccess('Company created successfully!');
      setShowCompanyForm(false);
      setCompanyForm({ name: '', email: '', phone: '', website: '' });
      await fetchCompanies();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error creating company:', err);
      setError(err.response?.data?.message || 'Failed to create company');
    }
  };

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      const response = await apiClient.post('/admin/users', adminForm);
      console.log('Create Admin Response:', response);
      setSuccess('Company admin created successfully!');
      setShowAdminForm(false);
      setAdminForm({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        companyId: '',
        role: 'admin',
      });
      await fetchAdmins();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error creating admin:', err);
      setError(err.response?.data?.message || 'Failed to create admin');
    }
  };

  const deleteCompany = async (companyId: string) => {
    if (!confirm('Are you sure? This will delete all associated data.')) return;
    
    try {
      setError('');
      setSuccess('');
      await apiClient.delete(`/admin/companies/${companyId}`);
      setSuccess('Company deleted successfully');
      await fetchCompanies();
      await fetchAdmins();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error deleting company:', err);
      setError(err.response?.data?.message || 'Failed to delete company');
    }
  };

  const deleteAdmin = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this admin?')) return;
    
    try {
      setError('');
      setSuccess('');
      await apiClient.delete(`/admin/users/${userId}`);
      setSuccess('Admin deleted successfully');
      await fetchAdmins();
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error deleting admin:', err);
      setError(err.response?.data?.message || 'Failed to delete admin');
    }
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
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-green-700">{success}</span>
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

      {/* Companies Tab */}
      {activeTab === 'companies' && (
        <div>
          {/* Create Company Button */}
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
                <form onSubmit={createCompany} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="ABC Corporation"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={companyForm.email}
                      onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="contact@abc.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={companyForm.phone}
                      onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="+1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website
                    </label>
                    <input
                      type="url"
                      value={companyForm.website}
                      onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://abc.com"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Create Company
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCompanyForm(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
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
                <button
                  onClick={() => setShowCompanyForm(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  + Add First Company
                </button>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Company Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {companies.map((company) => (
                    <tr key={company._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{company.name}</div>
                        {company.website && (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            {company.website}
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{company.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{company.phone || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {format(new Date(company.createdAt), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <button
                          onClick={() => deleteCompany(company._id)}
                          className="text-red-600 hover:text-red-900 font-medium"
                        >
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

      {/* Admins Tab */}
      {activeTab === 'admins' && (
        <div>
          {/* Create Admin Button */}
          <div className="mb-6">
            <button
              onClick={() => setShowAdminForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={adminForm.firstName}
                        onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={adminForm.lastName}
                        onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={adminForm.email}
                      onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={adminForm.password}
                      onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      minLength={8}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company *
                    </label>
                    <select
                      required
                      value={adminForm.companyId}
                      onChange={(e) => setAdminForm({ ...adminForm, companyId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Company</option>
                      {companies.map((company) => (
                        <option key={company._id} value={company._id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role *
                    </label>
                    <select
                      value={adminForm.role}
                      onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="admin">Admin</option>
                      <option value="hr">HR Manager</option>
                    </select>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Create Admin
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdminForm(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
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
                  <button
                    onClick={() => setShowAdminForm(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    + Add First Admin
                  </button>
                )}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Company
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {admins.map((admin) => (
                    <tr key={admin._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {admin.firstName} {admin.lastName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{admin.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {admin.companyId?.name || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                          {admin.role.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            admin.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                        {admin.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => deleteAdmin(admin._id)}
                        className="text-red-600 hover:text-red-900 font-medium"
                      >
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
    </div>
  );
}
