import React, { useEffect, useState } from 'react';
import { Lock, User } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const REMEMBER_KEY = 'easyink_remembered_username';

const DEMO_ACCOUNTS = [
  { username: 'mark', pass: 'easyink123', name: 'Mark Dela Cruz', role: 'Admin' },
  { username: 'ana', pass: 'branch123', name: 'Ana Santos', role: 'Branch 1' },
  { username: 'kevin', pass: 'intern123', name: 'Kevin Ramos', role: 'OJT' },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  loading,
  error,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setUsername(saved);
        setRememberMe(true);
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) return;
    try {
      if (rememberMe) {
        window.localStorage.setItem(REMEMBER_KEY, cleanUser);
      } else {
        window.localStorage.removeItem(REMEMBER_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    await onLogin(cleanUser, password);
  };

  return (
    <div className="min-h-screen bg-[#1E162B] flex flex-col items-center justify-center p-4 sm:p-8 gap-5">
      {/* Centered White Login Card */}
      <div className="w-full max-w-[400px] min-h-[580px] bg-white rounded-[32px] px-7 py-7 sm:px-9 sm:py-8 shadow-[0_24px_60px_rgba(0,0,0,0.35)] flex flex-col justify-between">
        {/* Top-Left Brand Mark */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-[#E8D6EF] bg-white shrink-0">
            <img
              src="/assets/aistudio/_0F9C15D7-CDDB-4FAE-8B34-4D6431FF4EF0__26f590ff.png"
              alt="Easy-Ink Creations logo"
              className="w-full h-full object-cover scale-[1.06]"
            />
          </div>
          <div className="leading-tight">
            <div className="font-display text-[15px] font-bold text-[#1E162B]">
              Easy-Ink
            </div>
            <div className="font-display text-[13.5px] font-bold text-[#6E3580]">
              Creations
            </div>
          </div>
        </div>

        {/* Center Avatar + Pill Inputs + LOGIN CTA */}
        <div className="my-auto py-6">
          <div className="w-24 h-24 rounded-full bg-[#6E3580] flex items-center justify-center mx-auto mb-7">
            <User className="w-12 h-12 text-white" strokeWidth={1.6} aria-hidden="true" />
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-2xl bg-[#FFF2F9] border border-[#FE4FAE]/50 px-4 py-2.5 text-xs font-semibold text-[#C41D73] text-center"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="login-username" className="sr-only">
                Username
              </label>
              <div className="w-full min-h-[46px] rounded-full border-[1.75px] border-[#6E3580] bg-white px-4 flex items-center gap-3 focus-within:ring-2 focus-within:ring-[#CF93D9] transition-shadow">
                <User className="w-[18px] h-[18px] text-[#6E3580] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="USERNAME"
                  required
                  className="w-full bg-transparent text-sm font-medium text-[#1E162B] placeholder:text-[#9A8BA8] placeholder:text-xs placeholder:font-semibold placeholder:tracking-wider focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="sr-only">
                Password
              </label>
              <div className="w-full min-h-[46px] rounded-full border-[1.75px] border-[#6E3580] bg-white px-4 flex items-center gap-3 focus-within:ring-2 focus-within:ring-[#CF93D9] transition-shadow">
                <Lock className="w-[18px] h-[18px] text-[#6E3580] shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-transparent text-sm font-medium text-[#1E162B] placeholder:text-[#9A8BA8] placeholder:tracking-widest focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[46px] rounded-full bg-[#6E3580] hover:bg-[#1E162B] text-white text-sm font-bold tracking-[0.14em] uppercase disabled:opacity-60 transition-colors cursor-pointer"
              >
                {loading ? 'SIGNING IN...' : 'LOGIN'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 px-1 text-[11.5px]">
              <label className="inline-flex items-center gap-1.5 text-[#1E162B] font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#6E3580] cursor-pointer"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => setShowForgotHelp((prev) => !prev)}
                className="italic text-[#635573] hover:text-[#6E3580] cursor-pointer"
              >
                Forgot your password?
              </button>
            </div>

            {showForgotHelp && (
              <div className="rounded-xl bg-[#FBF8FD] border border-[#E8D6EF] px-3 py-2 text-[11.5px] text-[#635573] text-center">
                Ask your Branch Admin to reset your password under Staff Access.
              </div>
            )}
          </form>
        </div>

        {/* Bottom Three-Dot Indicator */}
        <div className="flex items-center justify-center gap-2 pt-2" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-[#6E3580]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#CF93D9]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#6E3580]" />
        </div>
      </div>

      {/* Subtle Quick Sign-In Bar Below Card */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="text-[#D8BBE4] font-medium mr-1">Quick Sign-In:</span>
        {DEMO_ACCOUNTS.map((acct) => (
          <button
            key={acct.username}
            type="button"
            disabled={loading}
            onClick={() => onLogin(acct.username, acct.pass)}
            className="min-h-[34px] px-3.5 py-1 rounded-full bg-[#2A203B] hover:bg-[#6E3580] text-[#F2E4F7] border border-[#493860] font-semibold transition-colors cursor-pointer"
          >
            {acct.name} <span className="text-[#CF93D9] font-normal">({acct.role})</span>
          </button>
        ))}
      </div>
    </div>
  );
};
