/** Uma empresa (conta) como o dono da plataforma a enxerga. */
export interface PlatformCompany {
  id: string
  name: string
  createdAt: string
  /** E-mail do primeiro administrador: é com ele que se fala. */
  adminEmail: string | null
  plan: string
  /** `null` = sem limite. */
  userLimit: number | null
  storageLimitMb: number | null
  recordLimit: number | null
  activeUsers: number
  totalUsers: number
  recordsUsed: number
  filesUsedBytes: number
}

export interface CompanyLimits {
  userLimit: number | null
  storageLimitMb: number | null
  recordLimit: number | null
}
