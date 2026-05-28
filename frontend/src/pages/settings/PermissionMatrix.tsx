import { clsx } from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

interface Permission {
  action: string;
  admin: boolean;
  hr: boolean;
  employer: boolean;
  interviewer: boolean;
  candidate: boolean;
}

type RoleKey = 'admin' | 'hr' | 'employer' | 'interviewer' | 'candidate';

const DEFAULTS: { category: string; perms: Permission[] }[] = [
  {
    category: 'Jobs',
    perms: [
      { action: 'Create / edit jobs',         admin: true, hr: true, employer: true,  interviewer: false, candidate: false },
      { action: 'Delete jobs',                admin: true, hr: false, employer: true,  interviewer: false, candidate: false },
      { action: 'View all jobs',              admin: true, hr: true, employer: true,  interviewer: true,  candidate: true },
      { action: 'Apply to jobs',              admin: false, hr: false, employer: false, interviewer: false, candidate: true },
    ],
  },
  {
    category: 'Applications',
    perms: [
      { action: 'View all applications',     admin: true, hr: true, employer: true,  interviewer: false, candidate: false },
      { action: 'View own applications',     admin: false, hr: false, employer: false, interviewer: false, candidate: true },
      { action: 'Change application status', admin: true, hr: true, employer: true,  interviewer: false, candidate: false },
      { action: 'View AI reports',           admin: true, hr: true, employer: true,  interviewer: false, candidate: false },
    ],
  },
  {
    category: 'Interviews',
    perms: [
      { action: 'Schedule interviews',       admin: true, hr: true, employer: true,  interviewer: false, candidate: false },
      { action: 'View assigned interviews',  admin: true, hr: true, employer: true,  interviewer: true,  candidate: true },
      { action: 'Submit scorecard/feedback', admin: true, hr: true, employer: false, interviewer: true,  candidate: false },
      { action: 'Join interview room',       admin: true, hr: true, employer: true,  interviewer: true,  candidate: true },
    ],
  },
  {
    category: 'Offers',
    perms: [
      { action: 'Create offers',             admin: true, hr: true, employer: false, interviewer: false, candidate: false },
      { action: 'Approve / reject offers',   admin: true, hr: false, employer: true,  interviewer: false, candidate: false },
      { action: 'Send offers to candidates', admin: true, hr: true, employer: true,  interviewer: false, candidate: false },
      { action: 'View offer details',        admin: true, hr: true, employer: true,  interviewer: false, candidate: true },
    ],
  },
  {
    category: 'Analytics & Reports',
    perms: [
      { action: 'View hiring analytics',       admin: true, hr: true, employer: true,  interviewer: false, candidate: false },
      { action: 'Export reports',              admin: true, hr: true, employer: true,  interviewer: false, candidate: false },
      { action: 'View recruiter productivity', admin: true, hr: false, employer: true, interviewer: false, candidate: false },
    ],
  },
  {
    category: 'Administration',
    perms: [
      { action: 'Manage company settings',  admin: true, hr: false, employer: true,  interviewer: false, candidate: false },
      { action: 'Manage pipeline stages',   admin: true, hr: true, employer: true,  interviewer: false, candidate: false },
      { action: 'Manage HR team members',   admin: true, hr: false, employer: false, interviewer: false, candidate: false },
      { action: 'Manage integrations',      admin: true, hr: false, employer: true,  interviewer: false, candidate: false },
      { action: 'View proctoring monitor',  admin: true, hr: true, employer: true,  interviewer: false, candidate: false },
      { action: 'Access SuperAdmin panel',  admin: true, hr: false, employer: false, interviewer: false, candidate: false },
    ],
  },
];

const ROLES: { key: RoleKey; label: string; color: string }[] = [
  { key: 'admin',       label: 'Admin',       color: 'text-purple-700 bg-purple-50' },
  { key: 'hr',          label: 'HR',          color: 'text-blue-700 bg-blue-50' },
  { key: 'employer',    label: 'Employer',    color: 'text-indigo-700 bg-indigo-50' },
  { key: 'interviewer', label: 'Interviewer', color: 'text-amber-700 bg-amber-50' },
  { key: 'candidate',   label: 'Candidate',   color: 'text-green-700 bg-green-50' },
];

