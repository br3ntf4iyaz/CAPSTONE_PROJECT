import apiClient from './client'

export interface SKFeedbackItem {
  id: number
  barangay: number
  barangay_name: string
  category: 'concern' | 'suggestion' | 'praise'
  category_display: string
  subject: string
  message: string
  rating: number | null
  image_url: string | null
  is_anonymous: boolean
  status: 'received' | 'acknowledged' | 'resolved'
  status_display: string
  submitter_name: string
  created_at: string
}

export interface SubmitFeedbackPayload {
  category: 'concern' | 'suggestion' | 'praise'
  subject: string
  message: string
  rating?: number | null
  is_anonymous: boolean
  image?: File | null
}

export const skFeedbackApi = {
  submit: (payload: SubmitFeedbackPayload) => {
    if (payload.image) {
      const fd = new FormData()
      fd.append('category', payload.category)
      fd.append('subject', payload.subject)
      fd.append('message', payload.message)
      if (payload.rating != null) fd.append('rating', String(payload.rating))
      fd.append('is_anonymous', String(payload.is_anonymous))
      fd.append('image', payload.image)
      return apiClient.post('/sk-requirements/feedback/', fd).then(r => r.data as SKFeedbackItem)
    }
    const { image: _img, ...rest } = payload
    return apiClient.post('/sk-requirements/feedback/', rest).then(r => r.data as SKFeedbackItem)
  },

  list: (barangayId?: number) =>
    apiClient
      .get('/sk-requirements/feedback/', { params: barangayId ? { barangay: barangayId } : undefined })
      .then(r => {
        const d = r.data
        return Array.isArray(d) ? d : (d.results ?? []) as SKFeedbackItem[]
      }),

  updateStatus: (id: number, status: 'received' | 'acknowledged' | 'resolved') =>
    apiClient.patch(`/sk-requirements/feedback/${id}/`, { status }).then(r => r.data as SKFeedbackItem),
}
