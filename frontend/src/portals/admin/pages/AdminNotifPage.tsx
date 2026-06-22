import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Send, Clock, Users, CheckCircle, X, FileText, CheckCheck, Inbox, Paperclip } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '@/api/client'
import { PageSpinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDateTime, toArray, cn } from '@/utils'

interface SentNotification {
  id: number
  title: string
  message: string
  target_audience: string
  sent_at: string
  recipient_count: number
  via_email: boolean
  attachment?: string | null
}

interface InboxNotification {
  id: number
  title: string
  message: string
  notification_type: string
  is_read: boolean
  created_at: string
  link?: string
}

interface NotifForm {
  title: string
  message: string
  target_audience: string
  send_email: boolean
}

const AUDIENCE_OPTS = [
  { value: 'all', label: 'All Users' },
  { value: 'sk', label: 'SK Only' },
  { value: 'youth_leaders', label: 'Youth Leaders' },
  { value: 'general', label: 'General Youth' },
  { value: 'lgu_admin', label: 'LGU Admins' },
]

const initialForm: NotifForm = {
  title: '',
  message: '',
  target_audience: 'all',
  send_email: false,
}

function AudienceLabel({ value }: { value: string }) {
  const opt = AUDIENCE_OPTS.find(o => o.value === value)
  return <span>{opt?.label ?? value}</span>
}

