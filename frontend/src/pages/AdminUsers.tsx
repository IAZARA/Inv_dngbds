import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../lib/api';
import type { User } from '../types';

const userSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'OPERATOR', 'CONSULTANT']),
  password: z.string().min(8)
});

type UserForm = z.infer<typeof userSchema>;

const AdminUsersPage = () => {
  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get<{ users: User[] }>('/users');
      return data.users;
    }
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<UserForm>({ resolver: zodResolver(userSchema) });

  const createUserMutation = useMutation({
    mutationFn: async (payload: UserForm) => {
      await api.post('/users', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      reset();
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api.patch(`/users/${id}`, { isActive });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword }: { id: string; newPassword: string }) => {
      await api.post(`/users/${id}/reset-password`, { newPassword });
    }
  });

  const onSubmit = (data: UserForm) => createUserMutation.mutate(data);

  const handleToggleStatus = (user: User) => {
    toggleStatusMutation.mutate({ id: user.id, isActive: !user.isActive });
  };

  const handleResetPassword = (user: User) => {
    const newPassword = window.prompt(`Nueva contraseña para ${user.email}`);
    if (!newPassword) return;
    if (newPassword.length < 8) {
      alert('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    resetPasswordMutation.mutate({ id: user.id, newPassword });
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Gestión de usuarios</h2>
        <p>Administra cuentas y accesos al sistema</p>
      </div>

      <section className="card">
        <h3>Crear nuevo usuario</h3>
        <form className="form-grid" onSubmit={handleSubmit(onSubmit)}>
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
            Correo
            <input type="email" {...register('email')} />
            {errors.email && <span className="error">{errors.email.message}</span>}
          </label>
          <label>
            Rol
            <select {...register('role')}>
              <option value="ADMIN">ADMIN</option>
              <option value="OPERATOR">OPERADOR</option>
              <option value="CONSULTANT">CONSULTOR</option>
            </select>
          </label>
          <label>
            Contraseña temporal
            <input type="password" {...register('password')} />
            {errors.password && <span className="error">{errors.password.message}</span>}
          </label>
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
        {createUserMutation.isError && (
          <div className="error-box">No se pudo crear el usuario. Verifique los datos.</div>
        )}
        {createUserMutation.isSuccess && (
          <div className="success-box">Usuario creado correctamente.</div>
        )}
      </section>

      <section className="card">
        <h3>Usuarios existentes</h3>
        {usersQuery.isLoading && <p>Cargando usuarios...</p>}
        {usersQuery.isError && <p className="error">No se pudo cargar el listado.</p>}
        {usersQuery.data && usersQuery.data.length === 0 && <p>No hay usuarios</p>}
        {usersQuery.data && usersQuery.data.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.data.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.firstName} {user.lastName}
                  </td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <span className={`status ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Nunca'}</td>
                  <td className="actions">
                    <button
                      className="btn ghost"
                      onClick={() => handleToggleStatus(user)}
                      disabled={toggleStatusMutation.isPending}
                    >
                      {user.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button
                      className="btn ghost"
                      onClick={() => handleResetPassword(user)}
                      disabled={resetPasswordMutation.isPending}
                    >
                      Resetear clave
                    </button>
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

export default AdminUsersPage;
