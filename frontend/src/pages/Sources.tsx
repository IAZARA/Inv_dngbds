import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../lib/api';
import type { Source } from '../types';

const sourceSchema = z.object({
  name: z.string().min(2),
  kind: z.string().min(2),
  description: z.string().optional()
});

type SourceForm = z.infer<typeof sourceSchema>;

const SourcesPage = () => {
  const queryClient = useQueryClient();

  const sourcesQuery = useQuery({
    queryKey: ['sources'],
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
  } = useForm<SourceForm>({ resolver: zodResolver(sourceSchema) });

  const createSourceMutation = useMutation({
    mutationFn: async (payload: SourceForm) => {
      await api.post('/sources', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sources'] });
      reset();
    }
  });

  return (
    <div className="page">
      <div className="page-header">
        <h2>Fuentes de información</h2>
        <p>Define fuentes disponibles para asociarlas a los legajos</p>
      </div>

      <section className="card">
        <h3>Registrar nueva fuente</h3>
        <form className="form-grid" onSubmit={handleSubmit((data) => createSourceMutation.mutate(data))}>
          <label>
            Nombre
            <input type="text" {...register('name')} />
            {errors.name && <span className="error">{errors.name.message}</span>}
          </label>
          <label>
            Tipo
            <input type="text" {...register('kind')} placeholder="Ej. Red social, Inteligencia" />
            {errors.kind && <span className="error">{errors.kind.message}</span>}
          </label>
          <label className="full">
            Descripción
            <textarea rows={3} {...register('description')} />
          </label>
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={createSourceMutation.isPending}>
              {createSourceMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
        {createSourceMutation.isError && (
          <div className="error-box">No se pudo registrar la fuente.</div>
        )}
        {createSourceMutation.isSuccess && (
          <div className="success-box">Fuente registrada correctamente.</div>
        )}
      </section>

      <section className="card">
        <h3>Fuentes registradas</h3>
        {sourcesQuery.isLoading && <p>Cargando fuentes...</p>}
        {sourcesQuery.isError && <p className="error">No se pudo cargar el listado.</p>}
        {sourcesQuery.data && sourcesQuery.data.length === 0 && <p>No hay fuentes registradas.</p>}
        {sourcesQuery.data && sourcesQuery.data.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Actualización</th>
              </tr>
            </thead>
            <tbody>
              {sourcesQuery.data.map((source) => (
                <tr key={source.id}>
                  <td>{source.name}</td>
                  <td>{source.kind}</td>
                  <td>{source.description ?? '—'}</td>
                  <td>{new Date(source.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default SourcesPage;