export default function AdminNotifPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'inbox' | 'broadcast'>('inbox')
  const [form, setForm] = useState<NotifForm>({ ...initialForm })
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [preview, setPreview] = useState(false)

  const { data: history = [], isLoading: historyLoading } = useQuery<SentNotification[]>({
    queryKey: ['admin-notif-history'],
    queryFn: () => apiClient.get('/notifications/admin-history/').then(r => toArray<SentNotification>(r.data)).catch(() => []),
  })

  const { data: inbox = [], isLoading: inboxLoading, refetch: refetchInbox } = useQuery<InboxNotification[]>({
    queryKey: ['admin-notif-inbox'],
    queryFn: () =>
      apiClient.get('/notifications/?page_size=50')
        .then(r => {
          const d = r.data
          return Array.isArray(d) ? d : (d.results ?? [])
        })
        .catch(() => []),
    refetchInterval: 30000,
  })

  const submissionNotifs = inbox.filter(n => n.notification_type === 'project')
  const unreadSubmissionCount = submissionNotifs.filter(n => !n.is_read).length

  const markRead = useMutation({
    mutationFn: (id: number) => apiClient.post(`/notifications/${id}/mark_read/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notif-inbox'] })
      qc.invalidateQueries({ queryKey: ['admin-notifications-bell'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => apiClient.post('/notifications/mark_all_read/'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notif-inbox'] })
      qc.invalidateQueries({ queryKey: ['admin-notifications-bell'] })
    },
  })

  const sendNotif = useMutation({
    mutationFn: (payload: { form: NotifForm; file: File | null }) => {
      const { form: data, file } = payload
      if (file) {
        const fd = new FormData()
        fd.append('title', data.title)
        fd.append('message', data.message)
        fd.append('target_audience', data.target_audience)
        fd.append('send_email', String(data.send_email))
        fd.append('attachment', file)
        return apiClient.post('/notifications/', fd, { headers: { 'Content-Type': undefined } })
      }
      return apiClient.post('/notifications/', {
        title: data.title,
        message: data.message,
        target_audience: data.target_audience,
        send_email: data.send_email,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notif-history'] })
      toast.success('Notification sent successfully!')
      setForm({ ...initialForm })
      setAttachmentFile(null)
      setPreview(false)
    },
    onError: () => toast.error('Failed to send notification. Check your email settings.'),
  })

  const handleSend = () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    if (!form.message.trim()) { toast.error('Message is required'); return }
    sendNotif.mutate({ form, file: attachmentFile })
  }

  const charCount = form.message.length
  const maxChars = 500

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Notifications</h1>
        <p className="page-subtitle">Monitor submission activity and broadcast messages to users</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('inbox')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            tab === 'inbox' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <Inbox size={15} />
          Submission Activity
          {unreadSubmissionCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {unreadSubmissionCount > 9 ? '9+' : unreadSubmissionCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('broadcast')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
            tab === 'broadcast' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
          )}
        >
          <Send size={15} />
          Broadcast
        </button>
      </div>

      {/* ── Inbox tab ─────────────────────────────────────────────────── */}
      {tab === 'inbox' && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-primary-700" />
              <h2 className="text-base font-semibold text-gray-800">Submission Activity</h2>
              {submissionNotifs.length > 0 && (
                <span className="text-xs text-gray-500">{submissionNotifs.length} notifications</span>
              )}
            </div>
            {unreadSubmissionCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-semibold transition-colors"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          {inboxLoading ? (
            <PageSpinner />
          ) : submissionNotifs.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No submission notifications yet"
              description="You'll be notified here when users submit or update accomplishment reports."
            />
          ) : (
            <div className="space-y-2">
              {submissionNotifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.is_read) markRead.mutate(n.id)
                    if (n.link) navigate(n.link)
                  }}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors',
                    n.is_read ? 'hover:bg-gray-50' : 'bg-blue-50/60 hover:bg-blue-50',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                    n.is_read ? 'bg-gray-100' : 'bg-primary-100',
                  )}>
                    <FileText size={14} className={n.is_read ? 'text-gray-400' : 'text-primary-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm leading-snug', n.is_read ? 'text-gray-600' : 'font-semibold text-gray-900')}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{formatDateTime(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Broadcast tab ─────────────────────────────────────────────── */}
      {tab === 'broadcast' && (<>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Compose form */}
        <div className="lg:col-span-3 card p-6">
          <div className="flex items-center gap-2 mb-5">
            <Bell size={18} className="text-primary-700" />
            <h2 className="text-base font-semibold text-gray-800">Compose Notification</h2>
          </div>

          <div className="space-y-5">
            <div>
              <label className="label">Title *</label>
              <input
                className="input"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Notification title…"
                maxLength={120}
              />
              <p className="text-xs text-gray-400 mt-1">{form.title.length}/120 characters</p>
            </div>

            <div>
              <label className="label">Message *</label>
              <textarea
                className="input min-h-[120px] resize-none"
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Write your message here…"
                maxLength={maxChars}
              />
              <p className={`text-xs mt-1 ${charCount > maxChars * 0.9 ? 'text-orange-500' : 'text-gray-400'}`}>
                {charCount}/{maxChars} characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Attachment <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {attachmentFile && (
                <p className="text-xs text-gray-500 mt-1">Selected: {attachmentFile.name}</p>
              )}
            </div>

            <div>
              <label className="label">Target Audience</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                {AUDIENCE_OPTS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setForm(f => ({ ...f, target_audience: opt.value }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      form.target_audience === opt.value
                        ? 'border-primary-700 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Users size={13} />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.send_email}
                  onChange={e => setForm(f => ({ ...f, send_email: e.target.checked }))}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${form.send_email ? 'bg-primary-700' : 'bg-gray-300'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${form.send_email ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Also send via Email</p>
                <p className="text-xs text-gray-400">Sends an email notification to the target audience</p>
              </div>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setPreview(!preview)}
                className="btn-secondary btn-sm"
              >
                {preview ? <><X size={14} /> Hide Preview</> : 'Preview'}
              </button>
              <button
                onClick={handleSend}
                disabled={sendNotif.isPending || !form.title || !form.message}
                className="btn-primary"
              >
                {sendNotif.isPending ? (
                  <>Sending…</>
                ) : (
                  <><Send size={16} /> Send Notification</>
                )}
              </button>
            </div>

            {/* Preview */}
            {preview && (
              <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Preview</p>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-primary-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bell size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{form.title || '(No title)'}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{form.message || '(No message)'}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      To: <AudienceLabel value={form.target_audience} />
                      {form.send_email && ' · via Email'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Clock size={15} /> Scheduled Notifications</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-700">Scheduled notification feature coming soon. Currently only instant notifications are supported.</p>
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Tips</h3>
            <ul className="text-xs text-gray-500 space-y-1.5 list-disc list-inside">
              <li>Keep titles short and action-oriented</li>
              <li>Use clear, plain language</li>
              <li>Email notifications may go to spam &mdash; remind users to check</li>
              <li>Test with "LGU Admins" audience before broadcasting</li>
            </ul>
          </div>
        </div>
      </div>

        {/* History */}
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Sent Notifications History</h2>
          {historyLoading ? (
            <PageSpinner />
          ) : history.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications sent yet" description="Sent notifications will appear here." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Message</th>
                    <th>Audience</th>
                    <th>Recipients</th>
                    <th>Email</th>
                    <th>File</th>
                    <th>Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(n => (
                    <tr key={n.id}>
                      <td className="font-medium">{n.title}</td>
                      <td className="max-w-[220px] truncate text-gray-500 text-xs">{n.message}</td>
                      <td><AudienceLabel value={n.target_audience} /></td>
                      <td>{n.recipient_count ?? '\u2014'}</td>
                      <td>
                        {n.via_email ? (
                          <span className="badge-green"><CheckCircle size={11} className="inline mr-0.5" />Yes</span>
                        ) : (
                          <span className="badge-gray">No</span>
                        )}
                      </td>
                      <td>
                        {n.attachment ? (
                          <a
                            href={n.attachment}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                            title="View attachment"
                          >
                            <Paperclip size={13} />
                          </a>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                      <td className="text-xs text-gray-500">{formatDateTime(n.sent_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>)}
    </div>
  )
}
