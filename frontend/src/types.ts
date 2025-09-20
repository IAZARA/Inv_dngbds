export type UserRole = 'ADMIN' | 'OPERATOR' | 'CONSULTANT';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface PersonSummary {
  id: string;
  identityNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  birthdate?: string | null;
  createdAt: string;
  updatedAt: string;
  records: Array<{
    id: string;
    summary?: string | null;
    collectedAt: string;
    source: {
      id: string;
      name: string;
      kind: string;
    };
  }>;
}

export interface SourceRecord {
  id: string;
  summary?: string | null;
  collectedAt: string;
  rawPayload?: unknown;
  source: {
    id: string;
    name: string;
    kind: string;
    description?: string | null;
  };
  collectedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface PersonDetail extends PersonSummary {
  notes?: string | null;
  records: SourceRecord[];
}

export interface Source {
  id: string;
  name: string;
  kind: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CasePersonAddress {
  id: string;
  addressText: string;
  principal: boolean;
}

export interface CasePerson {
  id: string;
  firstName: string;
  lastName: string;
  identityNumber?: string | null;
  birthdate?: string | null;
  notes?: string | null;
  nationality: 'ARGENTINA' | 'OTRO';
  otherNationality?: string | null;
  addresses: CasePersonAddress[];
}

export interface CaseRecord {
  id: string;
  numeroCausa?: string | null;
  fechaHecho?: string | null;
  estadoSituacion: string;
  fuerzaAsignada?: string | null;
  reward?: string | null;
  creadoEn: string;
  actualizadoEn: string;
  persona: CasePerson | null;
}
