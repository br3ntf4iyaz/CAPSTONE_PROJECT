import { useState, useRef } from 'react'
import { authStore } from '@/store/authStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  User, Mail, Phone, MapPin, Calendar, Briefcase, Globe, Facebook,
  Edit3, Save, X, Camera, Shield, Tag, Heart, CheckCircle2,
  ShieldCheck, ShieldX, ShieldAlert, Award, GraduationCap, ArrowRight,
  Circle, MessageSquare, Trash2, Image as ImageIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { communityApi, type CommunityPost } from '@/api/community'
import { PageSpinner } from '@/components/ui/Spinner'
import { cn, formatDate } from '@/utils'

interface Profile {
  id: number
  bio: string
  phone: string
  barangay: string
  municipality: string
  province: string
  birthdate: string | null
  gender: string
  sk_position: string
  term_start: string | null
  term_end: string | null
  organization: string
  job_title: string
  years_of_experience: number | null
  facebook_url: string
  website_url: string
  lgu_name: string
  lgu_position: string
  completeness_percent: number
}

interface Me {
  id: number
  email: string
  first_name: string
  last_name: string
  full_name: string
  role: string
  youth_type: string
  avatar_url: string | null
  onboarding_complete: boolean
  date_joined: string
  profile: Profile | null
  skills: string[]
  interests: string[]
}

interface Verification {
  status: 'none' | 'pending' | 'reviewing' | 'approved' | 'rejected'
  is_verified: boolean
  id_type_display?: string
  ai_notes?: string
  admin_notes?: string
}

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say']

const LUCENA_BARANGAYS = [
  'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5',
  'Barangay 6', 'Barangay 7', 'Barangay 8', 'Barangay 9', 'Barangay 10',
  'Barangay 11', 'Barra', 'Bocohan', 'Cotta', 'Dalahican', 'Domoit',
  'Gulang-Gulang', 'Ibabang Dupay', 'Ibabang Iyam', 'Ibabang Talim',
  'Ilayang Dupay', 'Ilayang Iyam', 'Ilayang Talim', 'Isabang', 'Market View',
  'Mayao Castillo', 'Mayao Crossing', 'Mayao Kanluran', 'Mayao Parada',
  'Mayao Silangan', 'Ransohan', 'Salinas', 'Talao-Talao',
]

