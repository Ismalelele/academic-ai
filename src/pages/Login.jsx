import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { useState } from 'react';
import { Mail, Lock, User, GraduationCap, Camera, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const { user, signInWithGoogle, signUpWithEmail, signInWithEmail } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [carrera, setCarrera] = useState('');
  const [avatarBase64, setAvatarBase64] = useState('');
  
  // Status states
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        setError('La foto debe pesar menos de 1.5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const getInitials = (fullName) => {
    if (!fullName) return '?';
    const clean = fullName.trim();
    if (!clean) return '?';
    return clean.charAt(0).toUpperCase();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(false);

    if (!email.trim() || !password.trim()) {
      setError('Por favor, completa todos los campos obligatorios.');
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('El nombre completo es obligatorio.');
        if (!carrera.trim()) throw new Error('La carrera es obligatoria.');
        
        const data = await signUpWithEmail(email, password, {
          full_name: name.trim(),
          carrera: carrera.trim(),
          avatar_url: avatarBase64 || null
        });
        
        // Si el correo ya se auto-confirma, Supabase devuelve la sesión directamente.
        // Si no, forzamos un intento de inicio de sesión automático.
        if (data?.session) {
          setSuccessMsg('¡Cuenta registrada e iniciada con éxito!');
        } else {
          try {
            await signInWithEmail(email, password);
            setSuccessMsg('¡Cuenta registrada e iniciada con éxito!');
          } catch (signInErr) {
            console.warn("Auto-login failed:", signInErr);
            setSuccessMsg('¡Cuenta registrada con éxito! Puedes iniciar sesión ahora.');
            setIsRegister(false);
            setPassword('');
          }
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error en las credenciales. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'linear-gradient(135deg, #090d16 0%, #11102e 100%)',
      position: 'relative',
      overflowY: 'auto',
      padding: '40px 20px',
      boxSizing: 'border-box'
    }}>
      {/* Círculos decorativos de fondo */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '50vw',
        height: '50vw',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%',
        zIndex: 0,
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-5%',
        width: '40vw',
        height: '40vw',
        background: 'radial-gradient(circle, rgba(14, 165, 233, 0.12) 0%, rgba(0,0,0,0) 70%)',
        borderRadius: '50%',
        zIndex: 0,
        pointerEvents: 'none'
      }}></div>

      {/* Tarjeta de Formulario Principal */}
      <div style={{
        maxWidth: '480px',
        width: '100%',
        padding: '40px 30px',
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        zIndex: 1,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Cabecera / Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #38bdf8, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '26px',
            fontWeight: '900',
            boxShadow: '0 10px 25px rgba(139, 92, 246, 0.3)',
          }}>
            AI
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '800', margin: '5px 0 0 0', color: '#ffffff', letterSpacing: '-0.5px' }}>
            Academic AI
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0' }}>
            Tu ecosistema universitario inteligente
          </p>
        </div>

        {/* Selector de Pestaña (Login / Register) */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(''); setSuccessMsg(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: !isRegister ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: !isRegister ? '#fff' : '#94a3b8',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(''); setSuccessMsg(''); }}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              background: isRegister ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: isRegister ? '#fff' : '#94a3b8',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Registrarse
          </button>
        </div>

        {/* Alertas */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#fca5a5',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            lineHeight: '1.4',
            textAlign: 'left'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            color: '#a7f3d0',
            padding: '12px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            lineHeight: '1.4',
            textAlign: 'left'
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* SECCIÓN REGISTRO: Nombre Completo y Carrera */}
          {isRegister && (
            <>
              {/* Uploader y Preview de Foto */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500' }}>Foto de Perfil (Opcional)</label>
                <div style={{ position: 'relative', width: '70px', height: '70px' }}>
                  {avatarBase64 ? (
                    <img 
                      src={avatarBase64} 
                      alt="Preview" 
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '28px',
                      fontWeight: 'bold',
                      border: '2px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      {getInitials(name)}
                    </div>
                  )}
                  <label htmlFor="avatar-file" style={{
                    position: 'absolute',
                    bottom: '0',
                    right: '0',
                    background: 'var(--primary, #8b5cf6)',
                    color: '#fff',
                    borderRadius: '50%',
                    padding: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.2)'
                  }}>
                    <Camera size={12} />
                    <input 
                      type="file" 
                      id="avatar-file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* Nombre Completo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '500' }}>Nombre Completo</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Juan Pérez"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 40px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary, #8b5cf6)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                  />
                </div>
              </div>

              {/* Carrera */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '500' }}>Carrera Universitaria</label>
                <div style={{ position: 'relative' }}>
                  <GraduationCap size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                  <input
                    type="text"
                    placeholder="Ingeniería Civil Informática"
                    value={carrera}
                    onChange={(e) => setCarrera(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '12px 12px 12px 40px',
                      background: 'rgba(0, 0, 0, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary, #8b5cf6)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                  />
                </div>
              </div>
            </>
          )}

          {/* Email / Gmail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
            <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '500' }}>Correo Electrónico (Gmail)</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="email"
                placeholder="usuario@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary, #8b5cf6)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
              />
            </div>
          </div>

          {/* Contraseña */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
            <label style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: '500' }}>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 40px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary, #8b5cf6)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
              />
            </div>
          </div>

          {/* Botón de Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              marginTop: '10px',
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)'
            }}
            onMouseOver={(e) => {
              if(!loading) {
                e.target.style.transform = 'translateY(-1px)';
                e.target.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.4)';
              }
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.3)';
            }}
          >
            {loading ? 'Procesando...' : (isRegister ? 'Crear Cuenta' : 'Iniciar Sesión')}
          </button>
        </form>

        {/* Separador O */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '5px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }}></div>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>O TAMBIÉN</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.08)' }}></div>
        </div>

        {/* Botón Google */}
        <button 
          onClick={signInWithGoogle}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.03)',
            color: '#ffffff',
            fontSize: '0.95rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.08)';
            e.target.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.03)';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          <img src="https://authjs.dev/img/providers/google.svg" alt="Google" style={{ width: '20px' }} />
          Continuar con Google
        </button>
      </div>
    </div>
  );
}
