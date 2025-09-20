import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';

const loginSchema = z.object({
  email: z.string().email({ message: 'Correo inválido' }),
  password: z.string().min(8, { message: 'Mínimo 8 caracteres' })
});

type LoginForm = z.infer<typeof loginSchema>;

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setServerError(null);
    try {
      await login(data);
      navigate('/');
    } catch (error) {
      console.error(error);
      setServerError('Credenciales inválidas');
    }
  };

  return (
    <div className="login-page">
      <form className="card" onSubmit={handleSubmit(onSubmit)}>
        <h2>Ingreso al sistema</h2>
        <label>
          Correo electrónico
          <input type="email" {...register('email')} placeholder="usuario@correo.com" />
          {errors.email && <span className="error">{errors.email.message}</span>}
        </label>
        <label>
          Contraseña
          <input type="password" {...register('password')} placeholder="********" />
          {errors.password && <span className="error">{errors.password.message}</span>}
        </label>
        {serverError && <div className="error-box">{serverError}</div>}
        <button className="btn primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
