'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  ApiErrorSchema,
  INVALID_CREDENTIALS_MESSAGE,
  LOGIN_LOCKOUT_MINUTES,
  LOGIN_MAX_FAILED_ATTEMPTS,
  LoginRequestSchema,
} from '@property-erp/shared';
import { CircleAlert, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { safeNextPath } from '@/lib/api-client';

async function failureMessage(response: Response): Promise<string> {
  if (response.status === 401) {
    return `${INVALID_CREDENTIALS_MESSAGE} After ${LOGIN_MAX_FAILED_ATTEMPTS} failed attempts the account is locked for ${LOGIN_LOCKOUT_MINUTES} minutes.`;
  }
  if (response.status === 429)
    return 'Too many sign-in attempts from this network. Wait a few minutes and try again.';
  const body = ApiErrorSchema.safeParse(await response.json().catch(() => null));
  return body.success ? body.data.message : 'Sign-in failed. Try again.';
}

export function LoginForm({ next }: { next?: string }) {
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(LoginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);
    let response: Response;
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
    } catch {
      setFailure('Cannot reach the server. Check your connection and try again.');
      return;
    }
    if (response.ok) {
      // A full navigation, so every page starts from the new session.
      window.location.assign(safeNextPath(next));
      return;
    }
    setFailure(await failureMessage(response));
    form.setValue('password', '');
    form.setFocus('password');
  });

  const submitting = form.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            {failure ? (
              <Alert variant="destructive" role="alert">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{failure}</AlertDescription>
              </Alert>
            ) : null}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="username" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
