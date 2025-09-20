import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useParams } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { PersonDetail, Source } from '../types';

const recordSchema = z.object({
  sourceId: z.string().uuid(),
  collectedAt: z.string().optional(),
  summary: z.string().optional(),
  rawPayload: z.string().optional()
});

type RecordForm = z.infer<typeof recordSchema>;

const PersonDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [payloadError, setPayloadError] = useState<string | null>(null);

  const canManage = useMemo(
    () => !!user && ['ADMIN', 'OPERATOR'].includes(user.role),
    [user]
  );

  const personQuery = useQuery({
    queryKey: ['person', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await api.get<{ person: PersonDetail }>(`/persons/${id}`);
      return data.person;
    }
  });

  const sourcesQuery = useQuery<Source[]>({
    queryKey: ['sources'],
    enabled: canManage,
    queryFn: async () => {
      const { data } = await api.get<{ sources: Source[] }>('/sources');
      return data.sources;
    }
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<RecordForm>({ resolver: zodResolver(recordSchema) });

  const addRecordMutation = useMutation({
    mutationFn: async (payload: RecordForm) => {
      if (!id) return;
      let rawPayload: unknown;
      if (payload.rawPayload) {
        try {
          rawPayload = JSON.parse(payload.rawPayload);
        } catch (error) {
          throw new Error('El detalle de la fuente debe ser JSON válido');
        }
      }

      await api.post(`/persons/${id}/sources`, {
        sourceId: payload.sourceId,
        collectedAt: payload.collectedAt || undefined,
        summary: payload.summary || undefined,
        rawPayload
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['person', id] });
      reset();
      setPayloadError(null);
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        setPayloadError(error.message);
      } else {
        setPayloadError('No se pudo guardar el registro.');
      }
    }
  });

  if (personQuery.isLoading) {
    return <div>Cargando legajo...</div>;
  }

  if (personQuery.isError || !personQuery.data) {
    return <div className="error">No se pudo cargar la información.</div>;
  }

  const person = personQuery.data;

  return (
    <div className="page">
      <div className="page-header">
        <h2>
          {person.firstName} {person.lastName}
        </h2>
        <p>Documento: {person.identityNumber ?? 'No registrado'}</p>
      </div>

      <section className="card">
        <h3>Detalle del legajo</h3>
        <ul className="details-list">
          <li>
            <strong>Fecha de nacimiento:</strong>{' '}
            {person.birthdate ? new Date(person.birthdate).toLocaleDateString() : 'Sin dato'}
          </li>
          <li>
            <strong>Notas:</strong> {person.notes ?? '—'}
          </li>
          <li>
            <strong>Última actualización:</strong> {new Date(person.updatedAt).toLocaleString()}
          </li>
        </ul>
      </section>

      {canManage && (
        <section className="card">
          <h3>Agregar información desde una fuente</h3>
          <form
            className="form-grid"
            onSubmit={handleSubmit((data) => addRecordMutation.mutate(data))}
          >
            <label>
              Fuente
              <select {...register('sourceId')}>
                <option value="">Selecciona una fuente</option>
                {sourcesQuery.data?.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name} ({source.kind})
                  </option>
                ))}
              </select>
              {errors.sourceId && <span className="error">{errors.sourceId.message}</span>}
            </label>
            <label>
              Fecha de recolección
              <input type="datetime-local" {...register('collectedAt')} />
            </label>
            <label className="full">
              Resumen
              <textarea rows={3} {...register('summary')} placeholder="Resumen breve" />
            </label>
            <label className="full">
              Detalle (JSON)
              <textarea
                rows={4}
                {...register('rawPayload')}
                placeholder='{"detalle": "texto"}'
              />
            </label>
            {payloadError && <div className="error-box">{payloadError}</div>}
            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={addRecordMutation.isPending}>
                {addRecordMutation.isPending ? 'Guardando...' : 'Guardar registro'}
              </button>
            </div>
          </form>
          {addRecordMutation.isSuccess && (
            <div className="success-box">Registro agregado correctamente.</div>
          )}
        </section>
      )}

      <section className="card">
        <h3>Fuentes asociadas</h3>
        {person.records.length === 0 && <p>No hay fuentes aún.</p>}
        {person.records.length > 0 && (
          <div className="records-list">
            {person.records.map((record) => (
              <article key={record.id} className="record-item">
                <header>
                  <h4>{record.source.name}</h4>
                  <span className="tag">{record.source.kind}</span>
                </header>
                <p className="muted">
                  Registrado el {new Date(record.collectedAt).toLocaleString()}{' '}
                  {record.collectedBy && `por ${record.collectedBy.firstName} ${record.collectedBy.lastName}`}
                </p>
                {record.summary && <p>{record.summary}</p>}
                {record.rawPayload !== null && record.rawPayload !== undefined && (
                  <details>
                    <summary>Ver detalle JSON</summary>
                    <pre>{JSON.stringify(record.rawPayload, null, 2)}</pre>
                  </details>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PersonDetailPage;
