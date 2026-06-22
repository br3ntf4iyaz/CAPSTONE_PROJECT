import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Users, TrendingUp, Activity } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { StatCard } from '@/components/ui/StatCard'
import { toArray } from '@/utils'

interface Org { id: number; classification: string; registration_category: string }
interface Program { id: number; category: string; male_participants?: number; female_participants?: number; start_date?: string }
interface AdminUser { id: number; role: string; profile?: { sk_position?: string } }
interface Submission { id: number; title: string; category: string; male_participants?: number; female_participants?: number; status: string; submitted_at: string }

const CLASSIFICATION_COLORS: Record<string, string> = {
  'school_based': '#6366f1',
  'community_based': '#10b981',
  'faith_based': '#f59e0b',
}

const REG_COLORS = ['#6366f1', '#10b981', '#f59e0b']

const PROGRAM_CATEGORIES = [
  'social_inclusion', 'health', 'active_citizenship', 'peace_building',
  'education', 'environment', 'governance', 'agriculture', 'global_mobility', 'economic',
]

function groupCount<T>(arr: T[], key: keyof T): Record<string, number> {
  return arr.reduce((acc, item) => {
    const k = String(item[key] ?? 'unknown')
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

export default function AdminAnalyticsPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const orgsQ = useQuery<Org[]>({
    queryKey: ['analytics-orgs'],
    queryFn: () => apiClient.get('/youth-orgs/').then(r => toArray<Org>(r.data)),
  })
  const programsQ = useQuery<Program[]>({
    queryKey: ['analytics-programs'],
    queryFn: () => apiClient.get('/programs/').then(r => toArray<Program>(r.data)),
  })
  const usersQ = useQuery<AdminUser[]>({
    queryKey: ['analytics-users'],
    queryFn: () => apiClient.get('/auth/admin/users/').then(r => toArray<AdminUser>(r.data)),
  })
  const submissionsQ = useQuery<Submission[]>({
    queryKey: ['analytics-submissions'],
    queryFn: () => apiClient.get('/programs/submissions/?page_size=100').then(r => {
      const d = r.data; return Array.isArray(d) ? d : (d.results ?? [])
    }),
  })

  const isLoading = orgsQ.isLoading || programsQ.isLoading || usersQ.isLoading
  if (isLoading) return <PageSpinner />

  const orgs = orgsQ.data ?? []
  const allPrograms = programsQ.data ?? []
  const allSubmissions = submissionsQ.data ?? []
  const users = usersQ.data ?? []

  // Date filter programs
  const programs = allPrograms.filter(p => {
    if (dateFrom && p.start_date && p.start_date < dateFrom) return false
    if (dateTo && p.start_date && p.start_date > dateTo) return false
    return true
  })

  // 1. Orgs by classification
  const orgsByClass = groupCount(orgs, 'classification')
  const orgClassData = Object.entries(orgsByClass).map(([name, value]) => ({
    name, value, color: CLASSIFICATION_COLORS[name] ?? '#6b7280'
  }))

  // 2. Orgs by registration category
  const orgsByReg = groupCount(orgs, 'registration_category')
  const orgRegData = Object.entries(orgsByReg).map(([name, value], i) => ({
    name, value, color: REG_COLORS[i % REG_COLORS.length]
  }))

  // 3. Programs by category
  const programsByCat = PROGRAM_CATEGORIES.map(cat => ({
    name: cat.replace('_', ' '),
    count: programs.filter(p => p.category === cat).length,
  }))

  // 4. Gender breakdown from submissions (accomplishment reports)
  const recentSubmissions = allSubmissions
    .filter(s => s.status !== 'draft')
    .filter(s => !dateFrom || s.submitted_at >= dateFrom)
    .filter(s => !dateTo || s.submitted_at <= dateTo)
    .slice(0, 15)

  const genderData = recentSubmissions
    .filter(s => (s.male_participants ?? 0) + (s.female_participants ?? 0) > 0)
    .map(s => ({
      name: s.title.length > 20 ? s.title.slice(0, 18) + '…' : s.title,
      Male: s.male_participants ?? 0,
      Female: s.female_participants ?? 0,
    }))

  // 5. Users by role
  const usersByRole = groupCount(users, 'role')
  const userRoleData = Object.entries(usersByRole).map(([name, value], i) => ({
    name: name.replace('_', ' '),
    value,
    color: ['#6366f1', '#10b981', '#f59e0b', '#ef4444'][i % 4],
  }))

  // Summary stats from submissions
  const totalMale = recentSubmissions.reduce((s, p) => s + (p.male_participants ?? 0), 0)
  const totalFemale = recentSubmissions.reduce((s, p) => s + (p.female_participants ?? 0), 0)
  const totalParticipants = totalMale + totalFemale
  const malePct = totalParticipants > 0 ? Math.round((totalMale / totalParticipants) * 100) : 0
  const femalePct = totalParticipants > 0 ? 100 - malePct : 0

  const catCounts = groupCount(recentSubmissions, 'category')
  const mostActiveCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '\u2014'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Data insights for Lucena City youth development</p>
        </div>
        {/* Date range filter */}
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input max-w-[150px] text-xs" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input max-w-[150px] text-xs" />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Participants" value={totalParticipants} icon={Users} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard label="Male %" value={`${malePct}%`} icon={TrendingUp} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
        <StatCard label="Female %" value={`${femalePct}%`} icon={TrendingUp} iconBg="bg-pink-50" iconColor="text-pink-600" />
        <StatCard label="Top Category" value={mostActiveCategory.replace('_', ' ')} icon={Activity} iconBg="bg-green-50" iconColor="text-green-600" />
      </div>

      {/* Row 1: Org charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="section-title mb-4">Organizations by Classification</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={orgClassData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {orgClassData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="section-title mb-4">Organizations by Registration Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={orgRegData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {orgRegData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Program charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="section-title mb-4">Programs by Category</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={programsByCat} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="section-title mb-4">Gender Breakdown — Recent Accomplishment Reports</h3>
          {genderData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data available</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={genderData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Male" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Female" fill="#f472b6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Row 3: Users by role */}
      <div className="card p-5 max-w-md">
        <h3 className="section-title mb-4">Users by Role</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={userRoleData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
              {userRoleData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
