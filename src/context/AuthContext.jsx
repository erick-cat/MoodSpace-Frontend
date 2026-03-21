import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

/**
 * Wraps the app with Supabase auth state.
 * Provides: { session, user, profile, loading, signOut }
 */
export function AuthProvider({ children }) {
    const [session, setSession] = useState(undefined); // undefined = not yet loaded
    const [profile, setProfileState] = useState(() => {
        // Try to load cached profile initially to prevent UI flicker/layout shift
        const cached = localStorage.getItem('rs_profile');
        return cached ? JSON.parse(cached) : null;
    });

    // Custom setter that also updates cache
    const setProfile = (newProfile) => {
        setProfileState(newProfile);
        if (newProfile) {
            localStorage.setItem('rs_profile', JSON.stringify(newProfile));
        } else {
            localStorage.removeItem('rs_profile');
        }
    };

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

        // Fetch the latest to ensure cache is correct, but we already have cached data keeping the UI stable
        supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, role, tier, invite_code, invited_by')
            .eq('id', session.user.id)
            .maybeSingle()
            .then(({ data }) => {
                if (data) setProfile(data); // This will update both state and localStorage
            });
    }, [session]);

    async function signOut() {
        setProfile(null); // Clear local auth state and cache
        await supabase.auth.signOut();
    }

    const loading = session === undefined;
    const user = session?.user ?? null;

    return (
        <AuthContext.Provider value={{ session, user, profile, loading, signOut, setProfile }}>
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
