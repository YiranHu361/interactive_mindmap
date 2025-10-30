export type NodeType = 'career' | 'skill'

export type Node = {
  id: string
  type: NodeType
  label: string
  summary?: string
  metadata?: Record<string, unknown>
}

export type Edge = {
  id: string
  sourceId: string
  targetId: string
  weight?: number
}


