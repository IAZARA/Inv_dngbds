import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import type { SubmitHandler } from 'react-hook-form/dist/types';
import { z } from 'zod';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { CaseRecord } from '../types';

const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
const fuerzaAsignadaOptions = ['PFA', 'GNA', 'PNA', 'PSA', 'S/D'] as const;
const estadoSituacionOptions = ['VIGENTE', 'DETENIDO', 'SIN EFECTO', 'S/D'] as const;
const nationalityOptions = ['ARGENTINA', 'OTRO'] as const;

const caseFormSchema = z
  .object({
    numeroCausa: z.string().max(120).optional(),
    fechaHecho: z
      .string()
      .regex(dateRegex, 'Formato YYYY-MM-DD')
      .optional()
      .or(z.literal('')),
    estadoSituacion: z.enum(estadoSituacionOptions),
    fuerzaAsignada: z.enum(fuerzaAsignadaOptions),
    reward: z.string().max(120).optional(),
    persona: z.object({
      firstName: z.string().min(1, 'Nombre requerido'),
      lastName: z.string().min(1, 'Apellido requerido'),
      identityNumber: z.string().max(50).optional(),
      birthdate: z
        .string()
        .regex(dateRegex, 'Formato YYYY-MM-DD')
        .optional()
        .or(z.literal('')),
      notes: z.string().max(500).optional(),
      nationality: z.enum(nationalityOptions).default('ARGENTINA'),
      otherNationality: z.string().max(120).optional(),
      addresses: z.array(z.string()).default([])
    })
  })
  .superRefine((data, ctx) => {
    const { persona } = data;

    if (persona.nationality === 'OTRO') {
      if (!persona.otherNationality || persona.otherNationality.trim().length === 0) {
        ctx.addIssue({
          path: ['persona', 'otherNationality'],
          code: z.ZodIssueCode.custom,
          message: 'Especifica la nacionalidad'
        });
      }
    }

    const addresses = persona.addresses ?? [];
    if (addresses.length === 0) {
      ctx.addIssue({
        path: ['persona', 'addresses'],
        code: z.ZodIssueCode.custom,
        message: 'Añade al menos un domicilio'
      });
    }

    addresses.forEach((address, index) => {
      if (!address || address.trim().length === 0) {
        ctx.addIssue({
          path: ['persona', 'addresses', index],
          code: z.ZodIssueCode.custom,
          message: 'Domicilio requerido'
        });
      }
    });
  });

type CaseFormValues = z.infer<typeof caseFormSchema>;

type CasesListResponse = { cases: CaseRecord[] };

const defaultValues: CaseFormValues = {
  numeroCausa: '',
  fechaHecho: '',
  estadoSituacion: 'S/D',
  fuerzaAsignada: 'S/D',
  reward: '',
  persona: {
    firstName: '',
    lastName: '',
    identityNumber: '',
    birthdate: '',
    notes: '',
    nationality: 'ARGENTINA',
    otherNationality: '',
    addresses: ['']
  }
};

const blankToUndefined = (value?: string) => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const mapCaseToForm = (record: CaseRecord): CaseFormValues => ({
  numeroCausa: record.numeroCausa ?? '',
  fechaHecho: record.fechaHecho ? record.fechaHecho.slice(0, 10) : '',
  estadoSituacion: (record.estadoSituacion as CaseFormValues['estadoSituacion']) ?? 'S/D',
  fuerzaAsignada: (record.fuerzaAsignada as CaseFormValues['fuerzaAsignada']) ?? 'S/D',
  reward: record.reward ?? '',
  persona: {
    firstName: record.persona?.firstName ?? '',
    lastName: record.persona?.lastName ?? '',
    identityNumber: record.persona?.identityNumber ?? '',
    birthdate: record.persona?.birthdate ? record.persona.birthdate.slice(0, 10) : '',
    notes: record.persona?.notes ?? '',
    nationality: record.persona?.nationality ?? 'ARGENTINA',
    otherNationality: record.persona?.otherNationality ?? '',
    addresses:
      record.persona && record.persona.addresses.length > 0
        ? record.persona.addresses.map((address) => address.addressText)
        : ['']
  }
});

const buildPayload = (values: CaseFormValues) => ({
  numeroCausa: blankToUndefined(values.numeroCausa),
  fechaHecho: blankToUndefined(values.fechaHecho),
  estadoSituacion: values.estadoSituacion,
  fuerzaAsignada: values.fuerzaAsignada,
  reward: blankToUndefined(values.reward),
  persona: {
    firstName: values.persona.firstName,
    lastName: values.persona.lastName,
    identityNumber: blankToUndefined(values.persona.identityNumber),
    birthdate: blankToUndefined(values.persona.birthdate),
    notes: blankToUndefined(values.persona.notes),
    nationality: values.persona.nationality,
    otherNationality:
      values.persona.nationality === 'OTRO'
        ? blankToUndefined(values.persona.otherNationality)
        : undefined,
    addresses: (values.persona.addresses ?? []).map((address) => address.trim()).filter(Boolean)
  }
});

