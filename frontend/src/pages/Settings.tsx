import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8, 'Mínimo 8 caracteres'),
    newPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
      .regex(/[a-z]/, 'Debe incluir al menos una minúscula')
      .regex(/\d/, 'Debe incluir números'),
    confirmPassword: z.string().min(8, 'Mínimo 8 caracteres')
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword']
  });

type PasswordForm = z.infer<typeof passwordSchema>;

const SettingsPage: React.FC = () => {
  const { user, changePassword } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  const onSubmit = async (values: PasswordForm) => {
    setServerError(null);
    setSuccessMessage(null);
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      setSuccessMessage('Contraseña actualizada correctamente.');
      reset();
    } catch (error) {
      console.error(error);
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'No se pudo actualizar la contraseña';
      setServerError(message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Configuración</h2>
        <p className="subtitle">Gestiona tu cuenta y ajusta tu contraseña de acceso.</p>
      </div>

      <div className="card">
        <h3>Cambiar contraseña</h3>
        <p className="muted">Actualiza tu contraseña regularmente para mantener tu cuenta segura.</p>
        <form className="settings-form" onSubmit={handleSubmit(onSubmit)}>
          <label>
            Contraseña actual
            <input type="password" autoComplete="current-password" {...register('currentPassword')} />
            {errors.currentPassword && <span className="error">{errors.currentPassword.message}</span>}
          </label>

          <label>
            Nueva contraseña
            <input type="password" autoComplete="new-password" {...register('newPassword')} />
            {errors.newPassword && <span className="error">{errors.newPassword.message}</span>}
          </label>

          <label>
            Confirmar nueva contraseña
            <input type="password" autoComplete="new-password" {...register('confirmPassword')} />
            {errors.confirmPassword && <span className="error">{errors.confirmPassword.message}</span>}
          </label>

          <div className="settings-actions">
            <button className="btn primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>

          {serverError && <div className="error-box">{serverError}</div>}
          {successMessage && <div className="success-box">{successMessage}</div>}
        </form>
      </div>

      <div className="card">
        <h3>Información de la cuenta</h3>
        <dl className="account-details">
          <div>
            <dt>Nombre</dt>
            <dd>
              {user?.firstName} {user?.lastName}
            </dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Rol</dt>
            <dd>{user?.role}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
};

export default SettingsPage;
