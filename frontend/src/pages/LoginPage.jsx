/**
 * pages/LoginPage.jsx + RegisterPage.jsx
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Input } from '../components/Shared/UI';
import { useAuthStore } from '../store';

function AuthShell({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <Sparkles size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────
export function LoginPage() {
  const [form, setForm]     = useState({ username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await login(form.username, form.password);
    if (res.success) { toast.success('Welcome back!'); navigate('/dashboard'); }
    else toast.error(res.error || 'Login failed');
  };

  return (
    <AuthShell title="Research Collab Hub" subtitle="Sign in to your research workspace">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Email or Username" value={form.username} type="text" required
          onChange={e => setForm(f => ({...f, username: e.target.value}))}
          placeholder="alice.chen@mit.edu" />
        <div className="relative">
          <Input label="Password" value={form.password} type={showPw ? 'text' : 'password'} required
            onChange={e => setForm(f => ({...f, password: e.target.value}))}
            placeholder="••••••••" />
          <button type="button" onClick={() => setShowPw(p => !p)}
            className="absolute right-3 top-8 text-slate-400 hover:text-slate-600">
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <Button type="submit" loading={isLoading} className="w-full justify-center" size="lg">
          Sign In
        </Button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-4">
        No account?{' '}
        <Link to="/register" className="text-indigo-600 font-medium hover:underline">
          Register here
        </Link>
      </p>
      <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-1">Demo accounts:</p>
        <p>alice.chen@mit.edu / Password123!</p>
        <p>bob.patel@stanford.edu / Password123!</p>
      </div>
    </AuthShell>
  );
}

// ── Register ──────────────────────────────────────────────────────────────
export function RegisterPage() {
  const [form, setForm] = useState({
    email:'', username:'', password:'', full_name:'', institution:'', department:''
  });
  const [showPw, setShowPw] = useState(false);
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await register(form);
    if (res.success) {
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } else {
      toast.error(res.error || 'Registration failed');
    }
  };

  const set = (field) => (e) => setForm(f => ({...f, [field]: e.target.value}));

  return (
    <AuthShell title="Create Account" subtitle="Join the collaborative research platform">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label="Full Name *" value={form.full_name} onChange={set('full_name')}
          placeholder="Dr. Alice Chen" required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Username *" value={form.username} onChange={set('username')}
            placeholder="alice_chen" required />
          <Input label="Email *" type="email" value={form.email} onChange={set('email')}
            placeholder="alice.chen@mit.edu" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Institution" value={form.institution} onChange={set('institution')}
            placeholder="MIT" />
          <Input label="Department" value={form.department} onChange={set('department')}
            placeholder="Computer Science" />
        </div>
        <div className="relative">
          <Input label="Password *" value={form.password} type={showPw ? 'text' : 'password'}
            onChange={set('password')} placeholder="min. 8 characters" required minLength={8} />
          <button type="button" onClick={() => setShowPw(p => !p)}
            className="absolute right-3 top-8 text-slate-400 hover:text-slate-600">
            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <Button type="submit" loading={isLoading} className="w-full justify-center" size="lg">
          Create Account
        </Button>
      </form>
      <p className="text-center text-sm text-slate-500 mt-4">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-600 font-medium hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}

export { LoginPage as default };
