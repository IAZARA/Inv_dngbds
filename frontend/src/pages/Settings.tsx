import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

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
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);

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

  const handleDownloadAllCases = async () => {
    try {
      setDownloadingAll(true);
      setDownloadProgress('Preparando descarga de todos los casos...');

      const response = await api.get('/cases/export-all-zip', {
        responseType: 'blob',
        timeout: 600000, // 10 minutos de timeout
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setDownloadProgress(`Descargando... ${percentCompleted}%`);
          } else {
            setDownloadProgress('Descargando... (esto puede tardar varios minutos)');
          }
        }
      });

      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Obtener el nombre del archivo del header o usar uno por defecto
      const contentDisposition = response.headers['content-disposition'];
      let fileName = `TODOS_LOS_CASOS_${new Date().toISOString().slice(0, 10)}.zip`;

      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/);
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = fileNameMatch[1];
        }
      }

      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      // Mostrar información sobre casos procesados si está disponible
      const casesProcessed = response.headers['x-cases-processed'];
      const totalCases = response.headers['x-total-cases'];

      if (casesProcessed && totalCases) {
        setSuccessMessage(`Descarga completada: ${casesProcessed} de ${totalCases} casos procesados exitosamente.`);
      } else {
        setSuccessMessage('Descarga completada exitosamente.');
      }

      setDownloadProgress(null);
    } catch (error) {
      console.error('Error descargando todos los casos:', error);
      setServerError('No se pudo descargar el archivo con todos los casos. Por favor, intenta nuevamente.');
      setDownloadProgress(null);
    } finally {
      setDownloadingAll(false);
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

      {user?.role === 'ADMIN' && (
        <div className="card">
          <h3>Administración</h3>
          <p className="muted">Funciones exclusivas para administradores del sistema.</p>

          <div className="settings-form">
            <label>
              <strong>Descarga masiva de casos</strong>
              <p className="muted" style={{ marginTop: '8px', marginBottom: '16px' }}>
                Descarga un archivo ZIP que contiene todos los casos del sistema. Cada caso incluye su PDF, Excel, fotos y documentos en un ZIP individual.
              </p>

              <button
                className="btn primary"
                type="button"
                onClick={handleDownloadAllCases}
                disabled={downloadingAll}
                style={{ width: 'auto' }}
              >
                {downloadingAll ? 'Procesando...' : 'Descargar todos los casos'}
              </button>

              {downloadProgress && (
                <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f0f4f8', borderRadius: '4px', color: '#1e293b' }}>
                  <strong>Estado:</strong> {downloadProgress}
                </div>
              )}
            </label>
          </div>

          {serverError && <div className="error-box">{serverError}</div>}
          {successMessage && <div className="success-box">{successMessage}</div>}
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