const computeAge = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970).toString();
};

const CasesPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canEdit = useMemo(() => (user ? ['ADMIN', 'OPERATOR'].includes(user.role) : false), [user]);
  const [editingCase, setEditingCase] = useState<CaseRecord | null>(null);
  const [showForm, setShowForm] = useState(false);

  const casesQuery = useQuery({
    queryKey: ['cases'],
    queryFn: async () => {
      const { data } = await api.get<CasesListResponse>('/cases');
      return data.cases;
    }
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<CaseFormValues>({
    resolver: zodResolver(caseFormSchema),
    defaultValues
  });

  const addressesFieldArray = useFieldArray({
    control,
    name: 'persona.addresses'
  });

  const birthdateValue = useWatch({ control, name: 'persona.birthdate' });
  const nationalityValue = useWatch({ control, name: 'persona.nationality' });

  useEffect(() => {
    if (!showForm) {
      reset(defaultValues);
      return;
    }

    if (editingCase) {
      reset(mapCaseToForm(editingCase));
    } else {
      reset(defaultValues);
    }
  }, [showForm, editingCase, reset]);

  useEffect(() => {
    if (!showForm) return;
    if (addressesFieldArray.fields.length === 0) {
      addressesFieldArray.append('');
    }
  }, [showForm, addressesFieldArray]);

  const createMutation = useMutation({
    mutationFn: async (payload: CaseFormValues) => {
      const { data } = await api.post('/cases', buildPayload(payload));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setShowForm(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: CaseFormValues }) => {
      const { data } = await api.patch(`/cases/${id}`, buildPayload(payload));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setEditingCase(null);
      setShowForm(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/cases/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      setEditingCase((current) => {
        if (current && current.id === id) {
          setShowForm(false);
          return null;
        }
        return current;
      });
    }
  });

  const onSubmit: SubmitHandler<CaseFormValues> = (values) => {
    if (!canEdit) return;
    if (editingCase) {
      updateMutation.mutate({ id: editingCase.id, payload: values });
    } else {
      createMutation.mutate(values);
    }
  };

  const handledCases = casesQuery.data ?? [];
  const formBusy = isSubmitting || createMutation.isPending || updateMutation.isPending;
  const ageValue = computeAge(birthdateValue ?? undefined);

  const handleStartCreate = () => {
    setEditingCase(null);
    reset(defaultValues);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setEditingCase(null);
    reset(defaultValues);
    setShowForm(false);
  };

  return (
    <div className="page">
      <div
        className="page-header"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <h2>Casos</h2>
          <p>Consulta los expedientes y, si tienes permisos, agrega nuevos registros.</p>
        </div>
        <button className="btn primary" type="button" onClick={handleStartCreate} disabled={!canEdit}>
          + Nuevo caso
        </button>
      </div>

      {showForm ? (
        <>
          <section className="card">
            <form className="form-grid" onSubmit={handleSubmit(onSubmit)}>
              <label>
                N° causa
                <input type="text" {...register('numeroCausa')} disabled={!canEdit} />
                {errors.numeroCausa && <span className="error">{errors.numeroCausa.message}</span>}
              </label>
              <label>
                Fecha del hecho
                <input type="date" {...register('fechaHecho')} disabled={!canEdit} />
                {errors.fechaHecho && <span className="error">{errors.fechaHecho.message}</span>}
              </label>
              <label>
                Situación
                <select {...register('estadoSituacion')} disabled={!canEdit}>
                  {estadoSituacionOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {errors.estadoSituacion && <span className="error">{errors.estadoSituacion.message}</span>}
              </label>
              <label>
                Fuerza asignada
                <select {...register('fuerzaAsignada')} disabled={!canEdit}>
                  {fuerzaAsignadaOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {errors.fuerzaAsignada && <span className="error">{errors.fuerzaAsignada.message}</span>}
              </label>
              <label>
                Recompensa
                <input type="text" {...register('reward')} disabled={!canEdit} />
                {errors.reward && <span className="error">{errors.reward.message}</span>}
              </label>

              <div className="form-actions" style={{ justifyContent: 'space-between' }}>
                <button type="button" className="btn ghost" onClick={handleCancelForm} disabled={formBusy}>
                  Cancelar
                </button>
                <button className="btn primary" type="submit" disabled={formBusy || !canEdit}>
                  {formBusy ? 'Guardando...' : editingCase ? 'Actualizar caso' : 'Crear caso'}
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <h3>Datos de la persona</h3>
            <div className="form-grid">
              <label>
                Nombre
                <input type="text" {...register('persona.firstName')} disabled={!canEdit} />
                {errors.persona?.firstName && <span className="error">{errors.persona.firstName.message}</span>}
              </label>
              <label>
                Apellido
                <input type="text" {...register('persona.lastName')} disabled={!canEdit} />
                {errors.persona?.lastName && <span className="error">{errors.persona.lastName.message}</span>}
              </label>
              <label>
                Documento
                <input type="text" {...register('persona.identityNumber')} disabled={!canEdit} />
                {errors.persona?.identityNumber && (
                  <span className="error">{errors.persona.identityNumber.message}</span>
                )}
              </label>
              <label>
                Fecha de nacimiento
                <input type="date" {...register('persona.birthdate')} disabled={!canEdit} />
                {errors.persona?.birthdate && <span className="error">{errors.persona.birthdate.message}</span>}
              </label>
              <label>
                Edad
                <input type="text" value={ageValue} readOnly />
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
                <label>
                  Especificar nacionalidad
                  <input type="text" {...register('persona.otherNationality')} disabled={!canEdit} />
                  {errors.persona?.otherNationality && (
                    <span className="error">{errors.persona.otherNationality.message}</span>
                  )}
                </label>
              )}

              <div className="full">
                <div className="form-actions" style={{ justifyContent: 'space-between', padding: 0 }}>
                  <h4 style={{ margin: 0 }}>Domicilios</h4>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => addressesFieldArray.append('')}
                    disabled={!canEdit}
                  >
                    + Domicilio
                  </button>
                </div>
                <div className="records-list" style={{ gap: '0.75rem' }}>
                  {addressesFieldArray.fields.map((field, index) => (
                    <div
                      key={field.id}
                      style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}
                    >
                      <input
                        type="text"
                        style={{ flex: 1 }}
                        {...register(`persona.addresses.${index}` as const)}
                        disabled={!canEdit}
                      />
                      <button
                        type="button"
                        className="btn ghost"
                        onClick={() => addressesFieldArray.remove(index)}
                        disabled={!canEdit || addressesFieldArray.fields.length === 1}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                  {Array.isArray(errors.persona?.addresses) &&
                    errors.persona?.addresses?.map((error, index) =>
                      error ? (
                        <span key={index} className="error">
                          {error?.message ?? 'Domicilio requerido'}
                        </span>
                      ) : null
                    )}
                  {errors.persona?.addresses && !Array.isArray(errors.persona.addresses) && (
                    <span className="error">{String(errors.persona.addresses)}</span>
                  )}
                </div>
              </div>

              <label className="full">
                Observaciones
                <textarea rows={3} {...register('persona.notes')} disabled={!canEdit} />
                {errors.persona?.notes && <span className="error">{errors.persona.notes.message}</span>}
              </label>
            </div>
          </section>
        </>
      ) : (
        <section className="card">
          <p className="muted">
            Selecciona un caso del listado o presiona “+ Nuevo caso” para cargar información.
          </p>
        </section>
      )}

      <section className="card">
        <h3>Casos cargados</h3>
        {casesQuery.isLoading && <p>Cargando casos...</p>}
        {casesQuery.isError && <p className="error">No se pudo cargar el listado.</p>}
        {!casesQuery.isLoading && handledCases.length === 0 && <p>No hay casos registrados.</p>}
        {handledCases.length > 0 && (
          <div className="records-list">
            {handledCases.map((item) => (
              <article key={item.id} className="record-item">
                <header>
                  <div>
                    <h4>{item.numeroCausa ?? 'Caso sin número'}</h4>
                    <p className="muted">
                      Situación: {item.estadoSituacion} | Fuerza: {item.fuerzaAsignada ?? 'S/D'}
                    </p>
                  </div>
                  <div className="actions">
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() => {
                        setEditingCase(item);
                        setShowForm(true);
                      }}
                      disabled={!canEdit}
                    >
                      Editar
                    </button>
                    <button
                      className="btn ghost"
                      type="button"
                      onClick={() =>
                        window.confirm('¿Eliminar caso?') && deleteMutation.mutate(item.id)
                      }
                      disabled={!canEdit || deleteMutation.isPending}
                    >
                      Eliminar
                    </button>
                  </div>
                </header>
                <p className="muted">
                  Fecha del hecho:{' '}
                  {item.fechaHecho ? new Date(item.fechaHecho).toLocaleDateString() : 'Sin dato'}
                </p>
                {item.reward && <p className="muted">Recompensa: {item.reward}</p>}
                {item.persona ? (
                  <div className="details-list">
                    <div>
                      <strong>
                        {item.persona.firstName} {item.persona.lastName}
                      </strong>{' '}
                      {item.persona.identityNumber && <span className="tag">{item.persona.identityNumber}</span>}
                      <span className="tag">
                        {item.persona.nationality === 'OTRO'
                          ? item.persona.otherNationality ?? 'OTRO'
                          : 'ARGENTINA'}
                      </span>
                    </div>
                    {item.persona.addresses.length > 0 && (
                      <ul className="details-list">
                        {item.persona.addresses.map((address) => (
                          <li key={address.id}>
                            {address.principal && <strong>Domicilio principal:</strong>}{' '}
                            {address.addressText}
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.persona.notes && <p className="muted">Notas: {item.persona.notes}</p>}
                  </div>
                ) : (
                  <p className="muted">Sin persona asociada.</p>
                )}
                <p className="muted">
                  Creado: {new Date(item.creadoEn).toLocaleString()} | Actualizado:{' '}
                  {new Date(item.actualizadoEn).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default CasesPage;
