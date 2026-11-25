import apiClient from './client'

export interface CommunityPostImage {
  id: number
  url: string
  order: number
}

export interface CommunityComment {
  id: number
  content: string
  author_name: string
  author_avatar: string | null
  is_own: boolean
  created_at: string
  author_account_type?: string
  parent_id?: number | null
  is_hidden?: boolean
  is_deleted?: boolean
  can_delete?: boolean
  can_hide?: boolean
  hidden_label?: string
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
  my_reaction?: string | null
  reaction_summary?: { type: string; count: number }[]
  comment_count: number
  is_own: boolean
}

export interface CommunityReactor {
  id: number
  name: string
  avatar: string | null
  account_type: string
  reaction: string
  reacted_at: string
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
    apiClient
      .post<CommunityPost>('/community/posts/', data,
        data instanceof FormData ? { headers: { 'Content-Type': undefined } } : undefined,
      )
      .then(r => r.data),

  update: (id: number, content: string) =>
    apiClient.patch<CommunityPost>(`/community/posts/${id}/`, { content }).then(r => r.data),

  delete: (id: number) => apiClient.delete<void>(`/community/posts/${id}/`),

  react: (id: number, reaction: string) =>
    apiClient
      .post<{ liked: boolean; reaction: string | null; count: number; summary: { type: string; count: number }[] }>(`/community/posts/${id}/react/`, { reaction })
      .then(r => r.data),

  reactors: (id: number) =>
    apiClient.get<{ count: number; results: CommunityReactor[] }>(`/community/posts/${id}/reactors/`).then(r => r.data),

  get: (id: number) =>
    apiClient.get<CommunityPost>(`/community/posts/${id}/`).then(r => r.data),

  pin: (id: number) =>
    apiClient.post<{ is_pinned: boolean }>(`/community/posts/${id}/pin/`).then(r => r.data),

  listComments: (postId: number) =>
    apiClient.get<CommunityComment[]>(`/community/posts/${postId}/comments/`).then(r => r.data),

  createComment: (postId: number, content: string, parent?: number | null) =>
    apiClient.post<CommunityComment>(`/community/posts/${postId}/comments/`, { content, ...(parent ? { parent } : {}) }).then(r => r.data),

  hideComment: (postId: number, commentId: number) =>
    apiClient.post<CommunityComment>(`/community/posts/${postId}/comments/${commentId}/hide/`).then(r => r.data),

  restoreComment: (postId: number, commentId: number) =>
    apiClient.post<CommunityComment>(`/community/posts/${postId}/comments/${commentId}/restore/`).then(r => r.data),

  deleteComment: (postId: number, commentId: number) =>
    apiClient.delete<void>(`/community/posts/${postId}/comments/${commentId}/`),
}
