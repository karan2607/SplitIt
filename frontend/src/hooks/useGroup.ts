import { useState, useEffect, useCallback } from 'react'
import { api, type Group, type GroupDetail } from '../lib/api'

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(() => {
    setIsLoading(true)
    api.groups.list()
      .then(setGroups)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => { fetch() }, [fetch])

  return { groups, isLoading, error, refetch: fetch }
}

export function useGroup(id: string) {
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((showSpinner: boolean) => {
    if (showSpinner) setIsLoading(true)
    api.groups.get(id)
      .then(setGroup)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false))
  }, [id])

  useEffect(() => { load(true) }, [load])

  // refetch silently — no spinner, so child components stay mounted
  const refetch = useCallback(() => load(false), [load])

  return { group, isLoading, error, refetch }
}
