import type { TabId } from './types';

export const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
export const recompensaAmountRegex = /^\d{1,15}(\.\d{1,2})?$/;

export const fuerzaIntervinienteOptions = ['PFA', 'GNA', 'PNA', 'PSA', 'S/D'] as const;
export const estadoRequerimientoOptions = ['CAPTURA_VIGENTE', 'SIN_EFECTO', 'DETENIDO'] as const;
export const nationalityOptions = ['ARGENTINA', 'OTRO'] as const;
export const sexOptions = ['MASCULINO', 'FEMENINO', 'OTRO'] as const;
export const documentTypeOptions = ['DNI', 'PASAPORTE', 'CEDULA_IDENTIDAD', 'OTRO'] as const;
export const jurisdiccionOptions = ['FEDERAL', 'PROVINCIAL', 'SIN_DATO'] as const;
export const recompensaOptions = ['SI', 'NO', 'SIN_DATO'] as const;
export const rewardAmountStatusOptions = ['KNOWN', 'UNKNOWN'] as const;

export const defaultPhotoDescription = 'Foto del investigado';
export const defaultDocumentDescription = 'Documento adjunto';

export const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'identidad', label: 'Identidad' },
  { id: 'contacto', label: 'Contacto' },
  { id: 'domicilio', label: 'Domicilio' },
  { id: 'judicial', label: 'Datos Judiciales' },
  { id: 'informacion', label: 'Información complementaria' },
  { id: 'fotos', label: 'Fotos' },
  { id: 'documentos', label: 'Documentos' }
];
