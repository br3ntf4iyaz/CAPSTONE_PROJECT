import apiClient from './client'

export interface CommunityPostImage {
  id: number
  url: string
  order: number
}

export interface CommunityPost {
  id: number
  content: string
  images: CommunityPostImage[]
  is_pinned: boolean
  created_at: string
  author_name: string
  author_role: string
  author_youth_type: string
  author_barangay: string
  author_avatar: string | null
  like_count: number
  is_liked: boolean
  is_own: boolean
}

export interface CommunityPostPage {
  results: CommunityPost[]
  next: string | null
}

export const communityApi = {
  list: (page = 1, barangay?: string): Promise<CommunityPostPage> =>
    apiClient
      .get('/community/posts/', { params: { page, ...(barangay ? { barangay } : {}) } })
      .then(r => {
        const d = r.data as any
        return {
          results: (Array.isArray(d) ? d : (d.results ?? [])) as CommunityPost[],
          next: d.next ?? null,
        }
      }),

  create: (data: FormData | { content: string }) =>
    apiClient.post<CommunityPost>('/community/posts/', data).then(r => r.data),

  delete: (id: number) => apiClient.delete<void>(`/community/posts/${id}/`),

  react: (id: number) =>
    apiClient.post<{ liked: boolean; count: number }>(`/community/posts/${id}/react/`).then(r => r.data),

  pin: (id: number) =>
    apiClient.post<{ is_pinned: boolean }>(`/community/posts/${id}/pin/`).then(r => r.data),
}