function AvatarUpload({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('avatar', file)
      return apiClient.patch('/auth/me/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: (res) => {
      const updated = res.data
      qc.setQueryData(['me'], updated)
      authStore.setUser(updated)
      toast.success('Avatar updated!')
    },
    onError: () => toast.error('Failed to upload avatar.'),
  })

  return (
    <div className="relative inline-block">
      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 border-2 border-white shadow-md">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <User size={36} className="text-primary/60" />
          </div>
        )}
      </div>
      <button
        onClick={() => fileRef.current?.click()}
        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
        title="Change avatar"
      >
        <Camera size={13} />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) uploadAvatar.mutate(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[]
  onChange: (vals: string[]) => void
  placeholder: string
}) {
  const [inputVal, setInputVal] = useState('')

  const add = () => {
    const v = inputVal.trim()
    if (v && !values.includes(v) && values.length < 15) {
      onChange([...values, v])
      setInputVal('')
    }
  }

  const remove = (v: string) => onChange(values.filter(x => x !== v))

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map(v => (
          <span key={v} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
            {v}
            <button type="button" onClick={() => remove(v)} className="hover:text-red-500 transition-colors">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          className="input flex-1 text-sm"
          maxLength={50}
        />
        <button type="button" onClick={add} className="btn-secondary btn-sm text-xs">Add</button>
      </div>
    </div>
  )
}

function CompletenessBar({ pct }: { pct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Profile completeness</span>
        <span className={cn('text-xs font-semibold', pct === 100 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500')}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function YouthProfilePage() {
  const qc = useQueryClient()
  const [editingBasic, setEditingBasic] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingSkills, setEditingSkills] = useState(false)

  const { data: me, isLoading } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => apiClient.get('/auth/me/').then(r => r.data),
  })

  const { data: verification } = useQuery<Verification>({
    queryKey: ['verification-status'],
    queryFn: () => apiClient.get('/verification/').then(r => r.data),
  })

  const { data: myBadges = [] } = useQuery<{ id: number; badge: { name: string; icon: string | null; category: string }; earned_at: string }[]>({
    queryKey: ['my-badges'],
    queryFn: () => apiClient.get('/recognition/user-badges/').then(r => Array.isArray(r.data) ? r.data : r.data?.results ?? []).catch(() => []),
  })

  const { data: myCerts = [] } = useQuery<{ id: number; title?: string; course_title?: string; issued_at?: string; created_at?: string }[]>({
    queryKey: ['my-certificates-profile'],
    queryFn: () =>
      Promise.all([
        apiClient.get('/courses/certificates/').then(r => Array.isArray(r.data) ? r.data : r.data?.results ?? []).catch(() => []),
        apiClient.get('/recognition/certificates/').then(r => Array.isArray(r.data) ? r.data : r.data?.results ?? []).catch(() => []),
      ]).then(([c, r]) => [...c, ...r]),
  })

  const { data: myPosts = [], isLoading: postsLoading } = useQuery<CommunityPost[]>({
    queryKey: ['community-posts', 'mine'],
    queryFn: () =>
      apiClient
        .get('/community/posts/', { params: { mine: 'true' } })
        .then(r => {
          const d = r.data as any
          return Array.isArray(d) ? d : (d.results ?? [])
        }),
  })

  const deletePost = useMutation({
    mutationFn: (id: number) => communityApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-posts'] })
      toast.success('Post deleted.')
    },
    onError: () => toast.error('Failed to delete post.'),
  })

  // Form state mirrors
  const [basicForm, setBasicForm] = useState({ first_name: '', last_name: '' })
  const [profileForm, setProfileForm] = useState<Partial<Profile>>({})
  const [skillsVal, setSkillsVal] = useState<string[]>([])
  const [interestsVal, setInterestsVal] = useState<string[]>([])

  const startEditBasic = () => {
    setBasicForm({ first_name: me?.first_name ?? '', last_name: me?.last_name ?? '' })
    setEditingBasic(true)
  }

  const startEditProfile = () => {
    setProfileForm(me?.profile ?? {})
    setEditingProfile(true)
  }

  const startEditSkills = () => {
    setSkillsVal([...(me?.skills ?? [])])
    setInterestsVal([...(me?.interests ?? [])])
    setEditingSkills(true)
  }

  const saveBasic = useMutation({
    mutationFn: () => apiClient.patch('/auth/me/', basicForm),
    onSuccess: (res) => {
      const updated = res.data
      qc.setQueryData(['me'], updated)
      authStore.setUser(updated)
      setEditingBasic(false)
      toast.success('Basic info updated!')
    },
    onError: () => toast.error('Failed to save changes.'),
  })

  const saveProfile = useMutation({
    mutationFn: () => apiClient.patch('/auth/me/profile/', profileForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      setEditingProfile(false)
      toast.success('Profile updated!')
    },
    onError: () => toast.error('Failed to save profile.'),
  })

  const saveSkills = useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/me/skills/', { skills: skillsVal })
      await apiClient.post('/auth/me/interests/', { interests: interestsVal })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      setEditingSkills(false)
      toast.success('Skills & interests updated!')
    },
    onError: () => toast.error('Failed to save skills.'),
  })

  if (isLoading || !me) return <PageSpinner />

  const profile = me.profile
  const pct = profile?.completeness_percent ?? 0

  const checklist = [
    { label: 'Profile photo',   done: !!me.avatar_url,       action: undefined,           note: 'Click the camera icon above' },
    { label: 'Bio',             done: !!profile?.bio,         action: () => { if (!editingProfile) startEditProfile() },   note: 'Tell others about yourself' },
    { label: 'Phone number',    done: !!profile?.phone,       action: () => { if (!editingProfile) startEditProfile() },   note: 'Helpful for event coordination' },
    { label: 'Barangay',        done: !!profile?.barangay,    action: () => { if (!editingProfile) startEditProfile() },   note: 'Required for local programs' },
    { label: 'Birthdate',       done: !!profile?.birthdate,   action: () => { if (!editingProfile) startEditProfile() },   note: 'Needed for youth classification' },
    { label: 'Skills',          done: me.skills.length > 0,   action: () => { if (!editingSkills) startEditSkills() },     note: 'Match you with opportunities' },
    { label: 'Interests',       done: me.interests.length > 0, action: () => { if (!editingSkills) startEditSkills() },    note: 'Personalize your experience' },
    { label: 'ID Verified',     done: !!verification?.is_verified, action: undefined,      href: '/verify-identity',       note: 'Required for event registration' },
  ] as const

  const incomplete = checklist.filter(c => !c.done)

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="page-title">My Profile</h1>
        <p className="page-subtitle">Manage your personal information and preferences.</p>
      </div>

      {/* Hero card */}
      <div className="card p-5">
        <div className="flex items-start gap-4">
          <AvatarUpload avatarUrl={me.avatar_url} name={me.full_name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              {editingBasic ? (
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={basicForm.first_name}
                      onChange={e => setBasicForm(f => ({ ...f, first_name: e.target.value }))}
                      placeholder="First name"
                      className="input flex-1 text-sm"
                    />
                    <input
                      type="text"
                      value={basicForm.last_name}
                      onChange={e => setBasicForm(f => ({ ...f, last_name: e.target.value }))}
                      placeholder="Last name"
                      className="input flex-1 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveBasic.mutate()} disabled={saveBasic.isPending} className="btn-primary btn-sm text-xs">
                      <Save size={12} /> {saveBasic.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingBasic(false)} className="btn-secondary btn-sm text-xs">
                      <X size={12} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-gray-800">{me.full_name}</h2>
                    {verification?.is_verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                        <ShieldCheck size={11} /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <Mail size={12} /> {me.email}
                  </p>
                  {profile?.sk_position && (
                    <p className="text-xs text-primary mt-0.5 flex items-center gap-1">
                      <Shield size={11} /> {profile.sk_position}
                    </p>
                  )}
                </div>
              )}
              {!editingBasic && (
                <button onClick={startEditBasic} className="btn-secondary btn-sm text-xs flex-shrink-0">
                  <Edit3 size={12} /> Edit
                </button>
              )}
            </div>
            <div className="mt-3">
              <CompletenessBar pct={pct} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Profile completion checklist ─────────────────────────────── */}
      {incomplete.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-ink-800 text-sm flex items-center gap-2">
              <CheckCircle2 size={15} className="text-primary-600" /> Complete your profile
            </h3>
            <span className="text-xs font-bold text-primary-700">{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-4">
            <div
              className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <ul className="space-y-2">
            {checklist.map(item => {
              const content = (
                <span className={cn(
                  'flex items-center gap-2.5 text-sm py-1 rounded-lg transition-colors',
                  item.done ? 'text-ink-400 line-through' : 'text-ink-700',
                  !item.done && (item.action || (item as any).href) && 'hover:text-primary-700 cursor-pointer',
                )}>
                  {item.done
                    ? <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                    : <Circle size={15} className="text-ink-300 flex-shrink-0" />
                  }
                  <span className="font-medium">{item.label}</span>
                  {!item.done && <span className="text-xs text-ink-400 font-normal">{item.note}</span>}
                </span>
              )
              if (!item.done && (item as any).href) {
                return <li key={item.label}><Link to={(item as any).href}>{content}</Link></li>
              }
              if (!item.done && item.action) {
                return <li key={item.label}><button type="button" onClick={item.action} className="w-full text-left">{content}</button></li>
              }
              return <li key={item.label}>{content}</li>
            })}
          </ul>
        </div>
      )}

      {/* Profile details */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <User size={16} className="text-primary" /> Personal Information
          </h3>
          {!editingProfile && (
            <button onClick={startEditProfile} className="btn-secondary btn-sm text-xs">
              <Edit3 size={12} /> Edit
            </button>
          )}
        </div>

        {editingProfile ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bio</label>
              <textarea
                rows={3}
                value={profileForm.bio ?? ''}
                onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))}
                placeholder="Tell us about yourself…"
                className="input w-full resize-none text-sm"
                maxLength={1000}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input type="tel" value={profileForm.phone ?? ''} onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))} className="input w-full text-sm" placeholder="+63 912 345 6789" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                <select value={profileForm.gender ?? ''} onChange={e => setProfileForm(f => ({ ...f, gender: e.target.value }))} className="input w-full text-sm">
                  <option value="">Select gender</option>
                  {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Birthdate</label>
                <input type="date" value={profileForm.birthdate ?? ''} onChange={e => setProfileForm(f => ({ ...f, birthdate: e.target.value }))} className="input w-full text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Barangay</label>
                <select value={profileForm.barangay ?? ''} onChange={e => setProfileForm(f => ({ ...f, barangay: e.target.value }))} className="input w-full text-sm">
                  <option value="">Select barangay</option>
                  {LUCENA_BARANGAYS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Municipality</label>
                <input type="text" value={profileForm.municipality ?? ''} onChange={e => setProfileForm(f => ({ ...f, municipality: e.target.value }))} className="input w-full text-sm" placeholder="Municipality" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Province</label>
                <input type="text" value={profileForm.province ?? ''} onChange={e => setProfileForm(f => ({ ...f, province: e.target.value }))} className="input w-full text-sm" placeholder="Province" />
              </div>
            </div>

            {(me.role === 'sk_official' || me.role === 'sk_admin') && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">SK Details</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">SK Position</label>
                    <input type="text" value={profileForm.sk_position ?? ''} onChange={e => setProfileForm(f => ({ ...f, sk_position: e.target.value }))} className="input w-full text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Term Start</label>
                    <input type="date" value={profileForm.term_start ?? ''} onChange={e => setProfileForm(f => ({ ...f, term_start: e.target.value }))} className="input w-full text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Term End</label>
                    <input type="date" value={profileForm.term_end ?? ''} onChange={e => setProfileForm(f => ({ ...f, term_end: e.target.value }))} className="input w-full text-sm" />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Links</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Facebook</label>
                  <input type="url" value={profileForm.facebook_url ?? ''} onChange={e => setProfileForm(f => ({ ...f, facebook_url: e.target.value }))} className="input w-full text-sm" placeholder="https://facebook.com/…" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
                  <input type="url" value={profileForm.website_url ?? ''} onChange={e => setProfileForm(f => ({ ...f, website_url: e.target.value }))} className="input w-full text-sm" placeholder="https://…" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="btn-primary">
                <Save size={14} /> {saveProfile.isPending ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingProfile(false)} className="btn-secondary">
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {profile?.bio && (
              <p className="text-sm text-gray-700 leading-relaxed">{profile.bio}</p>
            )}
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {profile?.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={13} className="text-gray-400 flex-shrink-0" />
                  {profile.phone}
                </div>
              )}
              {profile?.gender && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User size={13} className="text-gray-400 flex-shrink-0" />
                  {profile.gender}
                </div>
              )}
              {profile?.birthdate && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={13} className="text-gray-400 flex-shrink-0" />
                  {profile.birthdate}
                </div>
              )}
              {(profile?.barangay || profile?.municipality || profile?.province) && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={13} className="text-gray-400 flex-shrink-0" />
                  {[profile.barangay, profile.municipality, profile.province].filter(Boolean).join(', ')}
                </div>
              )}
              {profile?.facebook_url && (
                <a href={profile.facebook_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <Facebook size={13} className="flex-shrink-0" />
                  Facebook
                </a>
              )}
              {profile?.website_url && (
                <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <Globe size={13} className="flex-shrink-0" />
                  Website
                </a>
              )}
              {profile?.sk_position && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Shield size={13} className="text-gray-400 flex-shrink-0" />
                  {profile.sk_position}
                  {profile.term_start && ` (${profile.term_start} – ${profile.term_end ?? 'present'})`}
                </div>
              )}
              {profile?.job_title && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Briefcase size={13} className="text-gray-400 flex-shrink-0" />
                  {profile.job_title}{profile.organization ? ` · ${profile.organization}` : ''}
                </div>
              )}
            </div>
            {!profile?.bio && !profile?.phone && !profile?.barangay && (
              <p className="text-sm text-gray-400 italic">No profile details yet. Click Edit to add your information.</p>
            )}
          </div>
        )}
      </div>

      {/* Skills & Interests */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Tag size={16} className="text-primary" /> Skills & Interests
          </h3>
          {!editingSkills && (
            <button onClick={startEditSkills} className="btn-secondary btn-sm text-xs">
              <Edit3 size={12} /> Edit
            </button>
          )}
        </div>

        {editingSkills ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Tag size={11} /> Skills
              </label>
              <TagInput values={skillsVal} onChange={setSkillsVal} placeholder="Add a skill (press Enter)" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Heart size={11} /> Interests
              </label>
              <TagInput values={interestsVal} onChange={setInterestsVal} placeholder="Add an interest (press Enter)" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => saveSkills.mutate()} disabled={saveSkills.isPending} className="btn-primary">
                <Save size={14} /> {saveSkills.isPending ? 'Saving…' : 'Save Changes'}
              </button>
              <button onClick={() => setEditingSkills(false)} className="btn-secondary">
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Skills</p>
              {me.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {me.skills.map(s => (
                    <span key={s} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={10} /> {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No skills added yet.</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5 font-medium uppercase tracking-wide">Interests</p>
              {me.interests.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {me.interests.map(i => (
                    <span key={i} className="bg-pink-50 text-pink-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Heart size={10} /> {i}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No interests added yet.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Achievements strip ───────────────────────────────────────── */}
      {(myBadges.length > 0 || myCerts.length > 0) && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Award size={16} className="text-primary" /> My Achievements
            </h3>
            <div className="flex items-center gap-3">
              {myBadges.length > 0 && (
                <Link to="/badges" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1">
                  {myBadges.length} badge{myBadges.length !== 1 ? 's' : ''} <ArrowRight size={11} />
                </Link>
              )}
              {myCerts.length > 0 && (
                <Link to="/certificates" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1">
                  {myCerts.length} cert{myCerts.length !== 1 ? 's' : ''} <ArrowRight size={11} />
                </Link>
              )}
            </div>
          </div>

          {myBadges.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide mb-2">Recent Badges</p>
              <div className="flex flex-wrap gap-2">
                {myBadges.slice(0, 4).map(ub => (
                  <div key={ub.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full">
                    <Award size={13} className="text-amber-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-amber-800">{ub.badge.name}</span>
                  </div>
                ))}
                {myBadges.length > 4 && (
                  <Link to="/badges" className="flex items-center px-3 py-1.5 bg-ink-50 border border-ink-200 rounded-full text-xs font-semibold text-ink-600 hover:text-primary-700">
                    +{myBadges.length - 4} more
                  </Link>
                )}
              </div>
            </div>
          )}

          {myCerts.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium tracking-wide mb-2">Certificates</p>
              <div className="space-y-1.5">
                {myCerts.slice(0, 3).map((cert, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-ink-700">
                    <GraduationCap size={14} className="text-primary-500 flex-shrink-0" />
                    <span className="truncate">{(cert as any).course_title ?? (cert as any).title ?? 'Certificate'}</span>
                  </div>
                ))}
                {myCerts.length > 3 && (
                  <Link to="/certificates" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1 mt-1">
                    View all {myCerts.length} certificates <ArrowRight size={11} />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* My Posts */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <MessageSquare size={16} className="text-primary" /> My Posts
          </h3>
          <Link to="/community" className="text-xs font-semibold text-primary-700 hover:text-primary-800 flex items-center gap-1">
            Go to feed <ArrowRight size={11} />
          </Link>
        </div>

        {postsLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => <div key={i} className="skeleton h-16 w-full rounded-xl" />)}
          </div>
        ) : myPosts.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-400">
            <MessageSquare size={28} className="mx-auto mb-2 opacity-30" />
            <p>You haven't posted anything yet.</p>
            <Link to="/community" className="mt-2 inline-block text-xs font-semibold text-primary-600 hover:underline">
              Share something in the community →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myPosts.map(post => (
              <div key={post.id} className="border border-ink-100 rounded-xl p-3 group hover:border-ink-200 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-ink-800 leading-relaxed line-clamp-3 flex-1">{post.content}</p>
                  <button
                    onClick={() => deletePost.mutate(post.id)}
                    disabled={deletePost.isPending}
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-ink-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete post"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {post.images.length > 0 && (
                  <div className="mt-2 flex gap-1.5">
                    {post.images.slice(0, 3).map(img => (
                      <div key={img.id} className="w-14 h-14 rounded-lg overflow-hidden bg-ink-100 flex-shrink-0">
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {post.images.length > 3 && (
                      <div className="w-14 h-14 rounded-lg bg-ink-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-ink-500">+{post.images.length - 3}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-3 text-xs text-ink-400">
                  <span className="flex items-center gap-1">
                    <Heart size={11} className={post.is_liked ? 'text-red-400' : ''} />
                    {post.like_count}
                  </span>
                  {post.images.length > 0 && (
                    <span className="flex items-center gap-1">
                      <ImageIcon size={11} />
                      {post.images.length}
                    </span>
                  )}
                  <span className="ml-auto">{formatDate(post.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account details */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <Shield size={16} className="text-primary" /> Account Details
        </h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm text-gray-600">
          <div><span className="text-gray-400 text-xs block">Role</span>{me.role.replace('_', ' ')}</div>
          {me.youth_type && <div><span className="text-gray-400 text-xs block">Youth Type</span>{me.youth_type.replace('_', ' ')}</div>}
          <div><span className="text-gray-400 text-xs block">Member Since</span>{new Date(me.date_joined).toLocaleDateString()}</div>
          <div><span className="text-gray-400 text-xs block">Email</span>{me.email}</div>
        </div>
      </div>

      {/* Identity Verification */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-4">
          <ShieldCheck size={16} className="text-primary" /> Identity Verification
        </h3>
        {!verification || verification.status === 'none' ? (
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-700 mb-0.5">Not verified</p>
              <p className="text-sm text-gray-500 mb-3">Verify your identity with a government ID to get a verified badge on your profile.</p>
              <Link to="/verify-identity" className="btn-primary btn-sm text-xs inline-flex">
                Verify now →
              </Link>
            </div>
          </div>
        ) : verification.is_verified ? (
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-emerald-700">Identity verified</p>
              {verification.id_type_display && (
                <p className="text-xs text-gray-500 mt-0.5">Verified with {verification.id_type_display}</p>
              )}
            </div>
          </div>
        ) : verification.status === 'rejected' ? (
          <div className="flex items-start gap-3">
            <ShieldX size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700 mb-0.5">Verification rejected</p>
              <p className="text-sm text-gray-500 mb-3">{verification.ai_notes || verification.admin_notes || 'Please resubmit with a clearer photo.'}</p>
              <Link to="/verify-identity" className="btn-primary btn-sm text-xs inline-flex">
                Try again →
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <Shield size={18} className="text-primary animate-pulse flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-700">Under review</p>
              <p className="text-sm text-gray-500">Your ID is being reviewed. This usually takes under a minute.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
