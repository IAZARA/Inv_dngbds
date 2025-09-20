import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { PersonSummary } from '../types';

const personSchema = z.object({
  identityNumber: z.string().min(3).max(50).optional().or(z.literal('')),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthdate: z.string().optional(),
  notes: z.string().optional()
});

type PersonForm = z.infer<typeof personSchema>;

const DashboardPage = () => {
  const { user } = useAuth();
  const canManage = useMemo(
    () => !!user && ['ADMIN', 'OPERATOR'].includes(user.role),
    [user]
  );
  const queryClient = useQueryClient();

  const personsQuery = useQuery({
    queryKey: ['persons'],
    queryFn: async () => {
      const { data } = await api.get<{ persons: PersonSummary[] }>('/persons');
      return data.persons;
    }
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<PersonForm>({ resolver: zodResolver(personSchema) });

  const createPersonMutation = useMutation({
    mutationFn: async (payload: PersonForm) => {
      const body = {
        ...payload,
        identityNumber: payload.identityNumber || undefined,
        birthdate: payload.birthdate || undefined
      };
      await api.post('/persons', body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      reset();
    }
  });

  return (
    <div className="page">
      <div className="page-header">
        <h2>Legajos</h2>
        <p>Listado de personas investigadas y acceso rápido a sus fuentes</p>
      </div>

      {canManage && (
        <section className="card">
          <h3>Registrar nueva persona</h3>
          <form
            className="form-grid"
            onSubmit={handleSubmit((data) => createPersonMutation.mutate(data))}
          >
            <label>
              Número de documento
              <input type="text" {...register('identityNumber')} placeholder="Opcional" />
              {errors.identityNumber && <span className="error">{errors.identityNumber.message}</span>}
            </label>
            <label>
              Nombre
              <input type="text" {...register('firstName')} />
              {errors.firstName && <span className="error">{errors.firstName.message}</span>}
            </label>
            <label>
              Apellido
              <input type="text" {...register('lastName')} />
              {errors.lastName && <span className="error">{errors.lastName.message}</span>}
            </label>
            <label>
              Fecha de nacimiento
              <input type="date" {...register('birthdate')} />
              {errors.birthdate && <span className="error">{errors.birthdate.message}</span>}
            </label>
            <label className="full">
              Observaciones
              <textarea rows={3} {...register('notes')} placeholder="Antecedentes relevantes" />
              {errors.notes && <span className="error">{errors.notes.message}</span>}
            </label>
            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={createPersonMutation.isPending}>
                {createPersonMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
          {createPersonMutation.isError && (
            <div className="error-box">No se pudo registrar la persona. Reintente más tarde.</div>
          )}
          {createPersonMutation.isSuccess && (
            <div className="success-box">Persona registrada con éxito.</div>
          )}
        </section>
      )}

      <section className="card">
        <h3>Personas registradas</h3>
        {personsQuery.isLoading && <p>Cargando personas...</p>}
        {personsQuery.isError && <p className="error">No se pudo cargar el listado.</p>}
        {personsQuery.data && personsQuery.data.length === 0 && <p>No hay registros.</p>}
        {personsQuery.data && personsQuery.data.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Documento</th>
                <th>Última actualización</th>
                <th>Fuentes recientes</th>
              </tr>
            </thead>
            <tbody>
              {personsQuery.data.map((person) => (
                <tr key={person.id}>
                  <td>
                    <Link to={`/persons/${person.id}`} className="link">
                      {person.firstName} {person.lastName}
                    </Link>
                  </td>
                  <td>{person.identityNumber ?? '—'}</td>
                  <td>{new Date(person.updatedAt).toLocaleString()}</td>
                  <td>
                    {person.records.length === 0 && 'Sin registros'}
                    {person.records.map((record) => (
                      <span key={record.id} className="tag">
                        {record.source.name}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default DashboardPage;
