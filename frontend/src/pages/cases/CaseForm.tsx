import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode
} from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';

import { FaStar } from 'react-icons/fa';
import { api, resolveAssetUrl } from '../../lib/api';
import type { CaseMediaItem, CaseRecord } from '../../types';
import {
  defaultDocumentDescription,
  defaultPhotoDescription,
  documentTypeOptions,
  estadoRequerimientoOptions,
  fuerzaIntervinienteOptions,
  jurisdiccionOptions,
  nationalityOptions,
  recompensaOptions,
  sexOptions,
  tabs
} from './constants';
import type { CaseFormValues } from './formSchema';
import { caseFormSchema, defaultValues } from './formSchema';
import { computeAge, formatOptionText, mapCaseToForm, translateFuerza } from './helpers';
import type { TabId } from './types';

type CaseFormProps = {
  canEdit: boolean;
  editingCase: CaseRecord | null;
  onCancel: () => void;
  onSubmit: (values: CaseFormValues) => void;
  onEditingCaseChange: (next: CaseRecord | null) => void;
  isSaving: boolean;
};

type FieldArraySectionProps = {
  title: string;
  addLabel: string;
  canEdit: boolean;
  onAdd: () => void;
  emptyMessage: string;
  itemsLength: number;
  children: ReactNode;
};

const FieldArraySection = ({
  title,
  addLabel,
  canEdit,
  onAdd,
  emptyMessage,
  itemsLength,
  children
}: FieldArraySectionProps) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}
    >
      <h4 style={{ margin: 0 }}>{title}</h4>
      <button
        type="button"
        className="btn ghost"
        onClick={onAdd}
        disabled={!canEdit}
      >
        {addLabel}
      </button>
    </div>
    {itemsLength === 0 ? (
      <p className="muted" style={{ margin: 0 }}>
        {emptyMessage}
      </p>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>
    )}
  </section>
);

type FieldArrayItemProps = {
  canEdit: boolean;
  onRemove: () => void;
  children: ReactNode;
};

const fieldCardStyle = {
  border: '1px solid var(--gray-600)',
  borderRadius: '0.75rem',
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem'
} as const;

const FieldArrayItem = ({ canEdit, onRemove, children }: FieldArrayItemProps) => (
  <div style={fieldCardStyle}>
    {children}
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <button type="button" className="btn ghost danger" onClick={onRemove} disabled={!canEdit}>
        Quitar
      </button>
    </div>
  </div>
);

