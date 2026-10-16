import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Mascot, Screen, Segmented, Text, TextField } from '@/components';
import { useAuth } from '@/lib/auth';

/** Email + password sign-in (spec §8.0.2). Kept separate from fitness profiling. */
export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(params.mode === 'sign-up' ? 'sign-up' : 'sign-in');
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
        if (needsConfirmation) {
          setNotice(`We've sent a confirmation link to ${email.trim()}. Open it, then sign in here.`);
          setMode('sign-in');
        }
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
      <Text variant="title">{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</Text>
      <Text variant="small" color="inkSecondary">
        {mode === 'sign-in'
          ? 'Sign in to open your saved workspace.'
          : 'Just an email and a password. Your workouts, plans and history are saved privately to your account.'}
      </Text>
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
