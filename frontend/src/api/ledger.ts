import { useQuery } from '@tanstack/react-query'
import apiClient from './client'

export type IntegrityStatus =
  | 'verified' | 'changed' | 'tampered' | 'pending' | 'failed' | 'unanchored' | 'not_applicable'

export interface IntegrityResult {
  status: IntegrityStatus
  network?: string
  tx_hash?: string
  block?: number | null
  anchored_at?: string | null
  fingerprint?: string
  explorer_url?: string
}

export interface IntegrityMap {
  backend: 'ledger' | 'evm'
  network: string
  results: Record<string, IntegrityResult>
}

export interface AuditDay extends IntegrityResult {
  day: string
  count: number
}

export interface LedgerStatus {
  backend: 'ledger' | 'evm'
  network: string
  by_kind: Record<string, { anchored: number; pending: number; failed: number }>
  local_chain_intact: boolean
}

/** Integrity checks are a bonus: if the call fails the page just shows no badges. */
function useIntegrity(key: unknown[], url: string, enabled = true) {
  return useQuery<IntegrityMap>({
    queryKey: ['ledger', ...key],
    queryFn: () => apiClient.get(url).then(r => r.data),
    enabled,
    retry: false,
    staleTime: 30_000,
  })
}

export const useReviewLogIntegrity = (submissionId?: number) =>
  useIntegrity(['review-logs', submissionId], `/ledger/review-logs/${submissionId}/`, !!submissionId)

/** Is the proposal still as it was when submitted for review? (`not_applicable` while still a draft.) */
export const useSubmissionContentIntegrity = (submissionId?: number) =>
  useQuery<{ backend: string; network: string; result: IntegrityResult }>({
    queryKey: ['ledger', 'submission-content', submissionId],
    queryFn: () => apiClient.get(`/ledger/submission-content/${submissionId}/`).then(r => r.data),
    enabled: !!submissionId,
    retry: false,
    staleTime: 30_000,
  })

/** Admin: keys are YORP ids. Only approved / rejected organizations appear. */
export const useYORPDecisionIntegrity = () =>
  useIntegrity(['yorp-decisions'], '/ledger/yorp-decisions/')

export const useSKRequirementIntegrity = () =>
  useIntegrity(['sk-requirements'], '/ledger/sk-requirements/')

export const useIDDecisionIntegrity = () =>
  useIntegrity(['id-verifications'], '/ledger/id-verifications/')

/** Keys are `course-<id>` and `recognition-<id>`. */
export const useCertificateIntegrity = () =>
  useIntegrity(['certificates'], '/ledger/certificates/')

export const useAuditDays = () =>
  useQuery<{ backend: string; network: string; days: AuditDay[] }>({
    queryKey: ['ledger', 'audit-days'],
    queryFn: () => apiClient.get('/ledger/audit-days/').then(r => r.data),
    retry: false,
  })

export const useLedgerStatus = () =>
  useQuery<LedgerStatus>({
    queryKey: ['ledger', 'status'],
    queryFn: () => apiClient.get('/ledger/status/').then(r => r.data),
    retry: false,
  })
