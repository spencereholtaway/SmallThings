import { supabase } from '../lib/supabase.js';

export default function AuthScreen() {
  async function signIn(provider) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) console.error('Sign-in error:', error.message);
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-card__title">A Series of Small Things</h1>
        <p className="auth-card__subtitle">Sign in to save your moments</p>
        <div className="auth-card__buttons">
          <button
            className="auth-btn auth-btn--google"
            onClick={() => signIn('google')}
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}
