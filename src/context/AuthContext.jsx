import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

/**
 * Wraps the app with Supabase auth state.
 * Provides: { session, user, profile, loading, signOut }
 */
export function AuthProvider({ children }) {
    const [session, setSession] = useState(undefined); // undefined = not yet loaded
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        // Load session on mount
        supabase.auth.getSession().then(({ data }) => {
            setSession(data.session ?? null);
        });

        // Subscribe to auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Load extended profile from public.profiles when session changes
    useEffect(() => {
        if (!session?.user) {
            setProfile(null);
            return;
        }
        supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, role, tier, invite_code')
            .eq('id', session.user.id)
            .maybeSingle()
            .then(({ data }) => setProfile(data));
    }, [session]);

    async function signOut() {
        await supabase.auth.signOut();
    }

    const loading = session === undefined;
    const user = session?.user ?? null;

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

/** Hook: use inside any component to access auth state */
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
