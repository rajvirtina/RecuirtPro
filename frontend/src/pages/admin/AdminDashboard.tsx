import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import apiClient from '../../services/api';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { staggerContainer, staggerItem } from '../../lib/motion';

interface AdminStats {
  totalUsers: number;
  totalCompanies: number;
  totalJobs: number;
  totalApplications: number;
  activeInterviews: number;
  totalHR: number;
  activeHR: number;
  totalCandidates: number;
  systemHealth: {
    database: string;
    redis: string;
    storage: string;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    user: string;
  }>;
}

const STAT_COLORS = [
  { bg: 'bg-blue-100',   icon: 'text-blue-600'   },
  { bg: 'bg-teal-100',   icon: 'text-teal-600'   },
  { bg: 'bg-green-100',  icon: 'text-green-600'  },
  { bg: 'bg-purple-100', icon: 'text-purple-600' },
  { bg: 'bg-yellow-100', icon: 'text-yellow-600' },
  { bg: 'bg-indigo-100', icon: 'text-indigo-600' },
];

function StatSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-neutral-200 rounded" />
          <div className="h-8 w-14 bg-neutral-200 rounded" />
        </div>
        <div className="w-14 h-14 rounded-full bg-neutral-200" />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const reduced = useReducedMotion();

  const fetchAdminStats = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      const response = await apiClient.get('/admin/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminStats();
    const interval = setInterval(() => fetchAdminStats(true), 30_000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchAdminStats(true); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const statCards = stats ? [
    {
      label: 'Total Users',
      value: stats.totalUsers,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      label: 'HR Staff',
      value: stats.totalHR,
      sub: `${stats.activeHR} active`,
      subClass: 'text-green-600',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: 'Companies',
      value: stats.totalCompanies,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: 'Total Jobs',
      value: stats.totalJobs,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Applications',
      value: stats.totalApplications,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      label: 'Interviews',
      value: stats.activeInterviews,
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ] : [];

  return (
    <motion.div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0, 0, 0.2, 1] }}
    >
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">System overview and management</p>
        </div>
        {refreshing && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Refreshing…
          </span>
        )}
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          {[...Array(6)].map((_, i) => <StatSkeleton key={i} />)}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8"
          variants={reduced ? undefined : staggerContainer(0.07)}
          initial="hidden"
          animate="visible"
        >
          {statCards.map((card, i) => {
            const { bg, icon } = STAT_COLORS[i];
            return (
              <motion.div
                key={card.label}
                className="bg-white rounded-lg shadow p-6"
                variants={reduced ? undefined : staggerItem}
                whileHover={reduced ? undefined : { y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm font-medium">{card.label}</p>
                    <p className="text-3xl font-bold text-gray-900">
                      <AnimatedNumber value={card.value} duration={700} />
                    </p>
                    {card.sub && (
                      <p className={`text-xs mt-1 ${card.subClass ?? 'text-gray-500'}`}>{card.sub}</p>
                    )}
                  </div>
                  <div className={`${bg} rounded-full p-3 ${icon}`}>
                    {card.icon}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* System Health */}
      <motion.div
        className="bg-white rounded-lg shadow p-6 mb-8"
        variants={reduced ? undefined : staggerItem}
        initial={reduced ? false : 'hidden'}
        animate="visible"
      >
        <h2 className="text-xl font-bold text-gray-900 mb-4">System Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Database', key: stats?.systemHealth?.database },
            { label: 'Cache',    key: stats?.systemHealth?.redis },
            { label: 'Storage',  key: stats?.systemHealth?.storage },
          ].map(({ label, key }) => (
            <div key={label} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center">
                <motion.div
                  className={`w-3 h-3 rounded-full mr-3 ${key === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`}
                  animate={key === 'healthy' && !reduced ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <span className="font-medium text-gray-700">{label}</span>
              </div>
              <span className="text-sm text-gray-500 capitalize">{key || 'Unknown'}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Admin Actions</h2>
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          variants={reduced ? undefined : staggerContainer(0.08)}
          initial="hidden"
          animate="visible"
        >
          {[
            { to: '/admin/hr-management', label: 'HR Management', desc: 'Manage HR users and invitations', bg: 'bg-indigo-100', icon: 'text-indigo-600',
              d: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
            { to: '/proctoring/monitor', label: 'Proctoring Monitor', desc: 'Real-time interview monitoring', bg: 'bg-purple-100', icon: 'text-purple-600',
              d: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
            { to: '/jobs', label: 'Job Postings', desc: 'View all job postings', bg: 'bg-green-100', icon: 'text-green-600',
              d: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
          ].map((action) => (
            <motion.div key={action.to} variants={reduced ? undefined : staggerItem}>
              <Link
                to={action.to}
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors group"
              >
                <div className={`${action.bg} rounded-full p-2 mr-4 ${action.icon}`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.d} />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900 group-hover:text-indigo-700 transition-colors">{action.label}</p>
                  <p className="text-sm text-gray-500">{action.desc}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Activity</h2>
        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-start pb-4 border-b border-gray-100 gap-3">
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 bg-neutral-200 rounded" />
                  <div className="h-2.5 w-1/3 bg-neutral-200 rounded" />
                </div>
                <div className="h-5 w-16 bg-neutral-200 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            className="space-y-4"
            variants={reduced ? undefined : staggerContainer(0.04)}
            initial="hidden"
            animate="visible"
          >
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              stats.recentActivity.map((activity) => (
                <motion.div
                  key={activity.id}
                  className="flex items-start pb-4 border-b border-gray-100 last:border-0"
                  variants={reduced ? undefined : staggerItem}
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                    <div className="mt-1 flex items-center space-x-2 text-xs text-gray-500">
                      <span>{activity.user}</span>
                      <span>•</span>
                      <span>{new Date(activity.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    activity.type === 'user'        ? 'bg-blue-100 text-blue-800' :
                    activity.type === 'job'         ? 'bg-purple-100 text-purple-800' :
                    activity.type === 'application' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {activity.type}
                  </span>
                </motion.div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-8">No recent activity</p>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
