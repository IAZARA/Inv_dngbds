export type UserRole = 'ADMIN' | 'OPERATOR' | 'CONSULTANT';
export type Sex = 'MASCULINO' | 'FEMENINO' | 'OTRO';
export type DocumentType = 'DNI' | 'PASAPORTE' | 'CEDULA_IDENTIDAD' | 'OTRO';
export type Jurisdiccion = 'FEDERAL' | 'PROVINCIAL' | 'SIN_DATO';
export type EstadoRequerimiento = 'CAPTURA_VIGENTE' | 'SIN_EFECTO' | 'DETENIDO';
export type Recompensa = 'SI' | 'NO' | 'SIN_DATO';
export type CaseMediaKind = 'PHOTO' | 'DOCUMENT';

export interface CaseAdditionalInfoEntry {
  label: string;
  value: string;
}

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

export interface CaseMediaItem {
  id: string;
  kind: CaseMediaKind;
  description?: string | null;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  isPrimary: boolean;
}

export interface CaseContactValueEntry {
  value: string;
}

export interface CaseSocialNetworkEntry {
  network: string;
  handle: string;
}

export interface CasePerson {
  id: string;
  firstName: string;
  lastName: string;
  sex: Sex | null;
  identityNumber?: string | null;
  documentType?: DocumentType | null;
  documentName?: string | null;
  birthdate?: string | null;
  age?: number | null;
  email?: string | null;
  phone?: string | null;
  emails?: CaseContactValueEntry[];
  phones?: CaseContactValueEntry[];
  socialNetworks?: CaseSocialNetworkEntry[];
  notes?: string | null;
  nationality: 'ARGENTINA' | 'OTRO';
  otherNationality?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  province?: string | null;
  locality?: string | null;
  reference?: string | null;
}

export interface CaseRecord {
  id: string;
  numeroCausa?: string | null;
  caratula?: string | null;
  juzgadoInterventor?: string | null;
  secretaria?: string | null;
  fiscalia?: string | null;
  jurisdiccion: Jurisdiccion;
  delito?: string | null;
  fechaHecho?: string | null;
  estadoRequerimiento: EstadoRequerimiento;
  fuerzaAsignada?: string | null;
  recompensa: Recompensa;
  rewardAmount?: string | null;
  creadoEn: string;
  actualizadoEn: string;
  additionalInfo: CaseAdditionalInfoEntry[];
  persona: CasePerson | null;
  photos: CaseMediaItem[];
  documents: CaseMediaItem[];
}
