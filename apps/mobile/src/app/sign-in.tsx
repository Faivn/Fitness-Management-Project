import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Mascot, Screen, Segmented, Text, TextField } from '@/components';
import { useAuth } from '@/lib/auth';

/** Email + password sign-in (spec §8.0.2). Kept separate from fitness profiling. */
export default function SignIn() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        await signIn(email.trim(), password);
        router.replace('/');
      } else {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) setNotice('Check your email to confirm your account, then sign in.');
        else router.replace('/');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Mascot mood="phone" size={96} />
      <Text variant="title">{mode === 'sign-in' ? 'Welcome back' : 'Create your workspace'}</Text>
      <Segmented
        options={[
          { value: 'sign-in', label: 'Sign in' },
          { value: 'sign-up', label: 'Create account' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
        helper={mode === 'sign-up' ? 'At least 8 characters.' : undefined}
      />
      {error ? <Banner tone="error">{error}</Banner> : null}
      {notice ? <Banner tone="info" title="Almost there">{notice}</Banner> : null}
      <Button label={mode === 'sign-in' ? 'Sign in' : 'Create account'} fullWidth loading={busy} onPress={submit} />
    </Screen>
  );
}