const CaseForm = ({
  canEdit,
  editingCase,
  onCancel,
  onSubmit,
  onEditingCaseChange,
  isSaving
}: CaseFormProps) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>('identidad');
  const [photos, setPhotos] = useState<CaseMediaItem[]>([]);
  const [documents, setDocuments] = useState<CaseMediaItem[]>([]);
  const [photoDescriptions, setPhotoDescriptions] = useState<Record<string, string>>({});
  const [documentDescriptions, setDocumentDescriptions] = useState<Record<string, string>>({});
  const [photoFormDescription, setPhotoFormDescription] = useState<string>(defaultPhotoDescription);
  const [documentFormDescription, setDocumentFormDescription] =
    useState<string>(defaultDocumentDescription);
  const [photoFormFile, setPhotoFormFile] = useState<File | null>(null);
  const [documentFormFile, setDocumentFormFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);

  const invalidateCaseQueries = () => {
    if (editingCase?.id) {
      queryClient.invalidateQueries({ queryKey: ['case', editingCase.id] });
    }
    queryClient.invalidateQueries({ queryKey: ['cases'] });
  };

  const resolver = useMemo(() => zodResolver(caseFormSchema) as Resolver<CaseFormValues>, []);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    getValues,
    clearErrors,
    formState: { errors, isSubmitting }
  } = useForm<CaseFormValues>({
    resolver,
    defaultValues
  });

  const birthdateValue = useWatch({ control, name: 'persona.birthdate' });
  const nationalityValue = useWatch({ control, name: 'persona.nationality' });
  const recompensaValue = useWatch({ control, name: 'recompensa' });
  const rewardAmountStatus = useWatch({ control, name: 'rewardAmountStatus' });

  const {
    fields: emailFields,
    append: appendEmail,
    remove: removeEmail
  } = useFieldArray({
    control,
    name: 'persona.emails'
  });

  const {
    fields: phoneFields,
    append: appendPhone,
    remove: removePhone
  } = useFieldArray({
    control,
    name: 'persona.phones'
  });

  const {
    fields: socialFields,
    append: appendSocialNetwork,
    remove: removeSocialNetwork
  } = useFieldArray({
    control,
    name: 'persona.socialNetworks'
  });

  const {
    fields: additionalInfoFields,
    append: appendAdditionalInfo,
    remove: removeAdditionalInfo
  } = useFieldArray({
    control,
    name: 'additionalInfo'
  });

  useEffect(() => {
    if (editingCase) {
      reset(mapCaseToForm(editingCase));
      setPhotos(editingCase.photos ?? []);
      setDocuments(editingCase.documents ?? []);
    } else {
      reset(defaultValues);
      setPhotos([]);
      setDocuments([]);
    }

    setActiveTab('identidad');
    setPhotoDescriptions({});
    setDocumentDescriptions({});
    setPhotoFormDescription(defaultPhotoDescription);
    setDocumentFormDescription(defaultDocumentDescription);
    setPhotoFormFile(null);
    setDocumentFormFile(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
  }, [editingCase, reset]);

  useEffect(() => {
    register('rewardAmountStatus');
  }, [register]);

  useEffect(() => {
    if (recompensaValue !== 'SI') {
      if (rewardAmountStatus !== 'KNOWN') {
        setValue('rewardAmountStatus', 'KNOWN', { shouldDirty: true, shouldValidate: true });
      }
      if (getValues('rewardAmount')) {
        setValue('rewardAmount', '', { shouldDirty: true, shouldValidate: true });
      } else {
        setValue('rewardAmount', '', { shouldDirty: false, shouldValidate: true });
      }
      clearErrors('rewardAmount');
    }
  }, [recompensaValue, rewardAmountStatus, setValue, getValues, clearErrors]);

  useEffect(() => {
    setPhotoDescriptions((current) => {
      const next = { ...current } as Record<string, string>;
      let changed = false;
      const existingIds = new Set(photos.map((item) => item.id));

      photos.forEach((photo) => {
        const value = photo.description ?? defaultPhotoDescription;
        if (next[photo.id] !== value) {
          next[photo.id] = value;
          changed = true;
        }
      });

      Object.keys(next).forEach((id) => {
        if (!existingIds.has(id)) {
          delete next[id];
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [photos]);

  useEffect(() => {
    setDocumentDescriptions((current) => {
      const next = { ...current } as Record<string, string>;
      let changed = false;
      const existingIds = new Set(documents.map((item) => item.id));

      documents.forEach((doc) => {
        const value = doc.description ?? defaultDocumentDescription;
        if (next[doc.id] !== value) {
          next[doc.id] = value;
          changed = true;
        }
      });

      Object.keys(next).forEach((id) => {
        if (!existingIds.has(id)) {
          delete next[id];
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [documents]);

  const photoUploadMutation = useMutation({
    mutationFn: async ({
      caseId,
      file,
      description
    }: {
      caseId: string;
      file: File;
      description: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', description);
      const { data } = await api.post(`/cases/${caseId}/photos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data.photo as CaseMediaItem;
    },
    onSuccess: (photo) => {
      setPhotos((current) => {
        const normalized = photo.isPrimary
          ? current.map((item) => ({ ...item, isPrimary: false }))
          : current;
        const next = [...normalized, photo];
        onEditingCaseChange(
          editingCase ? { ...editingCase, photos: next } : editingCase
        );
        return next;
      });
      setPhotoFormDescription(defaultPhotoDescription);
      setPhotoFormFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      invalidateCaseQueries();
    }
  });

  const documentUploadMutation = useMutation({
    mutationFn: async ({
      caseId,
      file,
      description
    }: {
      caseId: string;
      file: File;
      description: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('description', description);
      const { data } = await api.post(`/cases/${caseId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data.document as CaseMediaItem;
    },
    onSuccess: (document) => {
      setDocuments((current) => {
        const next = [...current, document];
        onEditingCaseChange(
          editingCase ? { ...editingCase, documents: next } : editingCase
        );
        return next;
      });
      setDocumentFormDescription(defaultDocumentDescription);
      setDocumentFormFile(null);
      if (documentInputRef.current) documentInputRef.current.value = '';
      invalidateCaseQueries();
    }
  });

  const photoDescriptionMutation = useMutation({
    mutationFn: async ({
      caseId,
      photoId,
      description
    }: {
      caseId: string;
      photoId: string;
      description: string;
    }) => {
      const { data } = await api.patch(`/cases/${caseId}/photos/${photoId}`, { description });
      return data.photo as CaseMediaItem;
    },
    onSuccess: (photo) => {
      setPhotos((current) => {
        const next = current.map((item) => (item.id === photo.id ? photo : item));
        onEditingCaseChange(
          editingCase ? { ...editingCase, photos: next } : editingCase
        );
        return next;
      });
      setPhotoDescriptions((current) => ({ ...current, [photo.id]: photo.description ?? '' }));
      invalidateCaseQueries();
    }
  });

  const photoPrimaryMutation = useMutation({
    mutationFn: async ({
      caseId,
      photoId
    }: {
      caseId: string;
      photoId: string;
    }) => {
      const { data } = await api.patch(`/cases/${caseId}/photos/${photoId}/primary`);
      return data.photo as CaseMediaItem;
    },
    onSuccess: (photo) => {
      setPhotos((current) => {
        const next = current.map((item) => ({
          ...item,
          isPrimary: item.id === photo.id
        }));
        onEditingCaseChange(
          editingCase ? { ...editingCase, photos: next } : editingCase
        );
        return next;
      });
      invalidateCaseQueries();
    }
  });

  const documentDescriptionMutation = useMutation({
    mutationFn: async ({
      caseId,
      documentId,
      description
    }: {
      caseId: string;
      documentId: string;
      description: string;
    }) => {
      const { data } = await api.patch(`/cases/${caseId}/documents/${documentId}`, {
        description
      });
      return data.document as CaseMediaItem;
    },
    onSuccess: (document) => {
      setDocuments((current) => {
        const next = current.map((item) => (item.id === document.id ? document : item));
        onEditingCaseChange(
          editingCase ? { ...editingCase, documents: next } : editingCase
        );
        return next;
      });
      setDocumentDescriptions((current) => ({
        ...current,
        [document.id]: document.description ?? ''
      }));
      invalidateCaseQueries();
    }
  });

  const photoDeleteMutation = useMutation({
    mutationFn: async ({
      caseId,
      photoId
    }: {
      caseId: string;
      photoId: string;
    }) => {
      await api.delete(`/cases/${caseId}/photos/${photoId}`);
    },
    onSuccess: (_data, variables) => {
      setPhotos((current) => {
        const removed = current.find((photo) => photo.id === variables.photoId);
        let next = current.filter((photo) => photo.id !== variables.photoId);
        if (removed?.isPrimary && next.length > 0) {
          next = next.map((photo, index) => ({
            ...photo,
            isPrimary: index === 0
          }));
        }
        onEditingCaseChange(
          editingCase ? { ...editingCase, photos: next } : editingCase
        );
        return next;
      });
      setPhotoDescriptions((current) => {
        const rest = { ...current };
        delete rest[variables.photoId];
        return rest;
      });
      invalidateCaseQueries();
    }
  });

  const documentDeleteMutation = useMutation({
    mutationFn: async ({
      caseId,
      documentId
    }: {
      caseId: string;
      documentId: string;
    }) => {
      await api.delete(`/cases/${caseId}/documents/${documentId}`);
    },
    onSuccess: (_data, variables) => {
      setDocuments((current) => {
        const next = current.filter((doc) => doc.id !== variables.documentId);
        onEditingCaseChange(
          editingCase ? { ...editingCase, documents: next } : editingCase
        );
        return next;
      });
      setDocumentDescriptions((current) => {
        const rest = { ...current };
        delete rest[variables.documentId];
        return rest;
      });
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    }
  });

  const hasTabErrors = (tabId: TabId): boolean => {
    switch (tabId) {
      case 'identidad':
        return !!(
          errors.persona?.firstName ||
          errors.persona?.lastName ||
          errors.persona?.sex ||
          errors.persona?.birthdate ||
          errors.persona?.documentName ||
          errors.persona?.documentType ||
          errors.persona?.nationality ||
          errors.persona?.otherNationality
        );
      case 'contacto':
        return (
          Array.isArray(errors.persona?.emails) && errors.persona?.emails.some((entry) => !!entry)
        ) ||
          (Array.isArray(errors.persona?.phones) && errors.persona?.phones.some((entry) => !!entry)) ||
          (Array.isArray(errors.persona?.socialNetworks) &&
            errors.persona?.socialNetworks.some((entry) => !!entry)) ||
          !!errors.persona?.notes;
      case 'domicilio':
        return !!(
          errors.persona?.street ||
          errors.persona?.streetNumber ||
          errors.persona?.province ||
          errors.persona?.locality ||
          errors.persona?.reference
        );
      case 'judicial':
        return !!(
          errors.numeroCausa ||
          errors.caratula ||
          errors.juzgadoInterventor ||
          errors.secretaria ||
          errors.fiscalia ||
          errors.jurisdiccion ||
          errors.delito ||
          errors.fechaHecho ||
          errors.estadoRequerimiento ||
          errors.fuerzaAsignada ||
          errors.recompensa ||
          errors.rewardAmount
        );
      case 'informacion':
        return Array.isArray(errors.additionalInfo)
          ? errors.additionalInfo.some((entry) => !!entry)
          : false;
      default:
        return false;
    }
  };

  const handlePhotoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPhotoFormFile(file);
  };

  const handleDocumentFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setDocumentFormFile(file);
  };

  const handlePhotoUpload = (
    event?: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>
  ) => {
    event?.preventDefault();
    if (!canEdit || photoUploadMutation.isPending) {
      return;
    }
    if (!editingCase?.id || !photoFormFile) {
      return;
    }
    photoUploadMutation.mutate({
      caseId: editingCase.id,
      file: photoFormFile,
      description: photoFormDescription
    });
  };

  const handlePhotoFormKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handlePhotoUpload();
    }
  };

  const handleDocumentUpload = (
    event?: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>
  ) => {
    event?.preventDefault();
    if (!canEdit || documentUploadMutation.isPending) {
      return;
    }
    if (!editingCase?.id || !documentFormFile) {
      return;
    }
    documentUploadMutation.mutate({
      caseId: editingCase.id,
      file: documentFormFile,
      description: documentFormDescription
    });
  };

  const handleDocumentFormKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleDocumentUpload();
    }
  };

  const handlePhotoDescriptionInput = (photoId: string, value: string) => {
    setPhotoDescriptions((current) => ({ ...current, [photoId]: value.slice(0, 200) }));
  };

  const handleDocumentDescriptionInput = (documentId: string, value: string) => {
    setDocumentDescriptions((current) => ({ ...current, [documentId]: value.slice(0, 200) }));
  };

  const commitPhotoDescription = (photo: CaseMediaItem) => {
    if (!editingCase?.id) return;
    const value = photoDescriptions[photo.id] ?? '';
    if ((photo.description ?? '') === value) {
      return;
    }
    photoDescriptionMutation.mutate({
      caseId: editingCase.id,
      photoId: photo.id,
      description: value
    });
  };

  const commitDocumentDescription = (document: CaseMediaItem) => {
    if (!editingCase?.id) return;
    const value = documentDescriptions[document.id] ?? '';
    if ((document.description ?? '') === value) {
      return;
    }
    documentDescriptionMutation.mutate({
      caseId: editingCase.id,
      documentId: document.id,
      description: value
    });
  };

  const onFormSubmit = (values: CaseFormValues) => {
    if (!canEdit) return;
    onSubmit(values);
  };

  const formBusy = isSubmitting || isSaving;
  const ageValue = computeAge(birthdateValue ?? undefined);

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'identidad':
        return (
          <div className="form-grid">
            <label>
              Nombre
              <input type="text" {...register('persona.firstName')} disabled={!canEdit} />
              {errors.persona?.firstName && (
                <span className="error">{errors.persona.firstName.message}</span>
              )}
            </label>
            <label>
              Apellido
              <input type="text" {...register('persona.lastName')} disabled={!canEdit} />
              {errors.persona?.lastName && (
                <span className="error">{errors.persona.lastName.message}</span>
              )}
            </label>
            <label>
              Sexo
              <select {...register('persona.sex')} disabled={!canEdit}>
                {sexOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {errors.persona?.sex && <span className="error">{errors.persona.sex.message}</span>}
            </label>
            <label>
              Fecha de nacimiento
              <input type="date" {...register('persona.birthdate')} disabled={!canEdit} />
              {errors.persona?.birthdate && (
                <span className="error">{errors.persona.birthdate.message}</span>
              )}
            </label>
            <label>
              Edad
              <input type="text" value={ageValue} readOnly className="muted" />
            </label>
            <label>
              Tipo de documento
              <select {...register('persona.documentType')} disabled={!canEdit}>
                {documentTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Número de documento
              <input type="text" {...register('persona.documentName')} disabled={!canEdit} />
              {errors.persona?.documentName && (
                <span className="error">{errors.persona.documentName.message}</span>
              )}
            </label>
            <label>
              Nacionalidad
              <select {...register('persona.nationality')} disabled={!canEdit}>
                {nationalityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            {nationalityValue === 'OTRO' && (
              <label className="full">
                Especificar nacionalidad
                <input type="text" {...register('persona.otherNationality')} disabled={!canEdit} />
                {errors.persona?.otherNationality && (
                  <span className="error">{errors.persona.otherNationality.message}</span>
                )}
              </label>
            )}
          </div>
        );
      case 'contacto':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <FieldArraySection
              title="Correos electrónicos"
              addLabel="+ Agregar correo"
              canEdit={canEdit}
              onAdd={() => appendEmail({ value: '' })}
              emptyMessage="No hay correos cargados."
              itemsLength={emailFields.length}
            >
              {emailFields.map((field, index) => (
                <FieldArrayItem
                  key={field.id}
                  canEdit={canEdit}
                  onRemove={() => removeEmail(index)}
                >
                  <div
                    className="form-grid"
                    style={{ gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
                  >
                    <label>
                      Correo #{index + 1}
                      <input
                        type="email"
                        {...register(`persona.emails.${index}.value` as const)}
                        disabled={!canEdit}
                      />
                      {errors.persona?.emails?.[index]?.value && (
                        <span className="error">
                          {errors.persona.emails[index]?.value?.message}
                        </span>
                      )}
                    </label>
                  </div>
                </FieldArrayItem>
              ))}
            </FieldArraySection>

            <FieldArraySection
              title="Teléfonos"
              addLabel="+ Agregar teléfono"
              canEdit={canEdit}
              onAdd={() => appendPhone({ value: '' })}
              emptyMessage="No hay teléfonos cargados."
              itemsLength={phoneFields.length}
            >
              {phoneFields.map((field, index) => (
                <FieldArrayItem
                  key={field.id}
                  canEdit={canEdit}
                  onRemove={() => removePhone(index)}
                >
                  <div
                    className="form-grid"
                    style={{ gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
                  >
                    <label>
                      Teléfono #{index + 1}
                      <input
                        type="text"
                        {...register(`persona.phones.${index}.value` as const)}
                        disabled={!canEdit}
                      />
                      {errors.persona?.phones?.[index]?.value && (
                        <span className="error">
                          {errors.persona.phones[index]?.value?.message}
                        </span>
                      )}
                    </label>
                  </div>
                </FieldArrayItem>
              ))}
            </FieldArraySection>

            <FieldArraySection
              title="Redes sociales"
              addLabel="+ Agregar red social"
              canEdit={canEdit}
              onAdd={() => appendSocialNetwork({ network: '', handle: '' })}
              emptyMessage="No hay redes cargadas."
              itemsLength={socialFields.length}
            >
              {socialFields.map((field, index) => (
                <FieldArrayItem
                  key={field.id}
                  canEdit={canEdit}
                  onRemove={() => removeSocialNetwork(index)}
                >
                  <div
                    className="form-grid"
                    style={{ gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
                  >
                    <label>
                      Nombre de la red
                      <input
                        type="text"
                        placeholder="Instagram, Facebook, etc."
                        {...register(`persona.socialNetworks.${index}.network` as const)}
                        disabled={!canEdit}
                      />
                      {errors.persona?.socialNetworks?.[index]?.network && (
                        <span className="error">
                          {errors.persona.socialNetworks?.[index]?.network?.message}
                        </span>
                      )}
                    </label>
                    <label>
                      Identificador
                      <input
                        type="text"
                        placeholder="Usuario, enlace, etc."
                        {...register(`persona.socialNetworks.${index}.handle` as const)}
                        disabled={!canEdit}
                      />
                      {errors.persona?.socialNetworks?.[index]?.handle && (
                        <span className="error">
                          {errors.persona.socialNetworks?.[index]?.handle?.message}
                        </span>
                      )}
                    </label>
                  </div>
                </FieldArrayItem>
              ))}
            </FieldArraySection>

            <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h4 style={{ margin: 0 }}>Observaciones</h4>
              <div style={fieldCardStyle}>
                <label className="full" style={{ margin: 0, display: 'block' }}>
                  <textarea
                    rows={4}
                    placeholder="Observaciones generales sobre la persona"
                    {...register('persona.notes')}
                    disabled={!canEdit}
                  />
                  {errors.persona?.notes && (
                    <span className="error">{errors.persona.notes.message}</span>
                  )}
                </label>
              </div>
            </section>
          </div>
        );
      case 'domicilio':
        return (
          <div className="form-grid">
            <label>
              Calle
              <input type="text" {...register('persona.street')} disabled={!canEdit} />
              {errors.persona?.street && <span className="error">{errors.persona.street.message}</span>}
            </label>
            <label>
              Número
              <input type="text" {...register('persona.streetNumber')} disabled={!canEdit} />
              {errors.persona?.streetNumber && (
                <span className="error">{errors.persona.streetNumber.message}</span>
              )}
            </label>
            <label>
              Provincia
              <input type="text" {...register('persona.province')} disabled={!canEdit} />
              {errors.persona?.province && <span className="error">{errors.persona.province.message}</span>}
            </label>
            <label>
              Localidad
              <input type="text" {...register('persona.locality')} disabled={!canEdit} />
              {errors.persona?.locality && <span className="error">{errors.persona.locality.message}</span>}
            </label>
            <label className="full">
              Referencia
              <textarea rows={3} {...register('persona.reference')} disabled={!canEdit} />
              {errors.persona?.reference && <span className="error">{errors.persona.reference.message}</span>}
            </label>
          </div>
        );
      case 'judicial':
        return (
          <div className="form-grid">
            <label>
              N° de causa
              <input type="text" {...register('numeroCausa')} disabled={!canEdit} />
              {errors.numeroCausa && <span className="error">{errors.numeroCausa.message}</span>}
            </label>
            <label>
              Carátula
              <input type="text" {...register('caratula')} disabled={!canEdit} />
              {errors.caratula && <span className="error">{errors.caratula.message}</span>}
            </label>
            <label>
              Juzgado interventor
              <input type="text" {...register('juzgadoInterventor')} disabled={!canEdit} />
              {errors.juzgadoInterventor && (
                <span className="error">{errors.juzgadoInterventor.message}</span>
              )}
            </label>
            <label>
              Secretaría
              <input type="text" {...register('secretaria')} disabled={!canEdit} />
              {errors.secretaria && <span className="error">{errors.secretaria.message}</span>}
            </label>
            <label>
              Fiscalía
              <input type="text" {...register('fiscalia')} disabled={!canEdit} />
              {errors.fiscalia && <span className="error">{errors.fiscalia.message}</span>}
            </label>
            <label>
              Jurisdicción
              <select {...register('jurisdiccion')} disabled={!canEdit}>
                {jurisdiccionOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatOptionText(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Delito imputado
              <input type="text" {...register('delito')} disabled={!canEdit} />
              {errors.delito && <span className="error">{errors.delito.message}</span>}
            </label>
            <label>
              Fecha del hecho
              <input type="date" {...register('fechaHecho')} disabled={!canEdit} />
              {errors.fechaHecho && <span className="error">{errors.fechaHecho.message}</span>}
            </label>
            <label>
              Estado del requerimiento
              <select {...register('estadoRequerimiento')} disabled={!canEdit}>
                {estadoRequerimientoOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatOptionText(option)}
                  </option>
                ))}
              </select>
              {errors.estadoRequerimiento && (
                <span className="error">{errors.estadoRequerimiento.message}</span>
              )}
            </label>
            <label>
              Fuerza interviniente
              <select {...register('fuerzaAsignada')} disabled={!canEdit}>
                {fuerzaIntervinienteOptions.map((option) => (
                  <option key={option} value={option}>
                    {translateFuerza(option)}
                  </option>
                ))}
              </select>
              {errors.fuerzaAsignada && <span className="error">{errors.fuerzaAsignada.message}</span>}
            </label>
            <label>
              Recompensa
              <select {...register('recompensa')} disabled={!canEdit}>
                {recompensaOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatOptionText(option)}
                  </option>
                ))}
              </select>
              {errors.recompensa && <span className="error">{errors.recompensa.message}</span>}
            </label>
            {recompensaValue === 'SI' && (
              <div className="reward-section">
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={rewardAmountStatus === 'UNKNOWN'}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => {
                      const isUnknown = event.target.checked;
                      setValue('rewardAmountStatus', isUnknown ? 'UNKNOWN' : 'KNOWN', {
                        shouldDirty: true,
                        shouldValidate: true
                      });
                      if (isUnknown) {
                        setValue('rewardAmount', '', { shouldDirty: true, shouldValidate: true });
                        clearErrors('rewardAmount');
                      }
                    }}
                    disabled={!canEdit}
                  />
                  <span>Monto pendiente de confirmar</span>
                </label>
                {rewardAmountStatus === 'KNOWN' && (
                  <label>
                    Monto de recompensa (ARS)
                    <input type="text" {...register('rewardAmount')} disabled={!canEdit} />
                    {errors.rewardAmount && (
                      <span className="error">{errors.rewardAmount.message}</span>
                    )}
                  </label>
                )}
              </div>
            )}
          </div>
        );
      case 'informacion':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {additionalInfoFields.length === 0 && (
              <p className="muted">No hay información complementaria cargada.</p>
            )}
            {additionalInfoFields.map((field, index) => (
              <div
                key={field.id}
                style={{
                  border: '1px solid var(--gray-700)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                <div
                  className="form-grid"
                  style={{ gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
                >
                  <label>
                    Nombre del campo
                    <input
                      type="text"
                      {...register(`additionalInfo.${index}.label` as const)}
                      disabled={!canEdit}
                    />
                    {errors.additionalInfo?.[index]?.label && (
                      <span className="error">
                        {errors.additionalInfo?.[index]?.label?.message}
                      </span>
                    )}
                  </label>
                  <label className="full">
                    Valor
                    <textarea
                      rows={3}
                      {...register(`additionalInfo.${index}.value` as const)}
                      disabled={!canEdit}
                    />
                    {errors.additionalInfo?.[index]?.value && (
                      <span className="error">
                        {errors.additionalInfo?.[index]?.value?.message}
                      </span>
                    )}
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn ghost danger"
                    onClick={() => removeAdditionalInfo(index)}
                    disabled={!canEdit}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
            <div>
              <button
                type="button"
                className="btn ghost"
                onClick={() => appendAdditionalInfo({ label: '', value: '' })}
                disabled={!canEdit}
              >
                + Agregar campo
              </button>
            </div>
          </div>
        );
      case 'fotos':
        if (!editingCase?.id) {
          return <p className="muted">Guarda primero el caso para adjuntar fotos.</p>;
        }

        return (
          <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-grid" role="group" aria-label="Formulario de carga de fotos">
              <label className="full">
                Seleccionar archivo
                <input
                  type="file"
                  ref={photoInputRef}
                  onChange={handlePhotoFileChange}
                  accept="image/*"
                  disabled={!canEdit || photoUploadMutation.isPending}
                />
              </label>
              <label className="full">
                Descripción (máx. 200 caracteres)
                <input
                  type="text"
                  value={photoFormDescription}
                  onChange={(event) => setPhotoFormDescription(event.target.value.slice(0, 200))}
                  onKeyDown={handlePhotoFormKeyDown}
                  disabled={!canEdit || photoUploadMutation.isPending}
                />
              </label>
              <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!canEdit || !photoFormFile || photoUploadMutation.isPending}
                  onClick={handlePhotoUpload}
                >
                  {photoUploadMutation.isPending ? 'Subiendo…' : 'Subir foto'}
                </button>
              </div>
            </div>

            {photos.length === 0 ? (
              <p className="muted">No hay fotos adjuntas.</p>
            ) : (
              <div className="records-list photo-grid">
                {photos.map((photo) => {
                  const descriptionValue = photoDescriptions[photo.id] ?? '';
                  const isDeleting =
                    photoDeleteMutation.variables?.photoId === photo.id && photoDeleteMutation.isPending;
                  return (
                    <article key={photo.id} className="record-item" style={{ gap: '0.75rem' }}>
                      <div
                        className={`case-photo-frame${photo.isPrimary ? ' is-primary' : ''}`}
                      >
                        <img
                          src={resolveAssetUrl(photo.url)}
                          alt={photo.description ?? 'Foto del caso'}
                        />
                        <button
                          type="button"
                          className={`photo-primary-toggle${photo.isPrimary ? ' active' : ''}`}
                          onClick={() => {
                            if (!editingCase?.id || photo.isPrimary) return;
                            photoPrimaryMutation.mutate({
                              caseId: editingCase.id,
                              photoId: photo.id
                            });
                          }}
                          disabled={!canEdit || photoPrimaryMutation.isPending}
                          aria-label={photo.isPrimary ? 'Foto principal' : 'Marcar como principal'}
                        >
                          <FaStar />
                        </button>
                        {photo.isPrimary && <span className="photo-primary-badge">Principal</span>}
                      </div>
                      <label className="full" style={{ display: 'block' }}>
                        Descripción
                        <input
                          type="text"
                          value={descriptionValue}
                          maxLength={200}
                          onChange={(event) => handlePhotoDescriptionInput(photo.id, event.target.value)}
                          onBlur={() => commitPhotoDescription(photo)}
                          disabled={!canEdit || photoDescriptionMutation.isPending}
                        />
                      </label>
                      <p className="muted" style={{ fontSize: '0.75rem' }}>
                        Subida: {new Date(photo.uploadedAt).toLocaleString()}
                      </p>
                      <div className="form-actions" style={{ justifyContent: 'space-between' }}>
                        <a
                          className="btn ghost"
                          href={resolveAssetUrl(photo.url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver
                        </a>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() =>
                            editingCase?.id &&
                            photoDeleteMutation.mutate({ caseId: editingCase.id, photoId: photo.id })
                          }
                          disabled={!canEdit || isDeleting}
                        >
                          {isDeleting ? 'Eliminando…' : 'Eliminar'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        );
      case 'documentos':
        if (!editingCase?.id) {
          return <p className="muted">Guarda primero el caso para adjuntar documentos.</p>;
        }

        return (
          <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-grid" role="group" aria-label="Formulario de carga de documentos">
              <label className="full">
                Seleccionar archivo
                <input
                  type="file"
                  ref={documentInputRef}
                  onChange={handleDocumentFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf,.odt,.ods,image/*"
                  disabled={!canEdit || documentUploadMutation.isPending}
                />
              </label>
              <label className="full">
                Descripción (máx. 200 caracteres)
                <input
                  type="text"
                  value={documentFormDescription}
                  onChange={(event) => setDocumentFormDescription(event.target.value.slice(0, 200))}
                  onKeyDown={handleDocumentFormKeyDown}
                  disabled={!canEdit || documentUploadMutation.isPending}
                />
              </label>
              <div className="form-actions" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn primary"
                  disabled={!canEdit || !documentFormFile || documentUploadMutation.isPending}
                  onClick={handleDocumentUpload}
                >
                  {documentUploadMutation.isPending ? 'Subiendo…' : 'Subir documento'}
                </button>
              </div>
            </div>

            {documents.length === 0 ? (
              <p className="muted">No hay documentos adjuntos.</p>
            ) : (
              <div className="records-list" style={{ gap: '1rem' }}>
                {documents.map((document) => {
                  const descriptionValue = documentDescriptions[document.id] ?? '';
                  const isDeleting =
                    documentDeleteMutation.variables?.documentId === document.id &&
                    documentDeleteMutation.isPending;
                  return (
                    <article key={document.id} className="record-item" style={{ gap: '0.75rem' }}>
                      <div style={{ flex: 1 }}>
                        <strong>{document.originalName}</strong>
                        <p className="muted" style={{ fontSize: '0.75rem' }}>
                          {document.mimeType} · {(document.size / 1024).toFixed(1)} KB ·{' '}
                          {new Date(document.uploadedAt).toLocaleString()}
                        </p>
                        <label className="full" style={{ display: 'block' }}>
                          Descripción
                          <input
                            type="text"
                            value={descriptionValue}
                            maxLength={200}
                            onChange={(event) =>
                              handleDocumentDescriptionInput(document.id, event.target.value)
                            }
                            onBlur={() => commitDocumentDescription(document)}
                            disabled={!canEdit || documentDescriptionMutation.isPending}
                          />
                        </label>
                      </div>
                      <div className="actions" style={{ gap: '0.5rem' }}>
                        <a
                          className="btn ghost"
                          href={resolveAssetUrl(document.url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Descargar
                        </a>
                        <button
                          type="button"
                          className="btn ghost"
                          onClick={() =>
                            editingCase?.id &&
                            documentDeleteMutation.mutate({
                              caseId: editingCase.id,
                              documentId: document.id
                            })
                          }
                          disabled={!canEdit || isDeleting}
                        >
                          {isDeleting ? 'Eliminando…' : 'Eliminar'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section className="card">
      <form onSubmit={handleSubmit(onFormSubmit)} className="form" style={{ gap: '1.5rem' }}>
        <div className="tabs-container">
          <div className="tabs-header">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''} ${
                  hasTabErrors(tab.id) ? 'has-errors' : ''
                }`}
              >
                <span className="tab-label">
                  {tab.label}
                  {hasTabErrors(tab.id) && <span className="error-indicator">!</span>}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div role="tabpanel" className="tab-panel">
          {renderActiveTab()}
        </div>

        <div className="form-actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn ghost" onClick={onCancel} disabled={formBusy}>
            Cancelar
          </button>
          <button className="btn primary" type="submit" disabled={formBusy || !canEdit}>
            {formBusy ? 'Guardando...' : editingCase ? 'Actualizar caso' : 'Crear caso'}
          </button>
        </div>
      </form>
    </section>
  );
};

export default CaseForm;