function buildMatrix(overrides: Permission[]): Permission[] {
  const overrideMap = new Map(overrides.map(o => [o.action, o]));
  return DEFAULTS.flatMap(g => g.perms).map(p => overrideMap.get(p.action) ?? p);
}

export default function PermissionMatrix() {
  const user = useAuthStore(s => s.user);
  const canEdit = user?.role === 'admin' || user?.role === 'employer';

  const [matrix, setMatrix] = useState<Permission[]>(() => buildMatrix([]));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    api.get('/companies/permissions')
      .then(res => {
        const overrides: Permission[] = res.data?.data?.overrides || [];
        setMatrix(buildMatrix(overrides));
      })
      .catch(() => {/* use defaults */});
  }, []);

  const toggle = useCallback((action: string, role: RoleKey) => {
    if (!canEdit) return;
    setMatrix(prev => prev.map(p =>
      p.action === action ? { ...p, [role]: !p[role] } : p
    ));
    setDirty(true);
    setSaveOk(false);
  }, [canEdit]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      // Send only rows that differ from defaults
      const defaults = buildMatrix([]);
      const defaultMap = new Map(defaults.map(p => [p.action, p]));
      const overrides = matrix.filter(p => {
        const d = defaultMap.get(p.action);
        if (!d) return true;
        return ROLES.some(r => p[r.key] !== d[r.key]);
      });
      await api.patch('/companies/permissions', { overrides });
      setDirty(false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e: any) {
      setSaveError(e?.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const matrixMap = new Map(matrix.map(p => [p.action, p]));

  return (
    <div className="card p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Permission Matrix</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            {canEdit
              ? 'Toggle permissions per role. Changes apply company-wide.'
              : 'Overview of what each role can access across the platform.'}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-3">
            {saveError && <span className="text-xs text-error-600">{saveError}</span>}
            {saveOk && <span className="text-xs text-success-600">Saved</span>}
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className={clsx(
                'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                dirty && !saving
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
              )}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap gap-2">
        {ROLES.map(r => (
          <span key={r.key} className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', r.color)}>
            {r.label}
          </span>
        ))}
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm" aria-label="Permission matrix">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="text-left px-3 py-2 text-xs font-semibold text-neutral-500 uppercase tracking-wider w-56">
                Permission
              </th>
              {ROLES.map(r => (
                <th key={r.key} className="px-3 py-2 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEFAULTS.map((group) => (
              <>
                <tr key={group.category}>
                  <td colSpan={6} className="px-3 pt-4 pb-1">
                    <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide">
                      {group.category}
                    </span>
                  </td>
                </tr>
                {group.perms.map((perm, i) => {
                  const current = matrixMap.get(perm.action) ?? perm;
                  return (
                    <tr key={`${group.category}-${i}`} className="border-b border-neutral-50 hover:bg-neutral-50">
                      <td className="px-3 py-2 text-neutral-700">{perm.action}</td>
                      {ROLES.map(r => (
                        <td key={r.key} className="px-3 py-2 text-center">
                          {canEdit ? (
                            <button
                              onClick={() => toggle(perm.action, r.key)}
                              aria-label={`${current[r.key] ? 'Revoke' : 'Grant'} ${r.label} access to ${perm.action}`}
                              className={clsx(
                                'inline-flex items-center justify-center w-6 h-6 rounded-full transition-colors',
                                current[r.key]
                                  ? 'bg-success-100 text-success-600 hover:bg-success-200'
                                  : 'bg-neutral-100 text-neutral-300 hover:bg-neutral-200'
                              )}
                            >
                              {current[r.key] ? (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                            </button>
                          ) : (
                            current[r.key] ? (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success-100 text-success-600">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-100 text-neutral-300">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </span>
                            )
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && dirty && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
          You have unsaved permission changes. Click "Save Changes" to apply them.
        </p>
      )}
    </div>
  );
}
